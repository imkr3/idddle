#!/usr/bin/env node
/* 밸런스 시뮬레이터: 가상 플레이어가 게임을 수십 시간 플레이한 흐름을 몇 초 만에 보여 준다.
 *
 *   node tools/sim.js                              # 적극적인 플레이어, 40시간
 *   node tools/sim.js --profile casual --hours 60
 *   node tools/sim.js --profile daily --days 30    # 하루 3번 20분씩 접속하는 플레이어
 *   node tools/sim.js --seed 7 --quiet
 *
 * 프로필: active(자주 누르며 플레이) / casual(가끔 누름) / idle(전혀 안 누르고 1분마다 구매만) / daily(하루 3번 접속)
 * data.js의 숫자를 바꾼 뒤 이걸 돌려서 해금 시점·졸업 주기가 어떻게 변하는지 확인한다.
 * 다른 스크립트에서는 require('./sim').simulate({ profile, hours, seed, tweak }) 로 쓸 수 있다. */
const { makeEngine, makeClock } = require('../tests/helper');

const PROFILES = {
  //        초당 클릭, 누르는 시간 비율, 스티커 수거율, 시험 응시율·정답률, 구매 간격(초), 한 스텝(초)
  active: { cps: 5, clickFrac: 0.4, sticker: 0.9, quiz: 0.9, acc: 0.85, buyEvery: 1, dt: 1 },
  casual: { cps: 3, clickFrac: 0.1, sticker: 0.5, quiz: 0.5, acc: 0.75, buyEvery: 5, dt: 1 },
  idle:   { cps: 0, clickFrac: 0,   sticker: 0,   quiz: 0,   acc: 0,    buyEvery: 60, dt: 5 },
};

function fmt(n) {
  if (n < 1e4) return n < 100 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
  const e = Math.floor(Math.log10(n));
  return (n / Math.pow(10, e)).toFixed(2) + 'e' + e;
}
function hms(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return (h ? h + '시간 ' : '') + m + '분' + (h ? '' : ' ' + Math.floor(sec % 60) + '초');
}

function simulate(o) {
  o = o || {};
  const profileName = o.profile || 'active';
  const daily = profileName === 'daily';
  const P = Object.assign({}, PROFILES[daily ? 'casual' : profileName], o.player || {});
  const HOURS = o.hours || 40;
  const QUIET = !!o.quiet;
  const GRAD_RATIO = o.grad || 0.5;          // 졸업 기준: 받을 졸업장 ≥ 가진 졸업장 × 이 값
  const TRY_CHALLENGES = o.challenges !== false;
  const NO_PRESTIGE = !!o.noPrestige;

  // 난수 고정 (재현 가능하게)
  const origRandom = Math.random;
  let seed = (o.seed || 1) >>> 0;
  Math.random = function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = function (a, b) { return a + Math.random() * (b - a); };

  const clock = makeClock(Date.UTC(2026, 0, 1, 9, 0, 0));
  const { game, D } = makeEngine({}, clock, o.tweak);
  const s = function () { return game.state; };
  const genOf = function (id) { return D.generators.find(function (g) { return g.id === id; }); };

  let T = 0;            // 시뮬레이션 경과(초, 접속하지 않은 시간 포함)
  let playT = 0;        // 실제로 접속해 있던 시간(초)
  const out = { log: [], marks: [], firstGen: {}, grads: [], challenges: [] };
  function note(msg) {
    const line = '[' + hms(T).padStart(13) + (daily ? ' | 플레이 ' + hms(playT) : '') + '] ' + msg;
    out.log.push(line);
    if (!QUIET) console.log(line);
  }

  // ---------- 구매 판단 ----------
  // 수입 추정: 시간표 평균 생산 + 손으로 누르는 수입
  function estimate() {
    const base = game.avgIncome();
    const st = s();
    if (!P.cps || st.challenge.active === 'noclick') return base;
    let mult = 1, frac = st.research.touch ? 0.03 : 0;
    for (const c of D.clickUpgrades) if (st.upgrades[c.id]) { if (c.mult) mult *= c.mult; if (c.lpsFrac) frac += c.lpsFrac; }
    const perClick = (mult * game.globalMult() + game.baseLps() * frac) * game.comboMax() * (1 + game.critChance() * (game.critMult() - 1));
    return base + P.cps * P.clickFrac * perClick;
  }
  // 후보마다 (가격 / 늘어나는 수입) + (모자란 돈을 모으는 시간)이 가장 작은 것을 고른다
  function chooseTarget() {
    const st = s();
    const cur = estimate();
    let best = null;
    const consider = function (kind, id, cost, after) {
      const gain = after - cur;
      if (!(gain > 0)) return;
      const wait = cost > st.light ? (cost - st.light) / Math.max(cur, 1e-9) : 0;
      const score = cost / gain + wait;
      if (!best || score < best.score) best = { kind: kind, id: id, cost: cost, score: score };
    };
    for (const g of D.generators) {
      if (game.genLocked(g.id)) continue;
      const cost = game.bulkCost(g, 1);
      st.gens[g.id]++;
      const after = estimate();
      st.gens[g.id]--;
      consider('gen', g.id, cost, after);
    }
    for (const u of game.visibleUpgrades()) {
      st.upgrades[u.id] = true;
      const after = estimate();
      delete st.upgrades[u.id];
      consider('upg', u.id, game.upgradeCost(u), after);
    }
    return best;
  }
  let target = null, lastChoose = -1e9;
  function shop() {
    for (let n = 0; n < 300; n++) {
      if (!target || T - lastChoose > 20) { target = chooseTarget(); lastChoose = T; }
      if (!target) return;
      const cost = target.kind === 'gen' ? game.bulkCost(genOf(target.id), 1) : target.cost;
      if (cost > s().light) return;
      const ok = target.kind === 'gen' ? game.buyGen(target.id, 1) : game.buyUpgrade(target.id);
      if (ok && target.kind === 'gen' && s().gens[target.id] === 1 && !(target.id in out.firstGen)) {
        out.firstGen[target.id] = playT;
        note('🆕 ' + genOf(target.id).name + ' 첫 구매 (누적 ' + fmt(s().allTime) + ', 초당 ' + fmt(game.baseLps()) + ')');
      }
      target = null;
    }
  }

  // ---------- 졸업·발전 계획·도전 ----------
  function buyResearch() {
    for (let n = 0; n < 50; n++) {
      const avail = D.research.filter(function (r) { return game.researchAvailable(r) && game.researchCost(r) <= game.coresFree(); });
      if (!avail.length) return;
      avail.sort(function (a, b) { return game.researchCost(a) - game.researchCost(b); });
      if (!game.buyResearch(avail[0].id)) return;
      if (!avail[0].repeat) note('   📜 발전 계획: ' + avail[0].name + ' (' + avail[0].cost + '장)');
    }
  }
  let lastRunBest = 0;
  function maybeGraduate() {
    const st = s();
    if (NO_PRESTIGE || st.challenge.active) return;
    const gain = game.prestigeGain();
    const want = Math.max(st.cores < 1 ? (o.firstGrad || 10) : 2, st.cores * GRAD_RATIO);
    if (gain < want || st.runSec < 600) return;
    const runSec = st.runSec, total = st.runTotal;
    lastRunBest = Math.max(lastRunBest, total);
    out.grads.push({ t: T, play: playT, gain: gain, runSec: runSec, runTotal: total });
    // 도전 학기: 지난 학기에 목표의 30배 이상을 벌었으면 도전
    if (TRY_CHALLENGES && game.challengeUnlocked()) {
      const c = D.challenges.find(function (x) { return !st.challenge.done[x.id] && lastRunBest >= x.goal * (o.challengeAt || 10); });
      if (c) {
        game.challengeStart(c.id);
        note('🎓 졸업 #' + s().prestiges + ' +' + gain + '장 (계 ' + s().cores + ') 학기 ' + hms(runSec) + ' → 🏅 도전 시작: ' + c.name);
        target = null; buyResearch();
        return;
      }
    }
    game.prestige();
    note('🎓 졸업 #' + s().prestiges + ': +' + gain + '장 (계 ' + s().cores + ', x' + game.coreMult().toFixed(1) + ') · 학기 길이 ' + hms(runSec) + ' · 학기 지식 ' + fmt(total));
    target = null;
    buyResearch();
  }

  // ---------- 한 스텝 ----------
  let nextSticker = rand(D.praise.firstDelaySec[0], D.praise.firstDelaySec[1]);
  let lastDay = '';
  function step(dt) {
    const st = s();
    const day = new Date(clock.now()).toISOString().slice(0, 10);
    if (day !== lastDay) { lastDay = day; game.attendance(day); }
    // 클릭: 누르는 구간과 쉬는 구간을 번갈아 (5분 주기)
    if (P.cps && (playT % 300) < P.clickFrac * 300) {
      const n = Math.round(P.cps * dt);
      for (let i = 0; i < n; i++) game.click();
    }
    game.tick(dt);
    clock.advance(dt * 1000);
    T += dt; playT += dt;
    // 칭찬 스티커
    nextSticker -= dt;
    if (nextSticker <= 0) {
      const cfg = game.praiseConfig();
      nextSticker = rand(cfg.delay[0], cfg.delay[1]);
      if (cfg.enabled) {
        if (Math.random() < P.sticker) {
          const r = game.claimBonus();
          if (r && r.minis) for (let i = 0; i < Math.round(r.minis * 0.75); i++) game.claimMini();
        } else if (cfg.auto) game.claimBonus({ auto: true });
      }
    }
    // 쪽지 시험
    if (P.quiz && game.quizReadyIn() === 0 && Math.random() < P.quiz * dt / 20) {
      const q = game.quizStart();
      if (q) game.quizAnswer(q, Math.random() < P.acc ? q.answer : null);
    }
    // 숙제
    for (let h = game.homeworkCurrent(); !h.finished && h.done; h = game.homeworkCurrent()) game.homeworkClaim();
    // 도전 결과
    game.drainEvents().forEach(function (ev) {
      const c = D.challenges.find(function (x) { return x.id === ev.id; });
      out.challenges.push({ id: ev.id, ok: ev.type === 'challengeDone', sec: s().runSec, play: playT });
      note(ev.type === 'challengeDone' ? '🏅 도전 통과: ' + c.name + ' (' + hms(s().runSec) + ' 걸림)' : '❌ 도전 실패: ' + c.name);
    });
    if (st.challenge.active && st.runSec > 4 * 3600) { note('🏳️ 도전 포기: ' + st.challenge.active); game.challengeAbandon(); }
    if (Math.floor(playT / P.buyEvery) !== Math.floor((playT - dt) / P.buyEvery)) { shop(); maybeGraduate(); buyResearch(); }
    if (Math.floor(playT / 5) !== Math.floor((playT - dt) / 5)) game.checkAchievements();
  }

  function snapshot() {
    const st = s();
    let top = '-';
    D.generators.forEach(function (g) { if (st.gens[g.id] > 0) top = g.name + ' ' + st.gens[g.id]; });
    out.marks.push({
      t: T, play: playT, all: st.allTime, lps: game.baseLps(), cores: st.cores, pres: st.prestiges, ach: game.achCount(), album: game.albumCount(),
      res: Object.keys(st.research).length, hw: st.homework.index, chal: Object.keys(st.challenge.done).length, top: top, mult: game.globalMult(),
    });
  }

  const t0 = Date.now();
  if (daily) {
    // 하루 3번(아침·오후·저녁) 20분씩 접속, 나머지는 오프라인 보상
    const SESSION = 20 * 60, GAPS = [5 * 3600, 5 * 3600, 14 * 3600 - 3 * SESSION];
    while (T < HOURS * 3600) {
      for (let k = 0; k < 3; k++) {
        for (let t = 0; t < SESSION; t += P.dt) step(P.dt);
        shop(); maybeGraduate(); buyResearch();
        game.save();
        clock.advance(GAPS[k] * 1000);
        T += GAPS[k];
        game.load();                        // 오프라인 보상
        target = null;
        if (k === 2) snapshot();
      }
    }
  } else {
    const mark = HOURS <= 12 ? 1800 : 3600;
    for (let next = mark; T < HOURS * 3600;) {
      step(P.dt);
      if (T >= next) { snapshot(); next += mark; }
    }
  }
  Math.random = origRandom;
  out.game = game; out.D = D; out.T = T; out.playT = playT; out.daily = daily; out.hours = HOURS; out.profile = profileName;
  out.calcSec = (Date.now() - t0) / 1000;
  return out;
}

function printSummary(r) {
  const game = r.game, D = r.D, st = game.state;
  console.log('\n=== 요약: 프로필 ' + r.profile + ', ' + (r.daily ? r.hours / 24 + '일' : r.hours + '시간') + ' (계산 ' + r.calcSec.toFixed(1) + '초) ===');
  console.log(['시점'.padEnd(8), '누적지식'.padStart(9), '초당'.padStart(9), '졸업장'.padStart(7), '졸업'.padStart(4), '배율'.padStart(9), '업적'.padStart(4), '앨범'.padStart(4), '계획'.padStart(4), '숙제'.padStart(4), '도전'.padStart(4), ' 최고 생산기'].join(' '));
  r.marks.forEach(function (m, i) {
    if (r.marks.length > 45 && i % Math.ceil(r.marks.length / 45)) return;
    console.log([(r.daily ? (m.t / 86400).toFixed(0) + '일' : (m.t / 3600).toFixed(1) + 'h').padEnd(8), fmt(m.all).padStart(9), fmt(m.lps).padStart(9), String(m.cores).padStart(7),
      String(m.pres).padStart(4), ('x' + fmt(m.mult)).padStart(9), String(m.ach).padStart(4), String(m.album).padStart(4), String(m.res).padStart(4), String(m.hw).padStart(4), String(m.chal).padStart(4), ' ' + m.top].join(' '));
  });
  console.log('\n최종: 누적 ' + fmt(st.allTime) + ' · 졸업 ' + st.prestiges + '회 · 졸업장 ' + st.cores + ' · 업적 ' + game.achCount() + '/' + D.achievements.length +
    ' · 앨범 ' + game.albumCount() + '/' + D.stickers.length + ' · 발전 계획 ' + Object.keys(st.research).length + '/' + D.research.length +
    ' · 숙제 ' + st.homework.index + '/' + D.homework.length + ' · 도전 ' + Object.keys(st.challenge.done).length + '/' + D.challenges.length +
    ' · 클릭 ' + st.clicks + ' · 스티커 ' + st.bonusClicks + ' · 시험 정답 ' + st.quiz.correct);
}

module.exports = { simulate: simulate, printSummary: printSummary, fmt: fmt, hms: hms };

if (require.main === module) {
  const args = {};
  process.argv.slice(2).forEach(function (a, i, arr) {
    if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true;
  });
  const profile = args.profile || 'active';
  if (profile !== 'daily' && !PROFILES[profile]) { console.error('모르는 프로필: ' + profile); process.exit(1); }
  printSummary(simulate({
    profile: profile,
    hours: profile === 'daily' ? Number(args.days || 30) * 24 : Number(args.hours || 40),
    seed: Number(args.seed || 1), quiet: !!args.quiet, grad: Number(args.grad || 0.5),
    challenges: args.challenges !== 'off', noPrestige: !!args['no-prestige'],
  }));
}
