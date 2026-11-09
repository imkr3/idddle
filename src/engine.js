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

  const SAVE_VERSION = 2;

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
      v: SAVE_VERSION,
      cores: 0,          // 지금까지 얻은 성핵 총량 (생산 보너스 기준)
      coresSpent: 0,     // 연구에 쓴 성핵
      research: {},      // id -> true (환생해도 유지)
      settings: { notation: 'ko', sound: true },
      prestiges: 0,
      bonusClicks: 0,
      achievements: {},  // id -> true (환생해도 유지)
      buffs: [],         // { id, name, kind: 'prod'|'click', mult, left(초), total(초) }
      startedAt: Date.now(),
      lastTick: Date.now(),
    };
  }

  let s = freshState();

  // ---------- 연구 효과 ----------
  const researchById = {};
  D.research.forEach(function (r) { researchById[r.id] = r; });
  function has(id) { return !!s.research[id]; }
  function coresFree() { return s.cores - s.coresSpent; }
  function coreBonus() { return has('amplify') ? 0.15 : D.CORE_BONUS; }
  function genCostMult() { return has('design') ? 0.9 : 1; }
  function upgradeCost(u) { return u.cost * (has('engine') ? 0.75 : 1); }
  function offlineRate() { return has('awake') ? 1 : has('dream') ? 0.75 : D.OFFLINE_RATE; }
  function offlineCap() { return has('night') ? 24 * 3600 : D.OFFLINE_CAP_SEC; }
  function bonusConfig() {
    const BS = D.bonusStar;
    const k = has('magnet') ? 0.7 : 1;
    return {
      delay: [BS.delaySec[0] * k, BS.delaySec[1] * k],
      firstDelay: BS.firstDelaySec,
      life: BS.lifeSec * (has('linger') ? 2 : 1),
      power: has('golden') ? 2 : 1,
    };
  }

  function researchAvailable(r) { return !has(r.id) && (!r.req || has(r.req)); }
  function buyResearch(id) {
    const r = researchById[id];
    if (!r || !researchAvailable(r) || coresFree() < r.cost) return false;
    s.coresSpent += r.cost;
    s.research[id] = true;
    return true;
  }

  // ---------- 계산 ----------
  function achCount() { return Object.keys(s.achievements).length; }
  function coreMult() { return 1 + s.cores * coreBonus(); }
  function achMult() { return 1 + achCount() * D.ACH_BONUS; }
  function globalMult() { return coreMult() * achMult(); }
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
    let base = 1, frac = has('touch') ? 0.03 : 0;
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
    return g.baseCost * genCostMult() * Math.pow(G, n) * (Math.pow(G, k) - 1) / (G - 1);
  }
  function maxAffordable(g) {
    const n = s.gens[g.id];
    const first = g.baseCost * genCostMult() * Math.pow(G, n);
    if (s.light < first) return 0;
    let k = Math.floor(Math.log(s.light * (G - 1) / first + 1) / Math.log(G));
    while (k > 0 && bulkCost(g, k) > s.light) k--;   // 부동소수 오차 보정
    return k;
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
    if (!u || s.upgrades[id] || !upgradeVisible(u) || s.light < upgradeCost(u)) return false;
    s.light -= upgradeCost(u);
    s.upgrades[id] = true;
    return true;
  }

  function prestige() {
    const gain = prestigeGain();
    if (gain < 1) return 0;
    const keep = {
      cores: s.cores + gain, allTime: s.allTime, clicks: s.clicks, prestiges: s.prestiges + 1,
      bonusClicks: s.bonusClicks, achievements: s.achievements,
      coresSpent: s.coresSpent, research: s.research, settings: s.settings,
    };
    s = freshState();
    Object.assign(s, keep);
    if (has('legacy')) { s.light = 1000; s.gens.firefly = 10; }
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
      const amount = (Math.min(s.light * 0.15, baseLps() * 900) + 77 + clickPower() * 20) * bonusConfig().power;
      earn(amount);
      return { effect: e, amount: amount };
    }
    s.buffs = s.buffs.filter(function (b) { return b.id !== e.id; });  // 같은 버프는 갱신
    const sec = e.sec * bonusConfig().power;
    s.buffs.push({ id: e.id, name: e.name, kind: e.kind, mult: e.mult, left: sec, total: sec });
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

  // 저장 데이터를 현재 형식으로 맞추고, 깨진 숫자(NaN 등)는 0으로 되돌린다.
  function normalize(data) {
    if (!data || typeof data !== 'object' || typeof data.gens !== 'object') return null;
    const base = freshState();
    const out = Object.assign(base, data);
    out.gens = Object.assign(freshState().gens, data.gens);
    for (const id in out.gens) out.gens[id] = Math.max(0, Math.floor(Number(out.gens[id]) || 0));
    ['light', 'runTotal', 'allTime', 'clicks', 'cores', 'coresSpent', 'prestiges', 'bonusClicks'].forEach(function (k) {
      const n = Number(out[k]);
      out[k] = isFinite(n) && n > 0 ? n : 0;
    });
    ['upgrades', 'achievements', 'research'].forEach(function (k) {
      if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    });
    out.settings = Object.assign(freshState().settings, data.settings || {});
    out.buffs = [];   // 버프는 오프라인 동안 이어지지 않음
    if (!isFinite(out.lastTick)) out.lastTick = Date.now();
    if (!isFinite(out.startedAt)) out.startedAt = Date.now();
    out.v = SAVE_VERSION;
    return out;
  }

  // 오프라인 보상 계산. 반환값: { seconds, earned } | null
  function applyOffline() {
    const away = Math.min((Date.now() - s.lastTick) / 1000, offlineCap());
    s.lastTick = Date.now();
    if (!(away >= 30)) return null;
    const earned = lps() * away * offlineRate();
    if (earned > 0) earn(earned);
    return { seconds: away, earned: earned, rate: offlineRate() };
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(saveKey); } catch (e) {}
    if (!raw) return null;
    let data = null;
    try { data = normalize(JSON.parse(raw)); } catch (e) {}
    if (!data) return null;
    s = data;
    return applyOffline();
  }

  // 내보내기: 다른 기기로 옮길 수 있는 문자열
  function exportSave() {
    s.lastTick = Date.now();
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  }
  function importSave(str) {
    let data = null;
    try { data = normalize(JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))))); } catch (e) {}
    if (!data) return false;
    data.lastTick = Date.now();
    s = data;
    save();
    return true;
  }

  function hardReset() {
    const settings = s.settings;
    s = freshState();
    s.settings = settings;
    try { localStorage.removeItem(saveKey); } catch (e) {}
  }

  // getter(state)를 살리기 위해 Object.assign 대신 디스크립터로 복사
  return Object.defineProperties(engineApi, Object.getOwnPropertyDescriptors({
    get state() { return s; },
    research: D.research, researchAvailable: researchAvailable, buyResearch: buyResearch, has: has, coresFree: coresFree,
    coreMult: coreMult, achMult: achMult, upgradeCost: upgradeCost, offlineRate: offlineRate, offlineCap: offlineCap, bonusConfig: bonusConfig,
    exportSave: exportSave, importSave: importSave,
    baseLps: baseLps, buffMult: buffMult, achCount: achCount, claimBonus: claimBonus, checkAchievements: checkAchievements,
    upgrades: upgrades,
    lps: lps, clickPower: clickPower, genRate: genRate,
    bulkCost: bulkCost, maxAffordable: maxAffordable,
    prestigeGain: prestigeGain, globalMult: globalMult, upgradeVisible: upgradeVisible,
    click: click, buyGen: buyGen, buyUpgrade: buyUpgrade, prestige: prestige,
    tick: tick, save: save, load: load, hardReset: hardReset,
  }));
};
