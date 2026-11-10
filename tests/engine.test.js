// 엔진 단위 테스트: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeEngine(store) {
  store = store || {};
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    Math, Date, JSON, Object, Number, String, isFinite, unescape, escape, encodeURIComponent, decodeURIComponent,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['data.js', 'engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
  }
  return { game: ctx.Idddle.createEngine('test-save'), store, D: ctx.Idddle.DATA };
}

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('클릭하면 별가루가 클릭 파워만큼 오른다', () => {
  const { game } = makeEngine();
  game.click(); game.click();
  assert.equal(game.state.light, 2);
  assert.equal(game.state.clicks, 2);
});

test('bulkCost는 하나씩 산 가격의 합과 같다', () => {
  const { game, D } = makeEngine();
  const g = D.generators[0];
  game.state.light = 1e9;
  const bulk = game.bulkCost(g, 10);
  let sum = 0;
  for (let i = 0; i < 10; i++) { sum += game.bulkCost(g, 1); game.buyGen(g.id, 1); }
  close(bulk, sum);
});

test('maxAffordable 만큼은 살 수 있고 하나 더는 못 산다', () => {
  const { game, D } = makeEngine();
  const g = D.generators[1];
  game.state.light = 123456;
  const k = game.maxAffordable(g);
  assert.ok(game.bulkCost(g, k) <= game.state.light);
  assert.ok(game.bulkCost(g, k + 1) > game.state.light);
  assert.equal(game.buyGen(g.id, 'max'), true);
  assert.equal(game.state.gens[g.id], k);
});

test('돈이 부족하면 구매 실패하고 상태가 바뀌지 않는다', () => {
  const { game } = makeEngine();
  assert.equal(game.buyGen('pencil', 1), false);
  assert.equal(game.state.gens.pencil, 0);
});

test('tick은 초당 생산 × 시간만큼 더한다', () => {
  const { game } = makeEngine();
  game.state.gens.student = 5;   // 5/초
  game.tick(10);
  close(game.state.light, 50);
});

test('버프가 tick 도중 끝나면 그 시점까지만 배율이 적용된다', () => {
  const { game } = makeEngine();
  game.state.gens.student = 1;   // 1/초
  game.state.buffs.push({ id: 'storm', kind: 'prod', mult: 7, left: 2, total: 2 });
  game.tick(5);                  // 2초 × 7 + 3초 × 1 = 17
  close(game.state.light, 17);
  assert.equal(game.state.buffs.length, 0);
});

test('업그레이드는 조건 충족 전에는 살 수 없다', () => {
  const { game } = makeEngine();
  game.state.light = 1e9;
  assert.equal(game.buyUpgrade('pencil_0'), false);
  game.state.gens.pencil = 1;
  assert.equal(game.buyUpgrade('pencil_0'), true);
  close(game.genRate({ id: 'pencil', rate: 0.1 }), 0.2);
});

test('환생: 성핵 획득, 진행 초기화, 업적·연구 유지', () => {
  const { game } = makeEngine();
  game.state.runTotal = 9e6; game.state.light = 5; game.state.gens.pencil = 3;
  game.state.achievements.total0 = true; game.state.research.legacy = true; game.state.coresSpent = 1;
  game.state.cores = 1;
  assert.equal(game.prestigeGain(), 3);
  assert.equal(game.prestige(), 3);
  const s = game.state;
  assert.equal(s.cores, 4); assert.equal(s.prestiges, 1);
  assert.equal(s.achievements.total0, true); assert.equal(s.research.legacy, true);
  assert.equal(s.light, 1000); assert.equal(s.gens.pencil, 10);  // 별의 유산
  assert.equal(s.runTotal, 0);
});

test('연구는 남은 성핵으로만 사고, 선행 연구가 필요하다', () => {
  const { game } = makeEngine();
  game.state.cores = 10;
  assert.equal(game.buyResearch('awake'), false);       // dream 필요
  assert.equal(game.buyResearch('dream'), true);
  assert.equal(game.buyResearch('awake'), true);
  assert.equal(game.coresFree(), 0);
  assert.equal(game.buyResearch('legacy'), false);      // 성핵 부족
  close(game.coreMult(), 2);                            // 쓴 성핵도 보너스는 유지
});

test('효율적 설계 연구는 생산기 가격을 10% 깎는다', () => {
  const { game, D } = makeEngine();
  const g = D.generators[0];
  const before = game.bulkCost(g, 1);
  game.state.research.design = true;
  close(game.bulkCost(g, 1), before * 0.9);
});

test('저장 → 불러오기, 오프라인 보상 계산', () => {
  const store = {};
  const a = makeEngine(store).game;
  a.state.gens.student = 10;      // 10/초
  a.save();
  const saved = JSON.parse(store['test-save']);
  saved.lastTick -= 100 * 1000;   // 100초 전
  store['test-save'] = JSON.stringify(saved);
  const b = makeEngine(store).game;
  const off = b.load();
  assert.ok(off);
  close(off.seconds, 100, 0.01);
  close(off.earned, 10 * 100 * 0.5, 0.01);
});

test('깨진 저장 데이터는 안전하게 정리된다', () => {
  const store = { 'test-save': JSON.stringify({ gens: { pencil: 'abc', student: -3 }, light: 'NaN', cores: null }) };
  const { game } = makeEngine(store);
  game.load();
  assert.equal(game.state.gens.pencil, 0);
  assert.equal(game.state.gens.student, 0);
  assert.equal(game.state.light, 0);
  assert.equal(game.state.cores, 0);
  assert.ok(game.state.gens.university === 0);
});

test('옛 버전의 모르는 생산기 id는 버려진다', () => {
  const store = { 'test-save': JSON.stringify({ gens: { firefly: 50, pencil: 3 } }) };
  const { game } = makeEngine(store);
  game.load();
  assert.equal(game.state.gens.pencil, 3);
  assert.equal('firefly' in game.state.gens, false);
});

test('완전히 잘못된 저장 데이터는 무시된다', () => {
  const { game } = makeEngine({ 'test-save': '{not json' });
  assert.equal(game.load(), null);
  assert.equal(game.state.light, 0);
});

test('내보내기 → 가져오기 왕복', () => {
  const a = makeEngine().game;
  a.state.light = 4242; a.state.gens.teacher = 7; a.state.research.dream = true;
  const code = a.exportSave();
  const b = makeEngine().game;
  assert.equal(b.importSave(code), true);
  assert.equal(b.state.light, 4242);
  assert.equal(b.state.gens.teacher, 7);
  assert.equal(b.state.research.dream, true);
  assert.equal(b.importSave('garbage!!'), false);
});

test('업적은 조건을 만족하면 한 번만 달성된다', () => {
  const { game } = makeEngine();
  game.state.allTime = 150;
  const got = game.checkAchievements().map((a) => a.id);
  assert.ok(got.includes('total0'));
  assert.equal(game.checkAchievements().length, 0);
  close(game.achMult(), 1 + got.length * 0.02);
});

test('보너스 별: 버프는 중복되지 않고 갱신된다', () => {
  const { game } = makeEngine();
  const orig = Math.random;
  Math.random = () => 0.6;  // storm
  try { game.claimBonus(); game.tick(10); game.claimBonus(); } finally { Math.random = orig; }
  assert.equal(game.state.buffs.length, 1);
  assert.equal(game.state.buffs[0].left, 30);
  assert.equal(game.state.bonusClicks, 2);
});
