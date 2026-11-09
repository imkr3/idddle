/* 게임 상태와 규칙. DOM에 의존하지 않는다. */
window.Idddle = window.Idddle || {};

Idddle.createEngine = function (saveKey) {
  const D = Idddle.DATA;
  const G = D.COST_GROWTH;

  // 업그레이드 목록 생성 (생산기 티어 + 클릭)
  const upgrades = [];
  D.generators.forEach(function (g) {
    D.genUpgradeTiers.forEach(function (t, i) {
      upgrades.push({
        id: g.id + '_' + i, kind: 'gen', gen: g.id, need: t.need,
        name: g.name + ' ' + t.suffix, icon: g.icon,
        cost: g.baseCost * t.costMul, desc: g.name + ' 생산량 x2',
      });
    });
  });
  D.clickUpgrades.forEach(function (c) {
    upgrades.push(Object.assign({ kind: 'click' }, c));
  });
  const upgradeById = {};
  upgrades.forEach(function (u) { upgradeById[u.id] = u; });

  function freshState() {
    const gens = {};
    D.generators.forEach(function (g) { gens[g.id] = 0; });
    return {
      light: 0,          // 현재 보유 별가루
      runTotal: 0,       // 이번 회차 누적 획득량 (환생 계산용)
      allTime: 0,        // 전체 누적
      clicks: 0,
      gens: gens,
      upgrades: {},      // id -> true
      cores: 0,          // 성핵 (환생 화폐)
      prestiges: 0,
      bonusClicks: 0,
      achievements: {},  // id -> true (환생해도 유지)
      buffs: [],         // { id, name, kind: 'prod'|'click', mult, left(초), total(초) }
      startedAt: Date.now(),
      lastTick: Date.now(),
    };
  }

  let s = freshState();

  // ---------- 계산 ----------
  function achCount() { return Object.keys(s.achievements).length; }
  function globalMult() { return (1 + s.cores * D.CORE_BONUS) * (1 + achCount() * D.ACH_BONUS); }
  function buffMult(kind) {
    let m = 1;
    for (const b of s.buffs) if (b.kind === kind) m *= b.mult;
    return m;
  }

  function genMult(id) {
    let m = 1;
    for (const u of upgrades) if (u.kind === 'gen' && u.gen === id && s.upgrades[u.id]) m *= 2;
    return m;
  }

  function genRate(g) { return g.rate * genMult(g.id) * globalMult(); } // 1개당 초당
  function baseLps() {
    let t = 0;
    for (const g of D.generators) t += s.gens[g.id] * genRate(g);
    return t;
  }
  function lps() { return baseLps() * buffMult('prod'); }

  function clickPower() {
    let base = 1, frac = 0;
    for (const c of D.clickUpgrades) {
      if (!s.upgrades[c.id]) continue;
      if (c.mult) base *= c.mult;
      if (c.lpsFrac) frac += c.lpsFrac;
    }
    return (base * globalMult() + lps() * frac) * buffMult('click');
  }

  // 현재 n개 보유 상태에서 k개 더 사는 비용 (등비급수 합)
  function bulkCost(g, k) {
    const n = s.gens[g.id];
    return g.baseCost * Math.pow(G, n) * (Math.pow(G, k) - 1) / (G - 1);
  }
  function maxAffordable(g) {
    const n = s.gens[g.id];
    const first = g.baseCost * Math.pow(G, n);
    if (s.light < first) return 0;
    return Math.floor(Math.log(s.light * (G - 1) / first + 1) / Math.log(G));
  }

  function prestigeGain() {
    return Math.floor(Math.sqrt(s.runTotal / D.PRESTIGE_DIVISOR));
  }

  function upgradeVisible(u) {
    if (s.upgrades[u.id]) return false;
    if (u.kind === 'gen') return s.gens[u.gen] >= u.need;
    return s.clicks >= u.needClicks;
  }

  // ---------- 행동 ----------
  function earn(x) { s.light += x; s.runTotal += x; s.allTime += x; }

  function click() { const p = clickPower(); earn(p); s.clicks++; return p; }

  function buyGen(id, amount) {
    const g = D.generators.find(function (x) { return x.id === id; });
    let k = amount === 'max' ? maxAffordable(g) : amount;
    if (k <= 0) return false;
    const c = bulkCost(g, k);
    if (c > s.light) return false;
    s.light -= c;
    s.gens[id] += k;
    return true;
  }

  function buyUpgrade(id) {
    const u = upgradeById[id];
    if (!u || s.upgrades[id] || !upgradeVisible(u) || s.light < u.cost) return false;
    s.light -= u.cost;
    s.upgrades[id] = true;
    return true;
  }

  function prestige() {
    const gain = prestigeGain();
    if (gain < 1) return 0;
    const keep = {
      cores: s.cores + gain, allTime: s.allTime, clicks: s.clicks, prestiges: s.prestiges + 1,
      bonusClicks: s.bonusClicks, achievements: s.achievements,
    };
    s = freshState();
    Object.assign(s, keep);
    save();
    return gain;
  }

  function tick(dtSec) {
    if (dtSec > 0) {
      // 버프가 tick 도중 끝나도 정확하도록 버프 종료 시점 기준으로 구간을 나눠 계산
      let rest = dtSec;
      while (rest > 0) {
        let step = rest;
        for (const b of s.buffs) if (b.kind === 'prod') step = Math.min(step, b.left);
        earn(lps() * step);
        s.buffs.forEach(function (b) { b.left -= step; });
        s.buffs = s.buffs.filter(function (b) { return b.left > 1e-9; });
        rest -= step;
      }
    }
    s.lastTick = Date.now();
  }

  // ---------- 보너스 별 ----------
  function rollBonus() {
    const list = D.bonusStar.effects;
    let r = Math.random() * list.reduce(function (a, e) { return a + e.weight; }, 0);
    for (const e of list) { r -= e.weight; if (r < 0) return e; }
    return list[0];
  }

  // 보너스 별 클릭 처리. 반환: { effect, amount? }
  function claimBonus() {
    const e = rollBonus();
    s.bonusClicks++;
    if (e.id === 'lucky') {
      const amount = Math.min(s.light * 0.15, baseLps() * 900) + 77 + clickPower() * 20;
      earn(amount);
      return { effect: e, amount: amount };
    }
    s.buffs = s.buffs.filter(function (b) { return b.id !== e.id; });  // 같은 버프는 갱신
    s.buffs.push({ id: e.id, name: e.name, kind: e.kind, mult: e.mult, left: e.sec, total: e.sec });
    return { effect: e };
  }

  // ---------- 업적 ----------
  const engineApi = {};
  function checkAchievements() {
    const got = [];
    for (const a of D.achievements) {
      if (!s.achievements[a.id] && a.cond(s, engineApi)) { s.achievements[a.id] = true; got.push(a); }
    }
    return got;
  }

  // ---------- 저장 ----------
  function save() {
    s.lastTick = Date.now();
    try { localStorage.setItem(saveKey, JSON.stringify(s)); } catch (e) { /* 저장 불가 환경 무시 */ }
  }

  // 불러오기 + 오프라인 보상 계산. 반환값: { seconds, earned }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(saveKey); } catch (e) {}
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      const base = freshState();
      s = Object.assign(base, data);
      s.gens = Object.assign(freshState().gens, data.gens || {});
      s.upgrades = data.upgrades || {};
      s.achievements = data.achievements || {};
      s.buffs = [];   // 버프는 오프라인 동안 이어지지 않음
    } catch (e) { s = freshState(); return null; }

    const away = Math.min((Date.now() - s.lastTick) / 1000, D.OFFLINE_CAP_SEC);
    if (away < 30) return null;
    const earned = lps() * away * D.OFFLINE_RATE;
    if (earned > 0) earn(earned);
    s.lastTick = Date.now();
    return { seconds: away, earned: earned };
  }

  function hardReset() {
    s = freshState();
    try { localStorage.removeItem(saveKey); } catch (e) {}
  }

  // getter(state)를 살리기 위해 Object.assign 대신 디스크립터로 복사
  return Object.defineProperties(engineApi, Object.getOwnPropertyDescriptors({
    get state() { return s; },
    baseLps: baseLps, buffMult: buffMult, achCount: achCount, claimBonus: claimBonus, checkAchievements: checkAchievements,
    upgrades: upgrades,
    lps: lps, clickPower: clickPower, genRate: genRate,
    bulkCost: bulkCost, maxAffordable: maxAffordable,
    prestigeGain: prestigeGain, globalMult: globalMult, upgradeVisible: upgradeVisible,
    click: click, buyGen: buyGen, buyUpgrade: buyUpgrade, prestige: prestige,
    tick: tick, save: save, load: load, hardReset: hardReset,
  }));
};
