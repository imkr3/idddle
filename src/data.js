/* 게임 밸런스 데이터. 숫자 조정은 여기서만 하면 된다. */
window.Idddle = window.Idddle || {};

Idddle.DATA = {
  COST_GROWTH: 1.15,          // 생산기 1개 살 때마다 가격 배율
  OFFLINE_CAP_SEC: 8 * 3600,  // 오프라인 보상 최대 8시간
  OFFLINE_RATE: 0.5,          // 오프라인 효율 50%
  AUTOSAVE_SEC: 10,
  PRESTIGE_DIVISOR: 1e6,      // 성핵 = floor(sqrt(이번 회차 누적 별가루 / 1e6))
  CORE_BONUS: 0.1,            // 성핵 1개당 전체 생산 +10%

  generators: [
    { id: 'firefly',     name: '반딧불이',     icon: '🪲', baseCost: 15,     rate: 0.1,  desc: '밤하늘의 빛을 조금씩 모아온다.' },
    { id: 'lantern',     name: '별빛 등불',    icon: '🏮', baseCost: 120,    rate: 1,    desc: '떨어지는 별빛을 담아두는 등불.' },
    { id: 'telescope',   name: '망원경',       icon: '🔭', baseCost: 1300,   rate: 9,    desc: '먼 별에서 별가루를 끌어당긴다.' },
    { id: 'observatory', name: '천문대',       icon: '🏛️', baseCost: 14000,  rate: 50,   desc: '여러 개의 망원경을 한 번에 운용.' },
    { id: 'satellite',   name: '인공위성',     icon: '🛰️', baseCost: 160000, rate: 280,  desc: '대기권 밖에서 직접 수확한다.' },
    { id: 'nebula',      name: '성운 정제소',  icon: '🌌', baseCost: 1.8e6,  rate: 1500, desc: '성운을 통째로 별가루로 정제.' },
    { id: 'blackhole',   name: '블랙홀 엔진',  icon: '🕳️', baseCost: 2.5e7,  rate: 8500, desc: '시공간을 비틀어 별가루를 뽑아낸다.' },
  ],

  // 생산기 업그레이드 티어: 해당 생산기를 `need`개 보유하면 등장, 가격 = baseCost * costMul, 효과 x2
  genUpgradeTiers: [
    { need: 1,   costMul: 10,    suffix: '연마' },
    { need: 10,  costMul: 60,    suffix: '공명' },
    { need: 25,  costMul: 600,   suffix: '각성' },
    { need: 50,  costMul: 8000,  suffix: '초월' },
    { need: 100, costMul: 2e5,   suffix: '무한' },
  ],

  clickUpgrades: [
    { id: 'click1', name: '단단한 손가락',  icon: '👆', cost: 100,   needClicks: 10,   mult: 2, desc: '클릭 파워 x2' },
    { id: 'click2', name: '별 쓸기',        icon: '🧹', cost: 5000,  needClicks: 100,  mult: 2, desc: '클릭 파워 x2' },
    { id: 'click3', name: '별의 손길',      icon: '🖐️', cost: 2e5,   needClicks: 500,  lpsFrac: 0.01, desc: '클릭 시 초당 생산량의 1% 추가' },
    { id: 'click4', name: '은하 손바닥',    icon: '🤚', cost: 1e7,   needClicks: 1500, lpsFrac: 0.02, desc: '클릭 시 초당 생산량의 2% 추가' },
  ],
};

// ---------- 보너스 별 ----------
Idddle.DATA.bonusStar = {
  firstDelaySec: [20, 45],    // 접속 후 첫 등장
  delaySec: [60, 150],        // 이후 등장 간격 (랜덤)
  lifeSec: 12,                // 화면에 머무는 시간
  effects: [
    { id: 'lucky',  weight: 5, name: '행운의 별',  desc: '별가루 즉시 획득' },
    { id: 'storm',  weight: 4, name: '별폭풍',     desc: '30초간 생산 x7',  kind: 'prod',  mult: 7,  sec: 30 },
    { id: 'frenzy', weight: 2, name: '손끝 폭주',  desc: '15초간 클릭 x15', kind: 'click', mult: 15, sec: 15 },
  ],
};

// ---------- 업적 ----------
// 업적 1개당 전체 생산 +ACH_BONUS. cond(s, e): s = 상태, e = 엔진
Idddle.DATA.ACH_BONUS = 0.02;
Idddle.DATA.achievements = (function () {
  const list = [];
  const add = function (id, name, icon, desc, cond) { list.push({ id: id, name: name, icon: icon, desc: desc, cond: cond }); };
  const fmtN = function (n) { return Idddle.fmt ? Idddle.fmt(n) : String(n); };

  [[1e2, '첫 반짝임'], [1e4, '별가루 주머니'], [1e6, '별가루 창고'], [1e8, '은하 상인'], [1e10, '성간 재벌'], [1e12, '우주의 주인'], [1e15, '빅뱅의 후예']]
    .forEach(function (x, i) { add('total' + i, x[1], '✦', () => '누적 별가루 ' + fmtN(x[0]) + ' 달성', function (s) { return s.allTime >= x[0]; }); });

  [[1, '첫 터치'], [100, '부지런한 손'], [1000, '클릭 장인'], [5000, '손가락 괜찮아요?']]
    .forEach(function (x, i) { add('click' + i, x[1], '👆', () => '별 ' + fmtN(x[0]) + '회 클릭', function (s) { return s.clicks >= x[0]; }); });

  [[10, '은은한 빛'], [1000, '밝은 밤'], [1e5, '대낮 같은 밤'], [1e7, '초신성급 광도']]
    .forEach(function (x, i) { add('lps' + i, x[1], '⚡', () => '초당 ' + fmtN(x[0]) + ' 생산', function (s, e) { return e.lps() >= x[0]; }); });

  Idddle.DATA.generators.forEach(function (g) {
    [[1, '첫 '], [25, '숙련된 '], [100, '전설의 ']].forEach(function (x, i) {
      add('gen_' + g.id + i, x[1] + g.name, g.icon, () => g.name + ' ' + x[0] + '개 보유', function (s) { return s.gens[g.id] >= x[0]; });
    });
  });

  [[1, '반짝, 행운'], [10, '별 사냥꾼'], [50, '별똥별 수집가']]
    .forEach(function (x, i) { add('bonus' + i, x[1], '🌠', () => '보너스 별 ' + x[0] + '개 잡기', function (s) { return s.bonusClicks >= x[0]; }); });

  [[10, '업그레이드 입문'], [30, '최적화 중독']]
    .forEach(function (x, i) { add('upg' + i, x[1], '🔧', () => '업그레이드 ' + x[0] + '개 구매', function (s) { return Object.keys(s.upgrades).length >= x[0]; }); });

  [[1, '첫 초신성'], [5, '윤회하는 별']]
    .forEach(function (x, i) { add('pres' + i, x[1], '💥', () => '환생 ' + x[0] + '회', function (s) { return s.prestiges >= x[0]; }); });

  return list;
})();

// ---------- 천체 연구 (성핵으로 사는 영구 강화, 환생해도 유지) ----------
// 성핵 보너스(+10%/개)는 '획득한 총 성핵' 기준이라 연구에 써도 줄지 않는다.
Idddle.DATA.research = [
  { id: 'legacy',  icon: '🎁', name: '별의 유산',      cost: 1,  desc: '환생 후 별가루 1,000과 반딧불이 10마리로 시작' },
  { id: 'dream',   icon: '💤', name: '꿈꾸는 별',      cost: 2,  desc: '오프라인 효율 50% → 75%' },
  { id: 'magnet',  icon: '🧲', name: '별똥별 자석',    cost: 3,  desc: '보너스 별 등장 간격 -30%' },
  { id: 'linger',  icon: '🐢', name: '느린 별똥별',    cost: 3,  desc: '보너스 별이 2배 오래 머무름' },
  { id: 'night',   icon: '🌙', name: '긴 밤',          cost: 4,  desc: '오프라인 보상 최대 8시간 → 24시간' },
  { id: 'design',  icon: '📐', name: '효율적 설계',    cost: 5,  desc: '생산기 가격 -10%' },
  { id: 'touch',   icon: '✋', name: '성핵 손가락',    cost: 6,  desc: '클릭 시 초당 생산량의 3% 추가' },
  { id: 'awake',   icon: '👁️', name: '잠들지 않는 별', cost: 8,  desc: '오프라인 효율 75% → 100%', req: 'dream' },
  { id: 'golden',  icon: '🌟', name: '황금 별똥별',    cost: 10, desc: '보너스 별 효과 2배 (획득량·지속시간)', req: 'magnet' },
  { id: 'engine',  icon: '⚙️', name: '우주 공학',      cost: 12, desc: '업그레이드 가격 -25%', req: 'design' },
  { id: 'amplify', icon: '💠', name: '성핵 증폭',      cost: 20, desc: '성핵 1개당 보너스 +10% → +15%' },
];
