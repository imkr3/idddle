// 엔진 단위 테스트: npm test  (Node 18+, 의존성 없음)
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEngine } = require('./helper');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
// Math.random을 잠깐 고정한다
function withRandom(values, fn) {
  const orig = Math.random;
  let i = 0;
  Math.random = () => (Array.isArray(values) ? values[Math.min(i++, values.length - 1)] : values);
  try { return fn(); } finally { Math.random = orig; }
}
const noCrit = (fn) => withRandom(0.99, fn);
// 졸업장 n장을 받으려면 필요한 전체 누적 지식 (data.js의 prestige 공식을 거꾸로 계산)
const needFor = (D, n) => D.prestige.divisor * Math.pow(n / D.prestige.scale, 1 / D.prestige.power) * 1.0000001;

// ---------------------------------------------------------------- 클릭
test('클릭하면 지식이 클릭 파워만큼 오르고 집중력이 찬다', () => {
  const { game } = makeEngine();
  noCrit(() => { game.click(); });
  assert.equal(game.state.light, 1);
  assert.equal(game.state.clicks, 1);
  assert.equal(game.state.combo, 6);
  noCrit(() => { const r = game.click(); close(r.amount, 1.06); assert.equal(r.crit, false); });   // 집중력 6% → x1.06
});

test('집중력이 가득 차면 클릭이 2배, 시간이 지나면 줄어든다', () => {
  const { game } = makeEngine();
  game.state.combo = 100;
  close(game.clickPower(), 2);
  game.tick(5);                       // 초당 6씩 감소
  close(game.state.combo, 70);
  game.tick(100);
  assert.equal(game.state.combo, 0);
});

test('아하!(치명타)는 10배', () => {
  const { game } = makeEngine();
  const r = withRandom(0, () => game.click());
  assert.equal(r.crit, true);
  close(r.amount, 10);
  assert.equal(game.state.crits, 1);
});

test('클릭 업그레이드: 배율과 초당 생산 비율', () => {
  const { game } = makeEngine();
  const s = game.state;
  s.clicks = 5000; s.light = 1e15;
  s.gens.teacher = 10;                // 80/초
  assert.ok(game.buyUpgrade('click1'));
  assert.ok(game.buyUpgrade('click3'));
  s.clock = 0;                        // 1교시(연필·도서관) — 선생님은 보너스 없음
  close(game.clickPower(), 2 + 80 * 0.01);
});

test('자동 필기: 초당 n번 클릭한 만큼 수입이 더해진다', () => {
  const { game } = makeEngine();
  game.state.research.auto1 = true;
  close(game.income(), 1);            // 클릭 1 × 1회/초
  game.state.research.auto2 = true;
  close(game.income(), 4);
  game.tick(10);
  close(game.state.light, 40);
});

// ---------------------------------------------------------------- 구매
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
  assert.equal(game.buyGen('nothing', 1), false);
});

test('업그레이드는 조건 충족 전에는 살 수 없고, 사면 생산이 2배', () => {
  const { game } = makeEngine();
  game.state.light = 1e9;
  assert.equal(game.buyUpgrade('pencil_0'), false);
  game.state.gens.pencil = 1;
  assert.equal(game.buyUpgrade('pencil_0'), true);
  close(game.genRate({ id: 'pencil', rate: 0.1 }), 0.2);
  assert.equal(game.buyUpgrade('pencil_0'), false);   // 두 번은 못 산다
});

test('시너지: 다른 생산기 수만큼 생산량이 늘어난다', () => {
  const { game } = makeEngine();
  const s = game.state;
  s.gens.student = 15; s.gens.teacher = 5; s.light = 1e9;
  const before = game.genRate({ id: 'student', rate: 1 });
  assert.equal(game.buyUpgrade('syn_lesson'), true);
  close(game.genRate({ id: 'student', rate: 1 }), before * (1 + 0.02 * 5));
  s.gens.teacher = 10;
  close(game.genRate({ id: 'student', rate: 1 }), before * (1 + 0.02 * 10));
  s.research.synergy = true;          // 융합 교육 +50%
  close(game.genRate({ id: 'student', rate: 1 }), before * (1 + 0.03 * 10));
});

test('급식: 이번 학기 누적 지식으로 열리고 전체 생산을 올린다', () => {
  const { game } = makeEngine();
  const s = game.state;
  s.light = 1e6; s.gens.student = 10;
  assert.equal(game.buyUpgrade('lunch_milk'), false);
  s.runTotal = 2000;
  assert.equal(game.buyUpgrade('lunch_milk'), true);
  close(game.baseLps(), 10 * 1.1);
  s.research.lunch = true;            // 영양사 선생님 +50%
  close(game.baseLps(), 10 * 1.15);
  assert.equal(game.lunchCount(), 1);
});

test('buyAllUpgrades는 살 수 있는 것을 싼 것부터 모두 산다', () => {
  const { game } = makeEngine();
  const s = game.state;
  s.gens.pencil = 10; s.gens.student = 1; s.clicks = 10; s.light = 12 * 8 + 12 * 40 + 60 + 5;   // 연필 2단계 + 바른 자세까지만
  const bought = Array.from(game.buyAllUpgrades(), (u) => u.id);
  assert.deepEqual(bought, ['click1', 'pencil_0', 'pencil_1']);
  assert.ok(s.light < 110 * 8);
});

// ---------------------------------------------------------------- 시간
test('tick은 초당 생산 × 시간만큼 더한다', () => {
  const { game } = makeEngine();
  game.state.gens.teacher = 5;        // 40/초, 1교시에는 보너스 없음
  game.tick(10);
  close(game.state.light, 400);
});

test('시간표: 해당 교시의 교실은 2배, 교시가 바뀌는 순간까지 정확히 계산', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  s.gens.pencil = 10;                 // 1/초, 1교시 국어에서 x2
  assert.equal(game.period().def.id, 'korean');
  close(game.lps(), 2);
  close(game.baseLps(), 1);
  game.tick(D.timetable.periodSec + 5);   // 45초 × 2 + 5초 × 1
  close(s.light, 95);
  assert.equal(game.period().def.id, 'math');
  s.research.extra = true;            // 보충 수업 x3
  s.clock = 0;
  close(game.lps(), 3);
});

test('점심시간에는 클릭이 3배', () => {
  const { game, D } = makeEngine();
  game.state.clock = D.timetable.periodSec * 4 + 1;
  assert.equal(game.period().def.id, 'lunch');
  close(game.clickPower(), 3);
});

test('버프가 tick 도중 끝나면 그 시점까지만 배율이 적용된다', () => {
  const { game } = makeEngine();
  game.state.gens.teacher = 1;        // 8/초
  game.state.buffs.push({ id: 'storm', kind: 'prod', mult: 7, left: 2, total: 2 });
  game.tick(5);                       // 2초 × 56 + 3초 × 8
  close(game.state.light, 136);
  assert.equal(game.state.buffs.length, 0);
});

test('아주 긴 tick도 금방 끝나고 평균 생산과 거의 같다', () => {
  const { game } = makeEngine();
  game.state.gens.pencil = 10;        // 기본 1/초, 8교시 중 1교시만 x2 → 평균 1.125
  const t0 = Date.now();
  game.tick(360000);                  // 100시간
  assert.ok(Date.now() - t0 < 2000);
  close(game.state.light, 360000 * 1.125, 0.01);
});

// ---------------------------------------------------------------- 칭찬 스티커
test('칭찬 스티커 효과: 지식·집중 시간·필기 폭주·바자회', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  s.gens.teacher = 10; s.light = 1000;   // 80/초
  const lucky = game.claimBonus({ effect: 'lucky' });
  const L = D.praise.lucky;
  close(lucky.amount, Math.min(1000 * L.bank, 80 * L.capSec) + 80 * L.baseSec + 10);
  game.claimBonus({ effect: 'storm' });
  close(game.lps(), game.baseLps() * 5);
  game.claimBonus({ effect: 'storm' });  // 같은 버프는 겹치지 않고 갱신
  assert.equal(s.buffs.filter((b) => b.id === 'storm').length, 1);
  game.claimBonus({ effect: 'frenzy' });
  close(game.buffMult('click'), 10);
  const g = D.generators[2];
  const price = game.bulkCost(g, 1);
  game.claimBonus({ effect: 'sale' });
  close(game.bulkCost(g, 1), price * 0.75);
  assert.equal(s.bonusClicks, 5);
});

test('교장선생님 선물은 가진 생산기를 늘리고, 스티커 비는 작은 스티커를 뿌린다', () => {
  const { game } = makeEngine();
  game.state.gens.teacher = 40;
  const r = game.claimBonus({ effect: 'gift' });
  assert.equal(r.gen, 'teacher');
  assert.equal(r.count, 2);              // 40의 3% = 1.2 → 올림 2
  assert.equal(game.state.gens.teacher, 42);
  const rain = game.claimBonus({ effect: 'rain' });
  assert.equal(rain.minis, 8);
  const before = game.state.light;
  assert.ok(game.claimMini() > 0);
  assert.ok(game.state.light > before);
});

test('칭찬 스티커를 받으면 확률로 앨범 스티커가 나온다 (수집가 계획이면 확률 2배)', () => {
  const { game, D } = makeEngine();
  const p = D.praise.albumChance;
  assert.equal(withRandom(p + 0.01, () => game.claimBonus({ effect: 'lucky' })).drops.length, 0);
  assert.equal(withRandom(p - 0.01, () => game.claimBonus({ effect: 'lucky' })).drops.length, 1);
  game.state.research.album1 = true;
  assert.equal(withRandom(p * 2 - 0.01, () => game.claimBonus({ effect: 'lucky' })).drops.length, 1);
});

test('반장이 대신 받으면 효과가 절반', () => {
  const { game } = makeEngine();
  game.state.gens.teacher = 10;
  const r = game.claimBonus({ effect: 'storm', auto: true });
  assert.equal(r.auto, true);
  close(game.state.buffs[0].left, 15);
  assert.equal(game.state.bonusAuto, 1);
  assert.equal(game.state.bonusClicks, 0);
  assert.equal(game.claimBonus({ effect: 'rain', auto: true }).effect.id, 'lucky');
});

// ---------------------------------------------------------------- 스티커 앨범
test('앨범: 새 스티커는 보너스, 같은 등급을 다 모으면 세트 보너스', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  close(game.albumMult(), 1);
  s.album.star = 1;
  close(game.albumMult(), 1.01);
  s.album.unicorn = 3;                   // 여러 장이어도 한 번만
  close(game.albumMult(), 1.05);
  D.stickers.filter((t) => t.rarity === 'legend').forEach((t) => { s.album[t.id] = 1; });
  close(game.albumMult(), 1.05 + 0.30 + 0.50);
  assert.equal(game.albumCount(), 5);
});

test('앨범: 한동안 새 스티커가 없으면 없는 스티커를 보장한다', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  D.stickers.forEach((t) => { if (t.id !== 'berry' && t.rarity !== 'legend') s.album[t.id] = 1; });
  s.albumPity = D.albumPity;
  const r = withRandom(0.1, () => game.drawStickers(1)[0]);   // 일반 등급이 나옴
  assert.equal(r.sticker.id, 'berry');
  assert.equal(r.isNew, true);
  assert.equal(s.albumPity, 0);
  // 전설도 오래 안 나오면 보장된다
  s.legendPity = D.legendPity;
  const g = withRandom(0.1, () => game.drawStickers(1)[0]);
  assert.equal(g.sticker.rarity, 'legend');
  assert.equal(s.legendPity, 0);
});

test('앨범: 이미 있는 스티커는 지식으로 돌려받는다', () => {
  const { game } = makeEngine();
  game.state.gens.teacher = 10;
  const a = withRandom(0, () => game.drawStickers(1)[0]);
  const b = withRandom(0, () => game.drawStickers(1)[0]);
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false);
  assert.equal(b.count, 2);
  assert.ok(b.dupReward > 0);
  assert.equal(game.state.stats.dupes, 1);
});

// ---------------------------------------------------------------- 쪽지 시험
test('쪽지 시험: 대기 시간, 정답 보상, 연속 기록', () => {
  const { game, clock, D } = makeEngine();
  const wait = (D.quiz.cooldownSec + 1) * 1000;
  const q = game.quizStart();
  assert.ok(q && q.choices.includes(q.answer));
  assert.equal(q.subject, 'math');                   // 유치원은 산수만
  assert.equal(game.quizStart(), null);              // 대기 중
  assert.ok(game.quizReadyIn() > 0);
  const r = withRandom(0.99, () => game.quizAnswer(q, q.answer));
  assert.equal(r.ok, true);
  assert.ok(r.reward >= D.quiz.rewardMin);
  assert.equal(game.state.quiz.streak, 1);
  assert.deepEqual(Array.from(game.state.quiz.subj.math), [1, 1]);
  clock.advance(wait);
  const q2 = game.quizStart();
  assert.ok(q2);
  assert.equal(game.quizAnswer(q2, 'x').ok, false);
  assert.equal(game.state.quiz.streak, 0);
  assert.equal(game.state.quiz.wrong, 1);
  assert.equal(game.state.quiz.best, 1);
  clock.advance(wait);
  assert.equal(game.quizAnswer(game.quizStart(), null).ok, false);   // 시간 초과
});

test('쪽지 시험: 과목은 학년이 오르면 열리고, 족집게 과외는 대기를 줄인다', () => {
  const { game, clock, D } = makeEngine();
  assert.deepEqual(Array.from(game.quizSubjects(), (x) => x.id), ['math']);
  game.state.allTime = 1e10;
  assert.deepEqual(Array.from(game.quizSubjects(), (x) => x.id), ['math', 'english', 'spelling', 'capitals', 'science', 'proverbs']);
  game.state.research.cram = true;
  game.quizStart();
  clock.advance((D.quiz.cooldownSec * 0.6 - 1) * 1000);
  assert.ok(game.quizReadyIn() > 0);
  clock.advance(2000);
  assert.equal(game.quizReadyIn(), 0);
});

test('쪽지 시험: 모든 과목의 문제가 올바른 모양이다', () => {
  const { game, clock } = makeEngine();
  game.state.allTime = 1e12;
  game.state.quiz.subj.math = [40, 40];              // 가장 어려운 산수
  for (const sb of game.quizSubjects()) {
    for (let i = 0; i < 150; i++) {
      clock.advance(1000 * 1000);
      const q = game.quizStart(sb.id);
      assert.equal(q.subject, sb.id);
      assert.ok(q.text && q.timeSec > 0);
      assert.ok(q.choices.length === (sb.id === 'spelling' ? 2 : 4), sb.id + ' 보기 수: ' + q.choices.join('/'));
      assert.equal(new Set(q.choices).size, q.choices.length, sb.id + ' 보기 중복: ' + q.choices.join('/'));
      assert.ok(q.choices.includes(q.answer), sb.id + ' 정답이 보기에 없음');
      if (sb.id === 'math') {
        const expr = q.text.replace(' = ?', '').replace('−', '-').replace('×', '*').replace('÷', '/');
        assert.equal(String(Function('return ' + expr)()), q.answer, q.text);
        assert.ok(q.choices.every((c) => Number(c) >= 0));
      }
    }
  }
});

// ---------------------------------------------------------------- 출석 · 숙제
test('출석: 하루 한 번, 연속이면 streak 증가, 끊기면 1부터, 스티커를 준다', () => {
  const { game } = makeEngine();
  const a = game.attendance('2026-11-10');
  assert.equal(a.streak, 1);
  assert.equal(a.drops.length, 2);
  assert.equal(game.attendance('2026-11-10'), null);
  assert.equal(game.attendance('2026-11-11').streak, 2);
  assert.equal(game.attendance('2026-12-01').streak, 1);
  assert.equal(game.state.attend.total, 3);
  game.state.attend.last = '2026-02-28';             // 월말 → 다음 달 1일도 연속
  assert.equal(game.attendance('2026-03-01').streak, 2);
  game.state.attend.streak = 6; game.state.attend.last = '2026-03-01';
  assert.equal(game.attendance('2026-03-02').drops.length, 5);   // 7일째는 큰 묶음
});

test('숙제: 차례대로 진행되고 조건을 채워야 제출할 수 있다', () => {
  const { game, D } = makeEngine();
  let h = game.homeworkCurrent();
  assert.equal(h.index, 0);
  assert.equal(h.done, false);
  assert.equal(game.homeworkClaim(), null);
  game.state.clicks = 10;
  h = game.homeworkCurrent();
  assert.equal(h.done, true);
  const r = game.homeworkClaim();
  assert.equal(r.amount, D.homework[0].reward.min);
  assert.equal(game.state.light, r.amount);
  assert.equal(game.homeworkCurrent().index, 1);
  // 스티커 보상 숙제
  const i = D.homework.findIndex((t) => t.reward.stickers);
  game.state.homework.index = i;
  game.state.quiz.correct = 1;
  assert.equal(game.homeworkClaim().drops.length, D.homework[i].reward.stickers);
  // 끝까지 가면 finished
  game.state.homework.index = D.homework.length;
  assert.equal(game.homeworkCurrent().finished, true);
  assert.equal(game.homeworkClaim(), null);
});

test('숙제 목록의 모든 조건 함수가 새 게임 상태에서 오류 없이 돈다', () => {
  const { game, D } = makeEngine();
  D.homework.forEach((t, i) => {
    game.state.homework.index = i;
    const h = game.homeworkCurrent();
    assert.ok(h.target > 0 && h.cur >= 0, t.text);
  });
});

// ---------------------------------------------------------------- 졸업 · 발전 계획
test('졸업장은 전체 누적 지식 기준이고, 졸업하면 진행은 초기화·영구 요소는 유지', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  assert.equal(game.prestige(), 0);
  s.allTime = D.prestige.unlockAt * 0.9;                // 아직 졸업 자격이 없다
  assert.equal(game.prestigeUnlocked(), false);
  assert.equal(game.prestigeGain(), 0);
  s.allTime = s.runTotal = needFor(D, 10);
  s.light = 5; s.gens.student = 3; s.upgrades.pencil_0 = true; s.runSec = 500;
  s.achievements.total0 = true; s.album.star = 1; s.quiz.correct = 7; s.homework.index = 3;
  assert.equal(game.prestigeGain(), 10);
  assert.equal(game.prestige(), 10);
  const n = game.state;
  assert.equal(n.cores, 10); assert.equal(n.prestiges, 1);
  assert.equal(n.light, 0); assert.equal(n.gens.student, 0); assert.equal(n.runTotal, 0);
  assert.deepEqual(Object.keys(n.upgrades), []);
  assert.equal(n.achievements.total0, true); assert.equal(n.album.star, 1);
  assert.equal(n.quiz.correct, 7); assert.equal(n.homework.index, 3);
  assert.equal(n.stats.fastestGrad, 500);
  close(game.coreMult(), 1 + 10 * D.CORE_BONUS);
  assert.equal(game.prestigeGain(), 0);                 // 같은 누적으로는 더 못 받는다
  close(game.nextDiplomaAt(), needFor(D, 11), 1e-5);
});

test('신입생 장학금·전통의 명문·통학 버스: 졸업 후 시작 보너스', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  s.research.legacy = true; s.research.legacy2 = true;
  s.allTime = needFor(D, 8);
  game.prestige();
  assert.equal(game.state.light, 1000);
  assert.equal(game.state.gens.pencil, 25);
  assert.equal(game.state.gens.teacher, 25);
  assert.equal(game.state.gens.library, 0);
  game.state.research.legacy3 = true;
  game.state.allTime = needFor(D, 12);
  game.prestige();
  assert.equal(game.state.gens.university, 50);
  assert.equal(game.state.gens.online, 0);
});

test('발전 계획: 남은 졸업장으로만 사고, 선행 계획이 필요하다', () => {
  const { game } = makeEngine();
  game.state.cores = 10;
  assert.equal(game.buyResearch('awake'), false);       // 꿈속 복습 필요
  assert.equal(game.buyResearch('dream'), true);
  assert.equal(game.buyResearch('awake'), true);
  assert.equal(game.coresFree(), 0);
  assert.equal(game.buyResearch('legacy'), false);      // 졸업장 부족
  close(game.coreMult(), 1.5);                          // 써도 보너스는 유지
  assert.equal(game.offlineRate(), 1);
});

test('명예의 전당은 여러 번 살 수 있고 살수록 비싸진다', () => {
  const { game, D } = makeEngine();
  const hall = D.research.find((r) => r.id === 'hall');
  game.state.cores = 1000;
  assert.equal(game.researchCost(hall), 25);
  assert.ok(game.buyResearch('hall'));
  assert.equal(game.researchCost(hall), 38);
  assert.ok(game.buyResearch('hall'));
  assert.equal(game.lvl('hall'), 2);
  close(game.hallMult(), 1.2);
  assert.equal(game.state.coresSpent, 63);
});

test('가격 할인 계획: 생산기 -10%, 업그레이드 -25%', () => {
  const { game, D } = makeEngine();
  const g = D.generators[0];
  const before = game.bulkCost(g, 1);
  game.state.research.design = true;
  close(game.bulkCost(g, 1), before * 0.9);
  game.state.research.engine = true;
  close(game.upgradeCost(game.upgrades[0]), game.upgrades[0].cost * 0.75);
});

// ---------------------------------------------------------------- 도전 학기
test('도전 학기: 졸업 2회 뒤에 열리고, 시작하면 새 학기가 규칙과 함께 시작된다', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  assert.equal(game.challengeStart('noclick'), false);
  s.prestiges = 2; s.allTime = s.runTotal = needFor(D, 8); s.gens.student = 5;
  assert.equal(game.challengeStart('noclick'), true);
  assert.equal(game.state.cores, 8);                    // 시작할 때 졸업장은 받는다
  assert.equal(game.state.gens.student, 0);
  assert.equal(game.activeChallenge().id, 'noclick');
  assert.equal(game.clickPower(), 0);
  assert.equal(noCrit(() => game.click()).amount, 0);
  assert.equal(game.challengeStart('nopencil'), false); // 하나씩만
  assert.equal(game.challengeAbandon(), true);
  assert.equal(game.activeChallenge(), null);
  assert.ok(game.clickPower() > 0);
});

test('도전 학기 규칙: 연필·선생님 금지, 물가 폭등, 생산 1/10, 조용한 학기', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  s.prestiges = 2; s.light = 1e12;
  s.challenge.active = 'nopencil';
  assert.equal(game.buyGen('pencil', 1), false);
  assert.equal(game.buyGen('student', 1), true);
  s.challenge.active = 'strike';
  assert.equal(game.buyGen('teacher', 1), false);
  s.challenge.active = 'inflation';
  const g = D.generators[2];
  close(game.bulkCost(g, 2), g.baseCost * (1 + 1.25));
  s.challenge.active = 'final';
  close(game.baseLps(), 0.1);
  s.challenge.active = 'quiet';
  assert.equal(game.claimBonus(), null);
  assert.equal(game.quizStart(), null);
  assert.equal(game.praiseConfig().enabled, false);
});

test('도전 학기: 목표에 닿으면 통과하고 영구 보상과 스티커를 받는다', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  s.prestiges = 2; s.challenge.active = 'speedrun';
  s.runTotal = D.challenges.find((c) => c.id === 'speedrun').goal;
  game.tick(1);
  const ev = game.drainEvents();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, 'challengeDone');
  assert.equal(ev[0].drops.length, 5);
  assert.equal(s.challenge.done.speedrun, true);
  assert.equal(game.activeChallenge(), null);
  s.gens.teacher = 1;
  close(game.baseLps(), 8 * 1.25 * game.albumMult());   // 전체 생산 +25% (받은 스티커 보너스 포함)
  assert.equal(game.drainEvents().length, 0);
});

test('도전 보상들: 아하! 15배, 연필 10배, 가격 -5%, 스티커 +50%, 시너지 +25%, 졸업장 +2%p', () => {
  const { game, D } = makeEngine();
  const s = game.state;
  s.challenge.done = { noclick: true, nopencil: true, inflation: true, quiet: true, strike: true, final: true };
  assert.equal(game.critMult(), 15);
  close(game.genMult('pencil'), 10);
  close(game.bulkCost(D.generators[0], 1), 12 * 0.95);
  close(game.praiseConfig().power, 1.5);
  close(game.synMult(), 1.25);
  close(game.coreBonus(), 0.06);
});

test('벼락치기 학기는 시간이 지나면 실패한다', () => {
  const { game } = makeEngine();
  game.state.prestiges = 2; game.state.challenge.active = 'speedrun';
  game.tick(901);
  const ev = game.drainEvents();
  assert.equal(ev[0].type, 'challengeFail');
  assert.equal(game.activeChallenge(), null);
  assert.equal(game.state.challenge.done.speedrun, undefined);
});

// ---------------------------------------------------------------- 저장
test('저장 → 불러오기, 오프라인 보상 (시간표 평균 포함)', () => {
  const store = {};
  const a = makeEngine(store);
  a.game.state.gens.teacher = 10;       // 80/초
  a.game.save();
  a.clock.advance(100 * 1000);
  const b = makeEngine(store, a.clock);
  const off = b.game.load();
  assert.ok(off);
  close(off.seconds, 100);
  close(off.earned, 80 * 1.125 * 100 * 0.5);
  close(b.game.state.light, off.earned);
});

test('오프라인 보상은 최대 시간에서 잘린다', () => {
  const store = {};
  const a = makeEngine(store);
  a.game.state.gens.teacher = 1;
  a.game.save();
  a.clock.advance(100 * 3600 * 1000);
  const b = makeEngine(store, a.clock);
  const off = b.game.load();
  assert.equal(off.seconds, 8 * 3600);
  assert.equal(off.capped, true);
});

test('깨진 저장 데이터는 안전하게 정리된다', () => {
  const store = { 'test-save': JSON.stringify({
    gens: { pencil: 'abc', student: -3, firefly: 50 }, light: 'NaN', cores: null, upgrades: { pencil_0: true, nope: true },
    research: { hall: 3, legacy: true, ghost: true }, album: { star: 2, ghost: 5 }, quiz: 'x', settings: { notation: 'zz' },
    challenge: { active: 'nothing', done: { final: true, ghost: true } }, homework: { index: 9999 },
  }) };
  const { game, D } = makeEngine(store);
  game.load();
  const s = game.state;
  assert.equal(s.gens.pencil, 0); assert.equal(s.gens.student, 0); assert.equal('firefly' in s.gens, false);
  assert.equal(s.light, 0); assert.equal(s.cores, 0);
  assert.deepEqual(Object.keys(s.upgrades), ['pencil_0']);
  assert.equal(s.research.hall, 3); assert.equal(s.research.legacy, true); assert.equal('ghost' in s.research, false);
  assert.deepEqual(Object.keys(s.album), ['star']);
  assert.equal(s.quiz.correct, 0); assert.equal(s.settings.notation, 'ko');
  assert.equal(s.challenge.active, ''); assert.deepEqual(Object.keys(s.challenge.done), ['final']);
  assert.equal(s.homework.index, D.homework.length);
  assert.ok(isFinite(game.lps()) && isFinite(game.clickPower()));
});

test('이전 버전(v2) 저장 데이터를 이어서 쓸 수 있다', () => {
  const old = {
    light: 5000, runTotal: 2e6, allTime: 3e6, clicks: 800, v: 2, cores: 1, coresSpent: 1, prestiges: 1, bonusClicks: 4,
    gens: { pencil: 30, student: 20, teacher: 10, library: 5, lab: 0, computer: 0, university: 0, online: 0, space: 0, timemachine: 0 },
    upgrades: { pencil_0: true, pencil_1: true, click1: true, syn_lesson: true }, research: { legacy: true },
    achievements: { total0: true, click0: true, gen_pencil0: true }, buffs: [{ id: 'storm', kind: 'prod', mult: 7, left: 9, total: 30 }],
    quiz: { readyAt: 0, correct: 3, asked: 4, streak: 1, best: 2 }, attend: { last: '2026-11-09', streak: 2, total: 5 },
    settings: { notation: 'en', sound: false }, startedAt: 1, lastTick: 1,
  };
  const { game } = makeEngine({ 'test-save': JSON.stringify(old) });
  game.load();
  const s = game.state;
  assert.equal(s.gens.pencil, 30); assert.equal(s.gens.truth, 0);
  assert.equal(s.upgrades.syn_lesson, true); assert.equal(s.research.legacy, true);
  assert.equal(s.quiz.correct, 3); assert.equal(s.attend.streak, 2);
  assert.equal(s.settings.notation, 'en'); assert.equal(s.settings.sound, false); assert.equal(s.settings.fx, true);
  assert.equal(s.buffs.length, 0);
  assert.equal(s.homework.index, 0); assert.deepEqual(Object.keys(s.album), []);
  assert.equal(s.v, 3);
  assert.ok(game.baseLps() > 0);
  assert.ok(game.checkAchievements().length > 0);       // 새 업적도 바로 계산된다
});

test('완전히 잘못된 저장 데이터는 무시된다', () => {
  const { game } = makeEngine({ 'test-save': '{not json' });
  assert.equal(game.load(), null);
  assert.equal(game.state.light, 0);
});

test('내보내기 → 가져오기 왕복', () => {
  const a = makeEngine().game;
  a.state.light = 4242; a.state.gens.teacher = 7; a.state.research.dream = true; a.state.album.star = 2;
  a.state.challenge.done.final = true; a.state.quiz.subj.math = [3, 4];
  const code = a.exportSave();
  const b = makeEngine().game;
  assert.equal(b.importSave(code), true);
  assert.equal(b.state.light, 4242);
  assert.equal(b.state.gens.teacher, 7);
  assert.equal(b.state.research.dream, true);
  assert.equal(b.state.album.star, 2);
  assert.equal(b.state.challenge.done.final, true);
  assert.deepEqual(Array.from(b.state.quiz.subj.math), [3, 4]);
  assert.equal(b.importSave('garbage!!'), false);
});

test('전체 초기화는 설정만 남긴다', () => {
  const { game } = makeEngine();
  game.state.cores = 5; game.state.light = 100; game.state.settings.sound = false;
  game.hardReset();
  assert.equal(game.state.cores, 0); assert.equal(game.state.light, 0);
  assert.equal(game.state.settings.sound, false);
});

// ---------------------------------------------------------------- 업적 · 학년
test('업적은 조건을 만족하면 한 번만 달성되고 생산을 올린다', () => {
  const { game } = makeEngine();
  game.state.allTime = 150;
  const got = game.checkAchievements().map((a) => a.id);
  assert.ok(got.includes('total0'));
  assert.equal(game.checkAchievements().length, 0);
  close(game.achMult(), 1 + got.length * 0.01);
});

test('모든 업적 조건 함수가 새 게임 상태에서 오류 없이 돌고, 설명도 만들어진다', () => {
  const { game, D } = makeEngine();
  D.achievements.forEach((a) => {
    assert.equal(typeof a.cond(game.state, game), 'boolean', a.id);
    assert.ok(a.desc().length > 0, a.id);
  });
});

test('숨겨진 업적: 번개 손가락, 용돈 탕진, 명상의 시간, 무아지경', () => {
  const { game, clock, D } = makeEngine();
  const s = game.state;
  noCrit(() => { for (let i = 0; i < 10; i++) { game.click(); clock.advance(50); } });
  assert.equal(s.flags.speed10, true);
  s.light = game.bulkCost(D.generators.find((g) => g.id === 'teacher'), 1);
  game.buyGen('teacher', 1);
  assert.equal(s.flags.broke, true);
  assert.equal(s.flags.patience, undefined);
  game.tick(301);
  assert.equal(s.flags.patience, true);
  for (let i = 0; i < 70; i++) { s.combo = 100; game.tick(1); }
  assert.equal(s.flags.flow60, true);
  const ids = game.checkAchievements().map((a) => a.id);
  ['speed10', 'broke', 'patience', 'flow60'].forEach((id) => assert.ok(ids.includes(id), id));
});

test('학년은 누적 지식에 따라 오른다', () => {
  const { game } = makeEngine();
  assert.equal(game.grade().name, '유치원');
  game.state.allTime = 150;
  assert.equal(game.grade().name, '초등 1학년');
  assert.equal(game.grade().next.name, '초등 2학년');
  game.state.allTime = 1e40;
  assert.equal(game.grade().name, '지식의 화신');
  assert.equal(game.grade().next, null);
});

test('배율 내역은 실제 전체 배율과 일치한다', () => {
  const { game } = makeEngine();
  const s = game.state;
  s.cores = 7; s.achievements.total0 = true; s.album.star = 1; s.upgrades.lunch_milk = true; s.research.hall = 2; s.challenge.done.speedrun = true;
  const product = game.multBreakdown().reduce((a, x) => a * x.mult, 1);
  close(product, game.globalMult());
  close(game.globalMult(), 1.35 * 1.01 * 1.01 * 1.1 * 1.2 * 1.25);
});
