/* 게임 상태와 규칙. DOM에 의존하지 않는다 → Node에서 단위 테스트(tests/)와 밸런스 시뮬레이션(tools/sim.js)을 돌릴 수 있다.
 *
 *   const game = Idddle.createEngine('save-key', { now: () => Date.now() });
 *
 * opts.now: 현재 시각(ms)을 돌려주는 함수. 시뮬레이션에서는 가짜 시계를 넣는다. */
window.Idddle = window.Idddle || {};

Idddle.createEngine = function (saveKey, opts) {
  opts = opts || {};
  const D = Idddle.DATA;
  const Q = Idddle.QUIZ || {};
  const C = D.click;
  const TT = D.timetable;
  const SAVE_VERSION = 3;
  const now = opts.now || function () { return Date.now(); };
  const api = {};
  const events = [];   // 엔진 안에서 일어난 일(도전 통과·실패 등). UI가 drainEvents()로 꺼내 간다

  // ============================================================ 색인
  const genById = {};
  D.generators.forEach(function (g) { genById[g.id] = g; });

  const upgrades = [], upgradeById = {}, tierUpg = {}, synUpg = {};
  D.generators.forEach(function (g) {
    tierUpg[g.id] = []; synUpg[g.id] = [];
    D.genUpgradeTiers.forEach(function (t, i) {
      const look = g.upgrades[i];
      const u = { id: g.id + '_' + i, kind: 'gen', gen: g.id, tier: i, need: t.need, name: look[1], icon: look[0], cost: g.baseCost * t.costMul };
      upgrades.push(u); tierUpg[g.id].push(u);
    });
  });
  D.synergies.forEach(function (x) {
    const u = { id: 'syn_' + x.id, kind: 'syn', gen: x.a, from: x.b, pct: x.pct, needA: x.needA, needB: x.needB, name: x.name, icon: x.icon, cost: genById[x.a].baseCost * x.costMul };
    upgrades.push(u); synUpg[x.a].push(u);
  });
  D.clickUpgrades.forEach(function (c) { upgrades.push(Object.assign({ kind: 'click' }, c)); });
  D.lunches.forEach(function (l) {
    upgrades.push({ id: 'lunch_' + l.id, kind: 'lunch', name: l.name, icon: l.icon, need: l.need, pct: l.pct, cost: l.need * D.LUNCH_COST_MUL });
  });
  upgrades.forEach(function (u) { upgradeById[u.id] = u; });

  const researchById = {}, challengeById = {}, stickerById = {}, stickersByRarity = {}, achById = {};
  D.research.forEach(function (r) { researchById[r.id] = r; });
  D.challenges.forEach(function (c) { challengeById[c.id] = c; });
  D.achievements.forEach(function (a) { achById[a.id] = a; });
  for (const r in D.rarities) stickersByRarity[r] = [];
  D.stickers.forEach(function (t) { stickerById[t.id] = t; stickersByRarity[t.rarity].push(t); });

  // ============================================================ 상태
  // 졸업하면 초기화되는 부분
  function freshRun() {
    const gens = {};
    D.generators.forEach(function (g) { gens[g.id] = 0; });
    return {
      light: 0,          // 지금 가진 지식
      runTotal: 0,       // 이번 학기에 얻은 지식
      gens: gens,
      upgrades: {},      // id -> true
      buffs: [],         // { id, name, kind: 'prod'|'click'|'cost', mult, left(초), total(초) }
      combo: 0,          // 집중력 0~100
      runSec: 0,         // 이번 학기 진행 시간(초)
      runClicks: 0,
      startedAt: now(),
    };
  }

  function freshState() {
    return Object.assign(freshRun(), {
      v: SAVE_VERSION,
      allTime: 0,        // 전체 누적 지식
      clicks: 0, crits: 0,
      cores: 0,          // 받은 졸업장 총량 (생산 보너스 기준)
      coresSpent: 0,     // 발전 계획에 쓴 졸업장
      research: {},      // id -> true | 레벨(반복 구매)
      prestiges: 0,
      bonusClicks: 0, bonusAuto: 0,
      achievements: {},  // id -> true
      flags: {},         // 숨겨진 업적 등의 표시
      album: {},         // 스티커 id -> 장수
      albumPity: 0, legendPity: 0,
      quiz: { readyAt: 0, correct: 0, asked: 0, wrong: 0, streak: 0, best: 0, subj: {} },   // subj: 과목 id -> [정답, 출제]
      attend: { last: '', streak: 0, total: 0 },
      homework: { index: 0 },
      challenge: { active: '', done: {} },
      stats: { playSec: 0, bestLps: 0, bestClick: 0, fastestGrad: 0, dupes: 0, minis: 0, genBought: 0 },
      settings: { notation: 'ko', sound: true, fx: true },
      clock: 0,          // 시간표용 게임 시계(초)
      firstAt: now(), lastTick: now(),
    });
  }

  let s = freshState();

  // ============================================================ 발전 계획 · 도전 효과
  function has(id) { return !!s.research[id]; }
  function lvl(id) { const v = s.research[id]; return v === true ? 1 : (Number(v) || 0); }
  function chOn(id) { return s.challenge.active === id; }
  function chDone(id) { return !!s.challenge.done[id]; }
  function coresFree() { return s.cores - s.coresSpent; }

  function researchCost(r) { return r.repeat ? Math.round(r.cost * Math.pow(r.growth, lvl(r.id))) : r.cost; }
  function researchAvailable(r) { return (r.repeat || !has(r.id)) && (!r.req || has(r.req)); }
  function buyResearch(id) {
    const r = researchById[id];
    if (!r || !researchAvailable(r)) return false;
    const c = researchCost(r);
    if (coresFree() < c) return false;
    s.coresSpent += c;
    s.research[id] = r.repeat ? lvl(id) + 1 : true;
    return true;
  }

  function offlineRate() { return has('awake') ? 1 : has('dream') ? 0.75 : D.OFFLINE_RATE; }
  function offlineCap() { return has('night2') ? 72 * 3600 : has('night') ? 24 * 3600 : D.OFFLINE_CAP_SEC; }

  // ============================================================ 배율
  function coreBonus() { return D.CORE_BONUS * (has('amplify2') ? 2 : has('amplify') ? 1.5 : 1) + (chDone('final') ? 0.01 : 0); }
  function coreMult() { return 1 + s.cores * coreBonus(); }
  function achCount() { return Object.keys(s.achievements).length; }
  function achMult() { return 1 + achCount() * D.ACH_BONUS; }

  function albumCount() { let n = 0; for (const t of D.stickers) if (s.album[t.id]) n++; return n; }
  function albumBonus() {
    let b = 0;
    const have = {};
    for (const t of D.stickers) {
      if (!s.album[t.id]) continue;
      b += D.rarities[t.rarity].pct;
      have[t.rarity] = (have[t.rarity] || 0) + 1;
    }
    for (const r in D.rarities) if (have[r] === stickersByRarity[r].length) b += D.rarities[r].setBonus;
    return b;
  }
  function albumMult() { return 1 + albumBonus(); }

  function lunchCount() { let n = 0; for (const l of D.lunches) if (s.upgrades['lunch_' + l.id]) n++; return n; }
  function lunchPct(l) { return l.pct * (has('lunch') ? 1.5 : 1); }
  function lunchMult() { let m = 1; for (const l of D.lunches) if (s.upgrades['lunch_' + l.id]) m *= 1 + lunchPct(l); return m; }
  function synergyCount() { let n = 0; for (const x of D.synergies) if (s.upgrades['syn_' + x.id]) n++; return n; }
  function synMult() { return (has('synergy') ? 1.5 : 1) * (chDone('strike') ? 1.25 : 1); }
  function hallMult() { return 1 + 0.1 * lvl('hall'); }
  function challengeMult() { return (chDone('speedrun') ? 1.25 : 1) * (chOn('final') ? 0.1 : 1); }

  function globalMult() { return coreMult() * achMult() * albumMult() * lunchMult() * hallMult() * challengeMult(); }
  // 화면에 보여 줄 배율 내역
  function multBreakdown() {
    return [
      { icon: '📜', name: '졸업장', mult: coreMult() },
      { icon: '🏆', name: '업적', mult: achMult() },
      { icon: '📔', name: '스티커 앨범', mult: albumMult() },
      { icon: '🍱', name: '급식', mult: lunchMult() },
      { icon: '🏛️', name: '명예의 전당', mult: hallMult() },
      { icon: '🏅', name: '도전 학기', mult: challengeMult() },
    ].filter(function (x) { return x.mult !== 1; });
  }

  function buffMult(kind) {
    let m = 1;
    for (const b of s.buffs) if (b.kind === kind) m *= b.mult;
    return m;
  }

  // ---------- 시간표 ----------
  function periodIndex() { return Math.floor(s.clock / TT.periodSec) % TT.periods.length; }
  function periodMult() { return has('extra2') ? 5 : has('extra') ? 3 : TT.boost; }
  function period() {
    const i = periodIndex();
    return { index: i, def: TT.periods[i], left: TT.periodSec - (s.clock % TT.periodSec), mult: periodMult() };
  }
  function genBoost(id) { return TT.periods[periodIndex()].gens.indexOf(id) >= 0 ? periodMult() : 1; }
  function periodClick() { return TT.periods[periodIndex()].click || 1; }
  // 한 바퀴 평균 배율 (오프라인 계산용): 모든 교실이 주기의 1/N 동안 boost배
  function periodAverage() { return 1 + (periodMult() - 1) / TT.periods.length; }

  // ---------- 생산 ----------
  function tierCount(id) { let k = 0; for (const u of tierUpg[id]) if (s.upgrades[u.id]) k++; return k; }
  function genMult(id) {
    let m = Math.pow(2, tierCount(id));
    const sm = synMult();
    for (const u of synUpg[id]) if (s.upgrades[u.id]) m *= 1 + u.pct * sm * s.gens[u.from];
    if (id === 'pencil' && chDone('nopencil')) m *= 10;
    return m;
  }
  // 1개가 1초에 만드는 양 (시간표·버프 제외)
  function genRate(g) { return g.rate * genMult(g.id) * globalMult(); }

  function sumGens(withPeriod) {
    const p = TT.periods[periodIndex()], pm = periodMult();
    let t = 0;
    for (const g of D.generators) {
      const n = s.gens[g.id];
      if (!n) continue;
      t += n * g.rate * genMult(g.id) * (withPeriod && p.gens.indexOf(g.id) >= 0 ? pm : 1);
    }
    return t * globalMult();
  }
  function baseLps() { return sumGens(false); }                     // 시간표·버프를 뺀 기본 생산
  function lps() { return sumGens(true) * buffMult('prod'); }       // 지금 이 순간의 생산

  // ---------- 클릭 ----------
  function clickParts() {
    let mult = 1, frac = has('touch') ? 0.03 : 0;
    for (const c of D.clickUpgrades) {
      if (!s.upgrades[c.id]) continue;
      if (c.mult) mult *= c.mult;
      if (c.lpsFrac) frac += c.lpsFrac;
    }
    return { mult: mult, frac: frac };
  }
  function clickBase() { const p = clickParts(); return p.mult * globalMult() + lps() * p.frac; }
  function comboMax() { return has('flow') ? 3 : C.comboMax; }
  function comboMult() { return 1 + (s.combo / 100) * (comboMax() - 1); }
  function critChance() { return has('eureka') ? 0.08 : C.critChance; }
  function critMult() { return chDone('noclick') ? 15 : C.critMult; }
  // 지금 한 번 누르면 얻는 양 (아하! 제외)
  function clickPower() {
    if (chOn('noclick')) return 0;
    return clickBase() * buffMult('click') * periodClick() * comboMult();
  }
  function autoCps() {
    if (chOn('noclick')) return 0;
    return has('auto3') ? 10 : has('auto2') ? 4 : has('auto1') ? 1 : 0;
  }
  function autoIncome() { const c = autoCps(); return c ? c * clickBase() * buffMult('click') * periodClick() : 0; }
  function income() { return lps() + autoIncome(); }                // 화면의 '초당'
  // 시간표 한 바퀴의 평균 수입 (긴 시간을 한꺼번에 계산할 때·오프라인 보상에 쓴다)
  function avgIncome() {
    const avgLps = baseLps() * periodAverage();
    const c = autoCps();
    if (!c) return avgLps;
    const p = clickParts();
    let pc = 0;
    for (const pd of TT.periods) pc += pd.click || 1;
    return avgLps + c * (p.mult * globalMult() + avgLps * p.frac) * (pc / TT.periods.length);
  }

  // ---------- 가격 ----------
  function growth() { return chOn('inflation') ? 1.25 : D.COST_GROWTH; }
  function genCostMult() {
    return (has('design') ? 0.9 : 1) * (has('design2') ? 0.9 : 1) * (chDone('inflation') ? 0.95 : 1) * buffMult('cost');
  }
  function upgradeCost(u) { return u.cost * (has('engine') ? 0.75 : 1); }
  function genLocked(id) { return (id === 'pencil' && chOn('nopencil')) || (id === 'teacher' && chOn('strike')); }

  // 지금 n개 가진 상태에서 k개 더 사는 값 (등비급수 합)
  function bulkCost(g, k) {
    const G = growth();
    return g.baseCost * genCostMult() * Math.pow(G, s.gens[g.id]) * (Math.pow(G, k) - 1) / (G - 1);
  }
  function maxAffordable(g) {
    const G = growth();
    const first = g.baseCost * genCostMult() * Math.pow(G, s.gens[g.id]);
    if (s.light < first) return 0;
    let k = Math.floor(Math.log(s.light * (G - 1) / first + 1) / Math.log(G));
    while (k > 0 && bulkCost(g, k) > s.light) k--;   // 부동소수 오차 보정
    return k;
  }

  // ============================================================ 행동
  function earn(x) {
    if (!(x > 0)) return;
    s.light += x; s.runTotal += x; s.allTime += x;
  }
  function spend(c) {
    s.light -= c;
    if (s.light < 1 && c >= 1000) s.flags.broke = true;
    if (s.light < 0) s.light = 0;
  }

  const clickTimes = [];        // 최근 클릭 시각 (번개 손가락 판정)
  let idleSec = 0, fullSec = 0; // 클릭 없이 지난 시간, 집중력 가득 유지 시간
  function click() {
    const crit = Math.random() < critChance();
    let p = clickPower();
    if (crit) p *= critMult();
    earn(p);
    s.clicks++; s.runClicks++;
    if (crit && p > 0) s.crits++;
    s.combo = Math.min(100, s.combo + C.comboGain);
    if (s.combo >= 100) s.flags.fullCombo = true;
    if (p > s.stats.bestClick) s.stats.bestClick = p;
    idleSec = 0;
    const t = now();
    clickTimes.push(t);
    if (clickTimes.length > 10) clickTimes.shift();
    if (clickTimes.length === 10 && t - clickTimes[0] <= 1000) s.flags.speed10 = true;
    return { amount: p, crit: crit && p > 0 };
  }

  function buyGen(id, amount) {
    const g = genById[id];
    if (!g || genLocked(id)) return false;
    const k = amount === 'max' ? maxAffordable(g) : Math.floor(amount);
    if (!(k > 0)) return false;
    const c = bulkCost(g, k);
    if (c > s.light) return false;
    spend(c);
    s.gens[id] += k;
    s.stats.genBought += k;
    return true;
  }

  function upgradeVisible(u) {
    if (s.upgrades[u.id]) return false;
    if (u.kind === 'gen') return s.gens[u.gen] >= u.need;
    if (u.kind === 'syn') return s.gens[u.gen] >= u.needA && s.gens[u.from] >= u.needB;
    if (u.kind === 'lunch') return s.runTotal >= u.need;
    return s.clicks >= u.needClicks;
  }
  function visibleUpgrades() {
    return upgrades.filter(upgradeVisible).sort(function (a, b) { return a.cost - b.cost; });
  }
  function buyUpgrade(id) {
    const u = upgradeById[id];
    if (!u || s.upgrades[id] || !upgradeVisible(u)) return false;
    const c = upgradeCost(u);
    if (s.light < c) return false;
    spend(c);
    s.upgrades[id] = true;
    return true;
  }
  // 살 수 있는 업그레이드를 싼 것부터 전부 산다. 반환: 산 업그레이드 목록
  function buyAllUpgrades() {
    const bought = [];
    for (;;) {
      const next = visibleUpgrades().find(function (u) { return upgradeCost(u) <= s.light; });
      if (!next || !buyUpgrade(next.id)) break;
      bought.push(next);
    }
    return bought;
  }
  // 지금 효과를 반영한 업그레이드 설명
  function upgradeDesc(u) {
    if (u.kind === 'gen') return genById[u.gen].name + ' 생산량 x2';
    if (u.kind === 'syn') {
      const A = genById[u.gen], B = genById[u.from], pct = u.pct * synMult() * 100;
      return A.name + ' 생산량 +' + +pct.toFixed(2) + '% (' + B.name + ' 1' + B.unit + '당) · 지금 +' + Math.round(pct * s.gens[u.from]) + '%';
    }
    if (u.kind === 'lunch') return '전체 생산 +' + Math.round(lunchPct(u) * 100) + '%';
    return u.desc;
  }

  // ---------- 시간 흐름 ----------
  function tick(dtSec) {
    if (!(dtSec > 0)) { s.lastTick = now(); return; }
    const cycle = TT.periodSec * TT.periods.length;
    let rest = dtSec, guard = 0;
    while (rest > 1e-9) {
      // 아주 긴 시간(백그라운드 탭에서 돌아왔을 때 등)은 시간표 여러 바퀴를 평균 수입으로 한꺼번에 계산
      if ((!s.buffs.length && rest > cycle * 2) || guard > 2000) {
        const span = guard > 2000 ? rest : (Math.floor(rest / cycle) - 1) * cycle;
        earn(avgIncome() * span);
        s.clock += span; s.runSec += span; s.stats.playSec += span;
        rest -= span;
        continue;
      }
      guard++;
      // 버프가 끝나거나 교시가 바뀌는 순간에서 구간을 끊어 정확히 계산
      let step = rest;
      for (const b of s.buffs) if (b.left < step) step = b.left;
      const toPeriod = TT.periodSec - (s.clock % TT.periodSec);
      if (toPeriod < step) step = toPeriod;
      if (!(step > 1e-6)) step = Math.min(rest, 1e-6);
      earn(income() * step);
      if (s.buffs.length) {
        for (const b of s.buffs) b.left -= step;
        s.buffs = s.buffs.filter(function (b) { return b.left > 1e-9; });
      }
      s.clock += step; s.runSec += step; s.stats.playSec += step;
      rest -= step;
    }
    s.combo = Math.max(0, s.combo - C.comboDecay * dtSec);
    idleSec += dtSec;
    if (idleSec >= 300) s.flags.patience = true;
    if (s.combo >= 90) { fullSec += dtSec; if (fullSec >= 60) s.flags.flow60 = true; } else fullSec = 0;
    checkChallenge();
    s.lastTick = now();
  }

  // ============================================================ 칭찬 스티커
  function praiseConfig() {
    const P = D.praise, k = has('magnet') ? 0.7 : 1;
    return {
      enabled: !chOn('quiet'),
      delay: [P.delaySec[0] * k, P.delaySec[1] * k],
      firstDelay: P.firstDelaySec,
      life: P.lifeSec * (has('linger') ? 2 : 1),
      power: (has('golden') ? 2 : 1) * (chDone('quiet') ? 1.5 : 1),
      auto: has('monitor'),
      minis: P.miniCount,
    };
  }
  function effectById(id) { return D.praise.effects.find(function (e) { return e.id === id; }); }
  function rollEffect() {
    const list = D.praise.effects;
    let r = Math.random() * list.reduce(function (a, e) { return a + e.weight; }, 0);
    for (const e of list) { r -= e.weight; if (r < 0) return e; }
    return list[0];
  }
  function addBuff(e, scale) {
    s.buffs = s.buffs.filter(function (b) { return b.id !== e.id; });   // 같은 버프는 갱신
    const sec = e.sec * scale;
    s.buffs.push({ id: e.id, name: e.name, kind: e.kind, mult: e.mult, left: sec, total: sec });
  }

  // 칭찬 스티커를 받는다. o.auto: 반장이 대신 받음(효과 절반), o.effect: 효과 지정(테스트용)
  // 반환: { effect, auto, amount?, gen?, count?, minis?, drops[] } — 조용한 학기에는 null
  function claimBonus(o) {
    o = o || {};
    if (chOn('quiet')) return null;
    const cfg = praiseConfig();
    const scale = cfg.power * (o.auto ? 0.5 : 1);
    let e = o.effect ? effectById(o.effect) : rollEffect();
    if (o.auto) s.bonusAuto++; else s.bonusClicks++;
    const out = { effect: e, auto: !!o.auto };

    if (e.id === 'rain' && o.auto) e = out.effect = effectById('lucky');   // 반장은 스티커 비를 지식으로 받는다
    if (e.id === 'gift') {
      // 가진 생산기 중 하나를 골라 보유량의 4%(최소 1개)를 공짜로
      const owned = D.generators.filter(function (g) { return s.gens[g.id] > 0 && !genLocked(g.id); });
      if (owned.length) {
        const g = owned[Math.floor(Math.random() * owned.length)];
        out.gen = g.id;
        out.count = Math.max(1, Math.round(Math.max(1, Math.ceil(s.gens[g.id] * D.praise.giftPct)) * scale));
        s.gens[g.id] += out.count;
      } else {
        e = out.effect = effectById('lucky');
      }
    }
    if (e.id === 'lucky') {
      const L = D.praise.lucky;
      out.amount = (Math.min(s.light * L.bank, baseLps() * L.capSec) + baseLps() * L.baseSec + 10) * scale;
      earn(out.amount);
    } else if (e.id === 'rain') {
      out.minis = cfg.minis;
    } else if (e.kind) {
      addBuff(e, scale);
    }
    // 앨범 스티커: 확률로 1장 (스티커 수집가 계획이 있으면 확률 2배)
    out.drops = Math.random() < D.praise.albumChance * (has('album1') && !o.auto ? 2 : 1) ? drawStickers(1) : [];
    return out;
  }
  // 스티커 비의 작은 스티커 하나
  function claimMini() {
    const amount = Math.max(5, baseLps() * D.praise.miniSec) * praiseConfig().power;
    earn(amount);
    s.stats.minis++;
    return amount;
  }

  // ============================================================ 스티커 앨범
  function rollRarity() {
    let total = 0;
    for (const r in D.rarities) total += D.rarities[r].weight;
    let x = Math.random() * total;
    for (const r in D.rarities) { x -= D.rarities[r].weight; if (x < 0) return r; }
    return 'common';
  }
  // 반환: { sticker, isNew, count, dupReward }
  function drawSticker() {
    let rar = rollRarity();
    let st = null;
    if (rar !== 'legend' && s.legendPity >= D.legendPity) {
      // 오랫동안 전설이 없었으면 아직 없는 전설을 보장
      const miss = stickersByRarity.legend.filter(function (t) { return !s.album[t.id]; });
      if (miss.length) { st = miss[Math.floor(Math.random() * miss.length)]; rar = 'legend'; }
    }
    if (rar === 'legend') s.legendPity = 0; else s.legendPity++;
    if (!st && rar !== 'legend' && s.albumPity >= D.albumPity) {
      // 한동안 새 스티커가 없었으면 아직 없는 것을 보장 (전설 제외)
      for (const r of [rar, 'common', 'rare', 'epic']) {
        const miss = stickersByRarity[r].filter(function (t) { return !s.album[t.id]; });
        if (miss.length) { st = miss[Math.floor(Math.random() * miss.length)]; break; }
      }
    }
    if (!st) { const pool = stickersByRarity[rar]; st = pool[Math.floor(Math.random() * pool.length)]; }
    const before = s.album[st.id] || 0;
    s.album[st.id] = before + 1;
    let dupReward = 0;
    if (before === 0) {
      s.albumPity = 0;
    } else {
      s.albumPity++;
      s.stats.dupes++;
      dupReward = Math.max(10, baseLps() * D.albumDupSec);   // 이미 있는 스티커는 지식으로
      earn(dupReward);
    }
    return { sticker: st, isNew: before === 0, count: before + 1, dupReward: dupReward };
  }
  function drawStickers(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(drawSticker());
    return out;
  }

  // ============================================================ 쪽지 시험
  function quizCooldown() { return D.quiz.cooldownSec * (has('cram') ? 0.6 : 1); }
  function quizReadyIn() { return chOn('quiet') ? Infinity : Math.max(0, s.quiz.readyAt - now()); }
  function quizSubjects() {
    const gi = grade().index;
    return D.quiz.subjects.filter(function (sb) { return gi >= sb.grade && (sb.id === 'math' || (Q[sb.id] && Q[sb.id].length)); });
  }

  const recent = {};   // 과목별 최근 출제 번호 (같은 문제가 바로 또 나오지 않게)
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pickIndex(subject, n) {
    const r = recent[subject] || (recent[subject] = []);
    let i, tries = 0;
    do { i = Math.floor(Math.random() * n); } while (r.indexOf(i) >= 0 && ++tries < 30);
    r.push(i);
    if (r.length > Math.min(15, n - 1)) r.shift();
    return i;
  }
  // pool에서 정답과 겹치지 않는 보기 k개
  function distractors(pool, k, taken) {
    const out = [];
    let guard = 0;
    while (out.length < k && guard++ < 200) {
      const v = pool[Math.floor(Math.random() * pool.length)];
      if (taken.indexOf(v) < 0 && out.indexOf(v) < 0) out.push(v);
    }
    return out;
  }
  function eulReul(word) {   // 을/를
    const c = word.charCodeAt(word.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return '을(를)';
    return (c - 0xAC00) % 28 ? '을' : '를';
  }

  function buildMath() {
    const lv = Math.min(5, Math.floor(((s.quiz.subj.math || [0])[0]) / 4));
    const type = ri(0, lv >= 2 ? 3 : lv >= 1 ? 2 : 1);
    let text, answer;
    if (type === 0) { const a = ri(2, 9 + lv * 18), b = ri(2, 9 + lv * 18); text = a + ' + ' + b; answer = a + b; }
    else if (type === 1) { const a = ri(10, 20 + lv * 25), b = ri(1, a); text = a + ' − ' + b; answer = a - b; }
    else if (type === 2) { const a = ri(2, 9), b = ri(2, 9 + lv * 2); text = a + ' × ' + b; answer = a * b; }
    else { const b = ri(2, 9), q = ri(2, 9 + lv * 2); text = (b * q) + ' ÷ ' + b; answer = q; }
    const set = [answer];
    let guard = 0;
    while (set.length < 4 && guard++ < 200) {
      const v = answer + ri(1, Math.max(3, Math.ceil(answer * 0.2))) * (Math.random() < 0.5 ? -1 : 1);
      if (v >= 0 && set.indexOf(v) < 0) set.push(v);
    }
    return { text: text + ' = ?', choices: set.map(String), answer: String(answer) };
  }
  function buildQuestion(subject) {
    const bank = Q[subject];
    if (subject === 'math') return buildMath();
    const row = bank[pickIndex(subject, bank.length)];
    if (subject === 'english') {
      const toKo = Math.random() < 0.5;
      const answer = toKo ? row[1] : row[0];
      const pool = bank.map(function (r) { return toKo ? r[1] : r[0]; });
      return {
        text: toKo ? '“' + row[0] + '”의 뜻은?' : '“' + row[1] + '”' + eulReul(row[1]) + ' 영어로 하면?',
        choices: [answer].concat(distractors(pool, 3, [answer])), answer: answer,
      };
    }
    if (subject === 'capitals') {
      const wrong = row[2] ? [row[2]] : [];
      const pool = bank.map(function (r) { return r[1]; });
      return { text: row[0] + '의 수도는?', choices: [row[1]].concat(wrong, distractors(pool, 3 - wrong.length, [row[1]].concat(wrong))), answer: row[1] };
    }
    if (subject === 'spelling') {
      return { text: row[2] || '어느 쪽이 맞는 표기일까요?', hint: row[2] ? '빈칸에 들어갈 맞는 표기는?' : '', choices: [row[0], row[1]], answer: row[0] };
    }
    // science, proverbs: [문제, 정답, 오답 3개]
    return { text: row[0], hint: subject === 'proverbs' ? '빈칸에 들어갈 말은?' : '', choices: row.slice(1, 5), answer: row[1] };
  }

  // 문제를 내고 대기 시간을 시작한다(창을 닫아도 대기 시간은 흐른다). 아직이면 null.
  // 반환: { subject, subjectName, icon, text, hint, choices[], answer, timeSec }
  function quizStart(subjectId) {
    if (quizReadyIn() > 0) return null;
    const list = quizSubjects();
    const sb = (subjectId && list.find(function (x) { return x.id === subjectId; })) || list[Math.floor(Math.random() * list.length)];
    const q = buildQuestion(sb.id);
    shuffle(q.choices);
    q.subject = sb.id; q.subjectName = sb.name; q.icon = sb.icon;
    q.timeSec = sb.id === 'math' ? D.quiz.timeSec : D.quiz.timeSec + 3;
    s.quiz.readyAt = now() + quizCooldown() * 1000;
    s.quiz.asked++;
    const rec = s.quiz.subj[sb.id] || (s.quiz.subj[sb.id] = [0, 0]);
    rec[1]++;
    return q;
  }
  // 반환: { ok, reward, streak, drop }
  function quizAnswer(q, picked) {
    const st = s.quiz;
    const ok = picked != null && String(picked) === String(q.answer);
    if (!ok) { st.streak = 0; st.wrong++; return { ok: false, reward: 0, streak: 0, drop: null }; }
    st.correct++; st.streak++;
    st.best = Math.max(st.best, st.streak);
    const rec = st.subj[q.subject] || (st.subj[q.subject] = [0, 1]);
    rec[0]++;
    const reward = Math.max(D.quiz.rewardMin, baseLps() * D.quiz.rewardSec) * (1 + 0.1 * Math.min(st.streak, 10)) * (has('notes') ? 2 : 1);
    earn(reward);
    const drop = Math.random() < D.quiz.stickerChance ? drawSticker() : null;
    return { ok: true, reward: reward, streak: st.streak, drop: drop };
  }

  // ============================================================ 출석
  function prevDay(day) {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  // day: 'YYYY-MM-DD' (사용자 현지 날짜). 오늘 이미 출석했으면 null
  function attendance(day) {
    const a = s.attend, A = D.attendance;
    if (!day || a.last === day) return null;
    a.streak = a.last === prevDay(day) ? a.streak + 1 : 1;
    a.last = day;
    a.total++;
    const reward = Math.max(A.rewardMin, baseLps() * A.rewardSec) * Math.min(a.streak, A.maxStreakBonus);
    earn(reward);
    const drops = drawStickers(a.streak % 7 === 0 ? A.weekStickers : A.stickers);
    return { streak: a.streak, total: a.total, reward: reward, drops: drops };
  }

  // ============================================================ 숙제
  function homeworkAmount(r) {
    if (r.stickers) return 0;
    return Math.max(r.min || 0, r.gen ? genById[r.gen].baseCost * r.frac : 0, baseLps() * (r.sec || 0));
  }
  function homeworkCurrent() {
    const list = D.homework, i = s.homework.index;
    if (i >= list.length) return { index: list.length, total: list.length, finished: true };
    const t = list[i], p = t.prog(s, api);
    const cur = Math.max(0, Math.min(Number(p[0]) || 0, p[1]));
    return {
      index: i, total: list.length, finished: false, task: t, cur: cur, target: p[1], done: cur >= p[1],
      stickers: t.reward.stickers || 0, amount: homeworkAmount(t.reward),
    };
  }
  // 반환: { task, amount, drops } | null
  function homeworkClaim() {
    const h = homeworkCurrent();
    if (h.finished || !h.done) return null;
    const out = { task: h.task, amount: h.amount, drops: [] };
    if (h.stickers) out.drops = drawStickers(h.stickers);
    else earn(h.amount);
    s.homework.index++;
    return out;
  }

  // ============================================================ 졸업
  function diplomaScale() { return D.prestige.scale * (has('early') ? 1.25 : 1); }
  function diplomaTotal() { return Math.floor(diplomaScale() * Math.pow(s.allTime / D.prestige.divisor, D.prestige.power) + 1e-9); }
  function prestigeUnlocked() { return s.allTime >= D.prestige.unlockAt; }
  function prestigeGain() { return prestigeUnlocked() ? Math.max(0, diplomaTotal() - s.cores) : 0; }
  // 졸업장을 1장 더 받으려면 필요한 전체 누적 지식
  function nextDiplomaAt() {
    const target = Math.max(s.cores, diplomaTotal()) + 1;
    return Math.pow(target / diplomaScale(), 1 / D.prestige.power) * D.prestige.divisor;
  }

  // 다음 졸업장까지의 진행도 0~1 (지식이 곱절로 늘어야 해서 로그 눈금으로 잰다)
  function diplomaProgress() {
    const t = Math.max(s.cores, diplomaTotal()), p = D.prestige.power;
    const at = function (n) { return Math.pow(n / diplomaScale(), 1 / p) * D.prestige.divisor; };
    const lo = at(t), hi = at(t + 1);
    if (!(s.allTime > lo)) return 0;
    return Math.max(0, Math.min(1, Math.log(s.allTime / lo) / Math.log(hi / lo)));
  }

  function give(id, n) { if (!genLocked(id)) s.gens[id] = Math.max(s.gens[id], n); }
  // 새 학기를 시작한다. gain: 받을 졸업장, challengeId: 걸 도전 규칙
  function resetRun(gain, challengeId) {
    if (gain > 0) {
      s.cores += gain;
      s.prestiges++;
      const sec = Math.max(1, Math.round(s.runSec));
      if (!s.stats.fastestGrad || sec < s.stats.fastestGrad) s.stats.fastestGrad = sec;
    }
    Object.assign(s, freshRun());
    s.challenge.active = challengeId || '';
    if (has('legacy')) { s.light = 1000; give('pencil', 10); }
    if (has('legacy2')) ['pencil', 'student', 'teacher'].forEach(function (id) { give(id, 25); });
    if (has('legacy3')) D.generators.slice(0, 7).forEach(function (g) { give(g.id, 50); });
    idleSec = 0; fullSec = 0;
  }
  function prestige() {
    const gain = prestigeGain();
    if (gain < 1) return 0;
    resetRun(gain, '');
    save();
    return gain;
  }

  // ============================================================ 도전 학기
  function challengeUnlocked() { return s.prestiges >= D.challengeUnlock; }
  function activeChallenge() { return s.challenge.active ? challengeById[s.challenge.active] || null : null; }
  function challengeStart(id) {
    const c = challengeById[id];
    if (!c || !challengeUnlocked() || s.challenge.active || s.challenge.done[id]) return false;
    resetRun(prestigeGain(), id);   // 지금 학기는 졸업 처리 (졸업장은 받는다)
    save();
    return true;
  }
  function challengeAbandon() {
    if (!s.challenge.active) return false;
    s.challenge.active = '';
    return true;
  }
  function checkChallenge() {
    const c = activeChallenge();
    if (!c) return;
    if (s.runTotal >= c.goal) {
      s.challenge.done[c.id] = true;
      s.challenge.active = '';
      events.push({ type: 'challengeDone', id: c.id, drops: drawStickers(D.challengeStickers) });
    } else if (c.timeLimit && s.runSec > c.timeLimit) {
      s.challenge.active = '';
      events.push({ type: 'challengeFail', id: c.id });
    }
  }
  function drainEvents() { return events.splice(0, events.length); }

  // ============================================================ 학년 · 업적
  function grade() {
    let i = 0;
    for (let k = D.grades.length - 1; k >= 0; k--) if (s.allTime >= D.grades[k].at) { i = k; break; }
    return { index: i, name: D.grades[i].name, next: D.grades[i + 1] || null };
  }
  function setFlag(id) { s.flags[id] = true; }

  function checkAchievements() {
    const cur = baseLps();
    if (cur > s.stats.bestLps) s.stats.bestLps = cur;
    const got = [];
    for (const a of D.achievements) {
      if (!s.achievements[a.id] && a.cond(s, api)) { s.achievements[a.id] = true; got.push(a); }
    }
    return got;
  }

  // ============================================================ 저장
  function save() {
    s.lastTick = now();
    try { localStorage.setItem(saveKey, JSON.stringify(s)); } catch (e) { /* 저장할 수 없는 환경이면 넘어간다 */ }
  }

  function num(v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; }
  function int(v) { return Math.floor(num(v)); }
  function flagsOf(src, known) {
    const out = {};
    if (src && typeof src === 'object') for (const k in src) if (src[k] && (!known || known[k])) out[k] = true;
    return out;
  }

  // 저장 데이터를 지금 형식으로 맞춘다. 모르는 항목은 버리고, 깨진 숫자(NaN 등)는 0으로 되돌린다.
  function normalize(data) {
    if (!data || typeof data !== 'object' || !data.gens || typeof data.gens !== 'object') return null;
    const out = freshState();
    ['light', 'runTotal', 'allTime', 'cores', 'coresSpent', 'clock', 'runSec'].forEach(function (k) { out[k] = num(data[k]); });
    ['clicks', 'crits', 'prestiges', 'bonusClicks', 'bonusAuto', 'runClicks', 'albumPity', 'legendPity'].forEach(function (k) { out[k] = int(data[k]); });
    if (out.runTotal > out.allTime) out.allTime = out.runTotal;
    for (const id in out.gens) out.gens[id] = int(data.gens[id]);
    out.upgrades = flagsOf(data.upgrades, upgradeById);
    out.achievements = flagsOf(data.achievements, achById);
    out.flags = flagsOf(data.flags);
    if (data.research && typeof data.research === 'object') {
      for (const id in data.research) {
        const r = researchById[id];
        if (!r || !data.research[id]) continue;
        out.research[id] = r.repeat ? Math.max(1, int(data.research[id] === true ? 1 : data.research[id])) : true;
      }
    }
    if (data.album && typeof data.album === 'object') {
      for (const id in data.album) if (stickerById[id] && int(data.album[id]) > 0) out.album[id] = int(data.album[id]);
    }
    const q = data.quiz && typeof data.quiz === 'object' ? data.quiz : {};
    ['correct', 'asked', 'wrong', 'streak', 'best'].forEach(function (k) { out.quiz[k] = int(q[k]); });
    out.quiz.readyAt = num(q.readyAt);
    if (q.subj && typeof q.subj === 'object') {
      D.quiz.subjects.forEach(function (sb) {
        const v = q.subj[sb.id];
        if (Array.isArray(v)) out.quiz.subj[sb.id] = [int(v[0]), int(v[1])];
      });
    }
    const a = data.attend && typeof data.attend === 'object' ? data.attend : {};
    out.attend = { last: /^\d{4}-\d{2}-\d{2}$/.test(a.last) ? a.last : '', streak: int(a.streak), total: int(a.total) };
    out.homework.index = Math.min(D.homework.length, int(data.homework && data.homework.index));
    const ch = data.challenge && typeof data.challenge === 'object' ? data.challenge : {};
    out.challenge.done = flagsOf(ch.done, challengeById);
    out.challenge.active = challengeById[ch.active] && !out.challenge.done[ch.active] ? ch.active : '';
    const st = data.stats && typeof data.stats === 'object' ? data.stats : {};
    for (const k in out.stats) out.stats[k] = num(st[k]);
    const se = data.settings && typeof data.settings === 'object' ? data.settings : {};
    out.settings.notation = ['ko', 'en', 'sci'].indexOf(se.notation) >= 0 ? se.notation : 'ko';
    out.settings.sound = se.sound !== false;
    out.settings.fx = se.fx !== false;
    ['startedAt', 'firstAt', 'lastTick'].forEach(function (k) { if (isFinite(Number(data[k])) && Number(data[k]) > 0) out[k] = Number(data[k]); });
    out.combo = 0;
    out.buffs = [];   // 버프는 자리를 비운 동안 이어지지 않는다
    return out;
  }

  // 자리를 비운 동안의 생산. 반환: { seconds, away, earned, rate, capped } | null
  function applyOffline() {
    const t = now();
    const away = (t - s.lastTick) / 1000;
    s.lastTick = t;
    if (!(away >= 30)) return null;
    const sec = Math.min(away, offlineCap());
    const earned = avgIncome() * sec * offlineRate();
    earn(earned);
    s.clock += sec;
    s.runSec += away;
    checkChallenge();
    return { seconds: sec, away: away, earned: earned, rate: offlineRate(), capped: away > sec };
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(saveKey); } catch (e) { /* 무시 */ }
    if (!raw) return null;
    let data = null;
    try { data = normalize(JSON.parse(raw)); } catch (e) { /* 무시 */ }
    if (!data) return null;
    s = data;
    return applyOffline();
  }

  // 내보내기: 다른 기기로 옮길 수 있는 문자열
  function exportSave() {
    s.lastTick = now();
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  }
  function importSave(str) {
    let data = null;
    try { data = normalize(JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))))); } catch (e) { /* 무시 */ }
    if (!data) return false;
    data.lastTick = now();
    s = data;
    save();
    return true;
  }

  function hardReset() {
    const settings = s.settings;
    s = freshState();
    s.settings = settings;
    events.length = 0;
    try { localStorage.removeItem(saveKey); } catch (e) { /* 무시 */ }
  }

  // getter(state)를 살리려고 Object.assign 대신 디스크립터로 복사한다
  return Object.defineProperties(api, Object.getOwnPropertyDescriptors({
    get state() { return s; },
    upgrades: upgrades, research: D.research,
    // 생산·클릭
    lps: lps, baseLps: baseLps, income: income, avgIncome: avgIncome, autoCps: autoCps, autoIncome: autoIncome,
    genRate: genRate, genMult: genMult, genBoost: genBoost, tierCount: tierCount,
    clickPower: clickPower, comboMult: comboMult, comboMax: comboMax, critChance: critChance, critMult: critMult,
    globalMult: globalMult, coreMult: coreMult, coreBonus: coreBonus, achMult: achMult, albumMult: albumMult, albumBonus: albumBonus,
    lunchMult: lunchMult, hallMult: hallMult, synMult: synMult, buffMult: buffMult, multBreakdown: multBreakdown,
    // 구매
    bulkCost: bulkCost, maxAffordable: maxAffordable, genLocked: genLocked,
    upgradeCost: upgradeCost, upgradeVisible: upgradeVisible, visibleUpgrades: visibleUpgrades, upgradeDesc: upgradeDesc,
    click: click, buyGen: buyGen, buyUpgrade: buyUpgrade, buyAllUpgrades: buyAllUpgrades, tick: tick,
    // 시간표
    period: period, periodMult: periodMult,
    // 칭찬 스티커 · 앨범
    praiseConfig: praiseConfig, claimBonus: claimBonus, claimMini: claimMini,
    drawStickers: drawStickers, albumCount: albumCount,
    // 쪽지 시험 · 출석 · 숙제
    quizReadyIn: quizReadyIn, quizCooldown: quizCooldown, quizSubjects: quizSubjects, quizStart: quizStart, quizAnswer: quizAnswer,
    attendance: attendance, homeworkCurrent: homeworkCurrent, homeworkClaim: homeworkClaim,
    // 졸업 · 발전 계획 · 도전
    prestigeUnlocked: prestigeUnlocked, prestigeGain: prestigeGain, diplomaTotal: diplomaTotal, nextDiplomaAt: nextDiplomaAt, diplomaProgress: diplomaProgress, prestige: prestige,
    has: has, lvl: lvl, coresFree: coresFree, researchCost: researchCost, researchAvailable: researchAvailable, buyResearch: buyResearch,
    challengeUnlocked: challengeUnlocked, activeChallenge: activeChallenge, challengeStart: challengeStart, challengeAbandon: challengeAbandon,
    drainEvents: drainEvents,
    // 기타
    grade: grade, setFlag: setFlag, achCount: achCount, checkAchievements: checkAchievements,
    lunchCount: lunchCount, synergyCount: synergyCount, offlineRate: offlineRate, offlineCap: offlineCap,
    save: save, load: load, exportSave: exportSave, importSave: importSave, hardReset: hardReset,
  }));
};
