/* 게임 밸런스·콘텐츠 데이터. 숫자/이름 조정은 여기서만 하면 된다. */
window.Idddle = window.Idddle || {};

Idddle.DATA = {
  COST_GROWTH: 1.15,          // 생산기 1개 살 때마다 가격 배율
  OFFLINE_CAP_SEC: 8 * 3600,  // 오프라인 보상 최대 8시간
  OFFLINE_RATE: 0.5,          // 오프라인 효율 50%
  AUTOSAVE_SEC: 10,
  PRESTIGE_DIVISOR: 1e6,      // 졸업장 = floor(sqrt(이번 학년 누적 지식 / 1e6))
  CORE_BONUS: 0.1,            // 졸업장 1장당 전체 생산 +10%

  // sprites: 교실 풍경에 나타나는 일꾼 모습(번갈아 사용), work: 작업 중 떠오르는 이모지, anim: 일하는 동작
  // upgrades: 생산기 업그레이드 5단계 [아이콘, 이름] — 사면 교실에 이 물건이 놓인다
  generators: [
    { id: 'pencil', name: '연필', unit: '자루', icon: '✏️', baseCost: 15, rate: 0.1,
      desc: '알아서 필기하는 신기한 연필.', sprites: ['✏️'], work: '〰️', anim: 'write',
      upgrades: [['🧽', '말랑 지우개'], ['📏', '30cm 자'], ['📐', '삼각자 세트'], ['🖍️', '무지개 색연필'], ['🖋️', '황금 만년필']] },
    { id: 'student', name: '학생', unit: '명', icon: '🧒', baseCost: 120, rate: 1,
      desc: '오늘도 열심히 공부하는 학생.', sprites: ['🧒', '👧', '👦', '🧑'], work: '💡', anim: 'nod',
      upgrades: [['🎒', '새 책가방'], ['📓', '오답 노트'], ['🧮', '주판 특훈'], ['🏅', '우등상'], ['👑', '전교 1등']] },
    { id: 'teacher', name: '선생님', unit: '명', icon: '🧑‍🏫', baseCost: 1300, rate: 9,
      desc: '지식을 아낌없이 나눠준다.', sprites: ['🧑‍🏫', '👩‍🏫', '👨‍🏫'], work: '📢', anim: 'sway',
      upgrades: [['📋', '수업 계획서'], ['🍎', '학생이 준 사과'], ['📊', '판서 실력'], ['🎤', '무선 마이크'], ['🏆', '올해의 교사']] },
    { id: 'library', name: '도서관', unit: '곳', icon: '📚', baseCost: 14000, rate: 50,
      desc: '수천 권의 책이 지식을 뿜어낸다.', sprites: ['📚', '📖', '📕', '📗'], work: '📄', anim: 'read',
      upgrades: [['🪑', '푹신한 의자'], ['🕯️', '독서등'], ['🗂️', '도서 분류법'], ['📜', '고문서 보관실'], ['🗝️', '금단의 서고']] },
    { id: 'lab', name: '과학실', unit: '곳', icon: '🔬', baseCost: 160000, rate: 280,
      desc: '실험할 때마다 새로운 발견이!', sprites: ['🧑‍🔬', '👩‍🔬', '👨‍🔬'], work: '⚗️', anim: 'shake',
      upgrades: [['🧪', '시험관 세트'], ['🧲', '강력 자석'], ['⚗️', '증류 장치'], ['🧬', 'DNA 모형'], ['🔭', '천체 망원경']] },
    { id: 'computer', name: '컴퓨터실', unit: '곳', icon: '💻', baseCost: 1.8e6, rate: 1500,
      desc: '인터넷의 모든 지식을 내려받는다.', sprites: ['💻', '🖥️'], work: '💾', anim: 'blink',
      upgrades: [['🖱️', '게이밍 마우스'], ['⌨️', '기계식 키보드'], ['🖨️', '고속 프린터'], ['💽', 'SSD 교체'], ['🤖', 'AI 조교']] },
    { id: 'university', name: '대학교', unit: '곳', icon: '🏛️', baseCost: 2.5e7, rate: 8500,
      desc: '학문의 전당. 연구가 끊이지 않는다.', sprites: ['🏛️', '🏫'], work: '🎓', anim: 'float',
      upgrades: [['📜', '학위 수여식'], ['💰', '연구 장학금'], ['🔬', '부설 연구소'], ['🌍', '국제 학회'], ['🏅', '노벨상']] },
  ],

  // 생산기 업그레이드 단계: 해당 생산기를 `need`개 보유하면 등장, 가격 = baseCost * costMul, 효과 x2
  genUpgradeTiers: [
    { need: 1,   costMul: 10 },
    { need: 10,  costMul: 60 },
    { need: 25,  costMul: 600 },
    { need: 50,  costMul: 8000 },
    { need: 100, costMul: 2e5 },
  ],

  // 클릭 업그레이드: 사면 공부 책상 위에 아이콘이 놓인다
  clickUpgrades: [
    { id: 'click1', name: '바른 자세',   icon: '🪑', cost: 100,  needClicks: 10,   mult: 2, desc: '공부 클릭 x2' },
    { id: 'click2', name: '형광펜',      icon: '🖍️', cost: 5000, needClicks: 100,  mult: 2, desc: '공부 클릭 x2' },
    { id: 'click3', name: '예습 복습',   icon: '📝', cost: 2e5,  needClicks: 500,  lpsFrac: 0.01, desc: '클릭 시 초당 생산량의 1% 추가' },
    { id: 'click4', name: '만점 노트',   icon: '💯', cost: 1e7,  needClicks: 1500, lpsFrac: 0.02, desc: '클릭 시 초당 생산량의 2% 추가' },
  ],
};

// ---------- 칭찬 스티커 (보너스) ----------
Idddle.DATA.bonusStar = {
  firstDelaySec: [20, 45],    // 접속 후 첫 등장
  delaySec: [60, 150],        // 이후 등장 간격 (랜덤)
  lifeSec: 12,                // 화면에 머무는 시간
  effects: [
    { id: 'lucky',  weight: 5, name: '참 잘했어요', desc: '지식 즉시 획득' },
    { id: 'storm',  weight: 4, name: '집중 시간',   desc: '30초간 생산 x7',  kind: 'prod',  mult: 7,  sec: 30 },
    { id: 'frenzy', weight: 2, name: '필기 폭주',   desc: '15초간 클릭 x15', kind: 'click', mult: 15, sec: 15 },
  ],
};

// ---------- 업적 ----------
// 업적 1개당 전체 생산 +ACH_BONUS. cond(s, e): s = 상태, e = 엔진
Idddle.DATA.ACH_BONUS = 0.02;
Idddle.DATA.achievements = (function () {
  const list = [];
  const add = function (id, name, icon, desc, cond) { list.push({ id: id, name: name, icon: icon, desc: desc, cond: cond }); };
  const fmtN = function (n) { return Idddle.fmt ? Idddle.fmt(n) : String(n); };

  [[1e2, '첫 깨달음'], [1e4, '지식 주머니'], [1e6, '걸어다니는 백과사전'], [1e8, '박사급 두뇌'], [1e10, '노벨상 후보'], [1e12, '인류의 지성'], [1e15, '우주의 진리']]
    .forEach(function (x, i) { add('total' + i, x[1], '🧠', () => '누적 지식 ' + fmtN(x[0]) + ' 달성', function (s) { return s.allTime >= x[0]; }); });

  [[1, '첫 필기'], [100, '부지런한 손'], [1000, '필기 장인'], [5000, '손목 괜찮아요?']]
    .forEach(function (x, i) { add('click' + i, x[1], '✍️', () => '공부 ' + fmtN(x[0]) + '회 클릭', function (s) { return s.clicks >= x[0]; }); });

  [[10, '공부 습관'], [1000, '집중력 향상'], [1e5, '몰입의 경지'], [1e7, '지식 폭발']]
    .forEach(function (x, i) { add('lps' + i, x[1], '📈', () => '초당 지식 ' + fmtN(x[0]), function (s, e) { return e.lps() >= x[0]; }); });

  Idddle.DATA.generators.forEach(function (g) {
    [[1, '첫 '], [25, '든든한 '], [100, '전설의 ']].forEach(function (x, i) {
      add('gen_' + g.id + i, x[1] + g.name, g.icon, () => g.name + ' ' + x[0] + g.unit + ' 보유', function (s) { return s.gens[g.id] >= x[0]; });
    });
  });

  [[1, '칭찬받았어요'], [10, '칭찬 수집가'], [50, '모범생']]
    .forEach(function (x, i) { add('bonus' + i, x[1], '🌟', () => '칭찬 스티커 ' + x[0] + '장 모으기', function (s) { return s.bonusClicks >= x[0]; }); });

  [[10, '배움의 시작'], [30, '자기계발 중독']]
    .forEach(function (x, i) { add('upg' + i, x[1], '📘', () => '업그레이드 ' + x[0] + '개 구매', function (s) { return Object.keys(s.upgrades).length >= x[0]; }); });

  [[1, '첫 졸업'], [5, '졸업 장인']]
    .forEach(function (x, i) { add('pres' + i, x[1], '🎓', () => '졸업 ' + x[0] + '회', function (s) { return s.prestiges >= x[0]; }); });

  return list;
})();

// ---------- 학교 발전 계획 (졸업장으로 사는 영구 강화, 졸업해도 유지) ----------
// 졸업장 보너스(+10%/장)는 '받은 졸업장 총량' 기준이라 연구에 써도 줄지 않는다.
Idddle.DATA.research = [
  { id: 'legacy',  icon: '🎁', name: '신입생 장학금', cost: 1,  desc: '졸업 후 지식 1,000과 연필 10자루로 시작' },
  { id: 'dream',   icon: '💤', name: '꿈속 복습',     cost: 2,  desc: '오프라인 효율 50% → 75%' },
  { id: 'magnet',  icon: '😊', name: '칭찬 문화',     cost: 3,  desc: '칭찬 스티커 등장 간격 -30%' },
  { id: 'linger',  icon: '🐢', name: '느긋한 선생님', cost: 3,  desc: '칭찬 스티커가 2배 오래 머무름' },
  { id: 'night',   icon: '🌙', name: '야간 자율학습', cost: 4,  desc: '오프라인 보상 최대 8시간 → 24시간' },
  { id: 'design',  icon: '🛒', name: '교구 공동구매', cost: 5,  desc: '생산기 가격 -10%' },
  { id: 'touch',   icon: '✋', name: '필기 요령',     cost: 6,  desc: '클릭 시 초당 생산량의 3% 추가' },
  { id: 'awake',   icon: '☕', name: '밤샘 공부',     cost: 8,  desc: '오프라인 효율 75% → 100%', req: 'dream' },
  { id: 'golden',  icon: '🌟', name: '금빛 스티커',   cost: 10, desc: '칭찬 스티커 효과 2배 (획득량·지속시간)', req: 'magnet' },
  { id: 'engine',  icon: '🏦', name: '교육 예산 확보', cost: 12, desc: '업그레이드 가격 -25%', req: 'design' },
  { id: 'amplify', icon: '🏫', name: '명문 학교',     cost: 20, desc: '졸업장 1장당 보너스 +10% → +15%' },
];
