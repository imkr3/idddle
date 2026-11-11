/* 게임 콘텐츠·밸런스 데이터. 이름·숫자 조정은 이 파일에서만 하면 된다.
 * (쪽지 시험 문제 은행은 quiz-data.js, 규칙은 engine.js)
 * 수치는 tools/sim.js 시뮬레이션으로 맞췄다. 바꾼 뒤에는 `npm run sim`으로 흐름을 확인할 것. */
window.Idddle = window.Idddle || {};

(function () {
  const D = Idddle.DATA = {
    VERSION: '1.0.0',

    // ---------- 기본 규칙 ----------
    COST_GROWTH: 1.15,          // 생산기 1개 살 때마다 가격 배율
    OFFLINE_CAP_SEC: 8 * 3600,  // 오프라인 보상 최대 8시간
    OFFLINE_RATE: 0.5,          // 오프라인 효율 50%
    AUTOSAVE_SEC: 10,
    // 받은 졸업장 총량 = floor(scale × (전체 누적 지식 / divisor) ^ power)
    // power가 작을수록 졸업 보상이 완만하게 커진다 (크면 몇 번 졸업한 뒤 폭주한다)
    // unlockAt: 전체 누적 지식이 이만큼 되어야 졸업할 수 있다 (첫 졸업이 너무 일찍 오지 않게)
    prestige: { divisor: 1e9, power: 0.15, scale: 10, unlockAt: 1e8 },
    CORE_BONUS: 0.05,           // 졸업장 1장당 전체 생산 +5%
    ACH_BONUS: 0.01,            // 업적 1개당 전체 생산 +1%
    LUNCH_COST_MUL: 1.5,        // 급식 가격 = 등장 조건(need) × 이 값

    // 클릭: 집중력(콤보)과 아하!(치명타)
    click: {
      critChance: 0.03, critMult: 10,
      comboGain: 6,      // 클릭 1번에 차는 집중력 (0~100)
      comboDecay: 6,     // 초당 줄어드는 집중력
      comboMax: 2,       // 집중력이 가득일 때 클릭 배율
    },

    // ---------- 생산기 ----------
    // sprites: 교실에 나타나는 일꾼 모습(번갈아 사용), work: 일할 때 떠오르는 이모지, anim: 일하는 동작
    // upgrades: 업그레이드 7단계 [아이콘, 이름] — 사면 그 교실 선반에 이 물건이 놓인다
    generators: [
      { id: 'pencil', name: '연필', unit: '자루', icon: '✏️', baseCost: 12, rate: 0.1,
        desc: '알아서 필기하는 신기한 연필.', sprites: ['✏️', '✏️', '🖊️'], work: '〰️', anim: 'write',
        upgrades: [['🧽', '말랑 지우개'], ['📏', '30cm 자'], ['📐', '삼각자 세트'], ['🖍️', '무지개 색연필'], ['🖋️', '황금 만년필'], ['🖌️', '명필의 붓'], ['🪄', '요술 연필']] },
      { id: 'student', name: '학생', unit: '명', icon: '🧒', baseCost: 110, rate: 1,
        desc: '오늘도 열심히 공부하는 학생.', sprites: ['🧒', '👧', '👦', '🧑'], work: '💡', anim: 'nod',
        upgrades: [['🎒', '새 책가방'], ['📓', '오답 노트'], ['🧮', '주판 특훈'], ['🏅', '우등상'], ['👑', '전교 1등'], ['🧠', '암기 천재'], ['🦸', '공부의 신']] },
      { id: 'teacher', name: '선생님', unit: '명', icon: '🧑‍🏫', baseCost: 1300, rate: 8,
        desc: '지식을 아낌없이 나눠준다.', sprites: ['🧑‍🏫', '👩‍🏫', '👨‍🏫'], work: '📢', anim: 'sway',
        upgrades: [['📋', '수업 계획서'], ['🍎', '학생이 준 사과'], ['📊', '판서 실력'], ['🎤', '무선 마이크'], ['🏆', '올해의 교사'], ['📣', '전설의 명강의'], ['🎖️', '스승의 은혜']] },
      { id: 'library', name: '도서관', unit: '곳', icon: '📚', baseCost: 16000, rate: 57,
        desc: '수천 권의 책이 지식을 뿜어낸다.', sprites: ['📚', '📖', '📕', '📗'], work: '📄', anim: 'read',
        upgrades: [['🪑', '푹신한 의자'], ['🕯️', '독서등'], ['🗂️', '도서 분류법'], ['📜', '고문서 보관실'], ['🗝️', '금단의 서고'], ['🔖', '마법의 책갈피'], ['📖', '스스로 읽히는 책']] },
      { id: 'lab', name: '과학실', unit: '곳', icon: '🔬', baseCost: 2e5, rate: 330,
        desc: '실험할 때마다 새로운 발견이!', sprites: ['🧑‍🔬', '👩‍🔬', '👨‍🔬'], work: '⚗️', anim: 'shake',
        upgrades: [['🧪', '시험관 세트'], ['🧲', '강력 자석'], ['⚗️', '증류 장치'], ['🧬', 'DNA 모형'], ['🔭', '천체 망원경'], ['⚛️', '입자 가속기'], ['🧫', '생명의 비밀']] },
      { id: 'computer', name: '컴퓨터실', unit: '곳', icon: '💻', baseCost: 2.6e6, rate: 1700,
        desc: '인터넷의 모든 지식을 내려받는다.', sprites: ['💻', '🖥️'], work: '💾', anim: 'blink',
        upgrades: [['🖱️', '게이밍 마우스'], ['⌨️', '기계식 키보드'], ['🖨️', '고속 프린터'], ['💽', 'SSD 교체'], ['🤖', 'AI 조교'], ['📡', '초고속 인터넷'], ['🧿', '양자 컴퓨터']] },
      { id: 'university', name: '대학교', unit: '곳', icon: '🏛️', baseCost: 3.5e7, rate: 9200,
        desc: '학문의 전당. 연구가 끊이지 않는다.', sprites: ['🏛️', '🏫'], work: '🎓', anim: 'float',
        upgrades: [['📜', '학위 수여식'], ['💰', '연구 장학금'], ['🔬', '부설 연구소'], ['🌍', '국제 학회'], ['🏅', '노벨상'], ['🏟️', '대강당'], ['🎓', '명예 박사']] },
      { id: 'online', name: '인터넷 강의', unit: '채널', icon: '📺', baseCost: 6e8, rate: 55000,
        desc: '전국의 학생이 동시에 듣는 명강의.', sprites: ['📺', '🎥', '🎙️'], work: '❤️', anim: 'blink',
        upgrades: [['💡', '링 라이트'], ['🎧', '고급 헤드셋'], ['📈', '구독자 100만'], ['🌐', '다국어 자막'], ['🛰️', '위성 생중계'], ['🎬', '전문 편집팀'], ['🥽', '가상현실 교실']] },
      { id: 'space', name: '우주 학교', unit: '곳', icon: '🚀', baseCost: 1.2e10, rate: 360000,
        desc: '무중력에서 배우는 물리 수업.', sprites: ['🧑‍🚀', '👩‍🚀', '👨‍🚀'], work: '⭐', anim: 'float',
        upgrades: [['🛸', '셔틀 버스'], ['🪐', '행성 견학'], ['👽', '외계인 교환학생'], ['🌌', '은하 도서관'], ['☄️', '혜성 채집'], ['🌠', '별똥별 관측'], ['🌞', '항성 발전소']] },
      { id: 'timemachine', name: '타임머신 교실', unit: '대', icon: '⏳', baseCost: 2.6e11, rate: 2.6e6,
        desc: '과거와 미래의 지식을 한꺼번에 배운다.', sprites: ['⏳', '⌛', '🕰️'], work: '🌀', anim: 'spin',
        upgrades: [['🦕', '공룡 생태 수업'], ['🏺', '고대 문명 체험'], ['🗿', '석상의 비밀'], ['🔮', '미래 예측'], ['♾️', '시간의 끝'], ['⚙️', '시간 톱니바퀴'], ['🧭', '역사의 나침반']] },
      { id: 'dream', name: '꿈속 학교', unit: '곳', icon: '💤', baseCost: 6.5e12, rate: 2e7,
        desc: '자는 동안에도 수업은 계속된다.', sprites: ['😴', '🛌', '🌙'], work: '💭', anim: 'float',
        upgrades: [['🛏️', '구름 침대'], ['🧸', '포근한 인형'], ['🎶', '달빛 자장가'], ['🐑', '양 세기 수업'], ['🌜', '자각몽 훈련'], ['🪶', '깃털 베개'], ['🎠', '꿈의 놀이공원']] },
      { id: 'tree', name: '지식의 나무', unit: '그루', icon: '🌳', baseCost: 1.7e14, rate: 1.7e8,
        desc: '열매 하나에 백과사전 한 질.', sprites: ['🌳', '🌲', '🌴'], work: '🍃', anim: 'sway',
        upgrades: [['💧', '맑은 샘물'], ['🌱', '새싹 돌보기'], ['🐝', '꿀벌 도우미'], ['🍎', '지혜의 열매'], ['🦉', '현명한 부엉이'], ['🍄', '버섯 균사망'], ['🌸', '만개한 꽃']] },
      { id: 'multiverse', name: '평행우주 분교', unit: '곳', icon: '🌀', baseCost: 4.8e15, rate: 1.5e9,
        desc: '다른 우주의 내가 대신 공부해 준다.', sprites: ['🌀', '🚪', '🪞'], work: '✨', anim: 'spin',
        upgrades: [['🚪', '차원의 문'], ['🪞', '거울 속 교실'], ['👥', '또 다른 나'], ['🎲', '확률 수업'], ['🕳️', '웜홀 통학로'], ['🧶', '끈 이론'], ['🎭', '무한한 가능성']] },
      { id: 'truth', name: '진리의 전당', unit: '곳', icon: '🏯', baseCost: 1.4e17, rate: 1.3e10,
        desc: '모든 질문의 답이 모이는 곳.', sprites: ['🧙', '🦉', '🏯'], work: '🔆', anim: 'float',
        upgrades: [['🕯️', '꺼지지 않는 촛불'], ['📜', '태초의 두루마리'], ['🦉', '지혜의 수호자'], ['⚖️', '완벽한 균형'], ['💠', '순수한 깨달음'], ['🔱', '세 가지 진리'], ['🌟', '궁극의 답']] },
    ],

    // 생산기 업그레이드 단계: 해당 생산기를 need개 보유하면 등장, 가격 = baseCost × costMul, 효과 x2
    // (가격은 그 시점 생산기 1개 값의 10배쯤)
    genUpgradeTiers: [
      { need: 1,   costMul: 8 },
      { need: 10,  costMul: 40 },
      { need: 25,  costMul: 400 },
      { need: 50,  costMul: 1.5e4 },
      { need: 100, costMul: 1.5e7 },
      { need: 150, costMul: 1.5e10 },
      { need: 200, costMul: 1.5e13 },
    ],

    // 시너지: a 생산기가 b 생산기 1개당 pct만큼 더 생산 (a를 needA, b를 needB개 이상 가지면 등장)
    // 가격 = a의 baseCost × costMul
    synergies: [
      { id: 'tutor',   icon: '✍️', name: '필기 도우미',       a: 'pencil',      b: 'student',     pct: 0.03,  needA: 25, needB: 10,  costMul: 1500 },
      { id: 'lesson',  icon: '🤝', name: '1:1 과외',          a: 'student',     b: 'teacher',     pct: 0.02,  needA: 15, needB: 5,   costMul: 400 },
      { id: 'refs',    icon: '📑', name: '수업 자료실',       a: 'teacher',     b: 'library',     pct: 0.03,  needA: 10, needB: 5,   costMul: 600 },
      { id: 'scibook', icon: '🔖', name: '과학 도서 코너',    a: 'library',     b: 'lab',         pct: 0.02,  needA: 10, needB: 5,   costMul: 500 },
      { id: 'sim',     icon: '🧮', name: '시뮬레이션 실험',   a: 'lab',         b: 'computer',    pct: 0.02,  needA: 10, needB: 5,   costMul: 400 },
      { id: 'server',  icon: '🗄️', name: '대학 전산 센터',    a: 'computer',    b: 'university',  pct: 0.02,  needA: 10, needB: 5,   costMul: 400 },
      { id: 'coop',    icon: '🏭', name: '산학 협력',         a: 'university',  b: 'lab',         pct: 0.01,  needA: 5,  needB: 25,  costMul: 300 },
      { id: 'star',    icon: '🌟', name: '스타 강사',         a: 'online',      b: 'teacher',     pct: 0.005, needA: 5,  needB: 50,  costMul: 200 },
      { id: 'scholar', icon: '🎖️', name: '우주 장학생',       a: 'space',       b: 'university',  pct: 0.01,  needA: 5,  needB: 25,  costMul: 200 },
      { id: 'history', icon: '🖊️', name: '역사를 적는 연필', a: 'timemachine', b: 'pencil',      pct: 0.003, needA: 5,  needB: 100, costMul: 200 },
      { id: 'sleep',   icon: '🎧', name: '자면서 듣는 강의',  a: 'dream',       b: 'online',      pct: 0.01,  needA: 5,  needB: 25,  costMul: 200 },
      { id: 'shade',   icon: '⛱️', name: '나무 그늘 독서',    a: 'tree',        b: 'library',     pct: 0.005, needA: 5,  needB: 50,  costMul: 200 },
      { id: 'warp',    icon: '🛤️', name: '차원 이동 수업',    a: 'multiverse',  b: 'timemachine', pct: 0.01,  needA: 5,  needB: 25,  costMul: 200 },
      { id: 'theory',  icon: '📐', name: '만물의 이론',       a: 'truth',       b: 'space',       pct: 0.01,  needA: 5,  needB: 25,  costMul: 200 },
      // 2단계 시너지 (후반)
      { id: 'cheer',   icon: '📣', name: '전교생 응원',       a: 'teacher',     b: 'student',     pct: 0.01,  needA: 100, needB: 100, costMul: 5e8 },
      { id: 'archive', icon: '💾', name: '전자 도서관',       a: 'library',     b: 'computer',    pct: 0.01,  needA: 100, needB: 100, costMul: 5e8 },
      { id: 'orbit',   icon: '📡', name: '우주 중계 강의',    a: 'online',      b: 'space',       pct: 0.01,  needA: 100, needB: 75,  costMul: 5e8 },
      { id: 'lucid',   icon: '🌠', name: '꿈속의 시간 여행',  a: 'timemachine', b: 'dream',       pct: 0.01,  needA: 100, needB: 50,  costMul: 5e8 },
    ],

    // 클릭 업그레이드: 사면 공부 책상 위에 놓인다. needClicks = 등장에 필요한 누적 클릭 수
    clickUpgrades: [
      { id: 'click1', name: '바른 자세',     icon: '🪑', cost: 60,    needClicks: 10,   mult: 2, desc: '클릭 지식 x2' },
      { id: 'click2', name: '형광펜',        icon: '🖍️', cost: 500,   needClicks: 40,   mult: 2, desc: '클릭 지식 x2' },
      { id: 'click3', name: '예습 복습',     icon: '📝', cost: 6000,  needClicks: 120,  lpsFrac: 0.01, desc: '클릭할 때 초당 생산량의 1% 추가' },
      { id: 'click4', name: '만점 노트',     icon: '💯', cost: 1.2e5, needClicks: 250,  lpsFrac: 0.01, desc: '클릭할 때 초당 생산량의 1% 추가' },
      { id: 'click5', name: '암기 카드',     icon: '🃏', cost: 3e6,   needClicks: 500,  mult: 2, desc: '클릭 지식 x2' },
      { id: 'click6', name: '집중력 영양제', icon: '💊', cost: 8e7,   needClicks: 900,  lpsFrac: 0.01, desc: '클릭할 때 초당 생산량의 1% 추가' },
      { id: 'click7', name: '속독 안경',     icon: '👓', cost: 4e9,   needClicks: 1500, lpsFrac: 0.01, desc: '클릭할 때 초당 생산량의 1% 추가' },
      { id: 'click8', name: '천재의 영감',   icon: '⚡', cost: 5e11,  needClicks: 2500, lpsFrac: 0.02, desc: '클릭할 때 초당 생산량의 2% 추가' },
    ],

    // 급식: 이번 학기 누적 지식이 need를 넘으면 등장. 전체 생산 +pct. 사면 급식실에 차려진다
    lunches: [
      { id: 'milk',     icon: '🥛', name: '흰 우유',       need: 2e3,  pct: 0.1 },
      { id: 'riceball', icon: '🍙', name: '주먹밥',        need: 6e4,  pct: 0.1 },
      { id: 'dumpling', icon: '🥟', name: '군만두',        need: 2e6,  pct: 0.1 },
      { id: 'noodle',   icon: '🍜', name: '잔치국수',      need: 6e7,  pct: 0.1 },
      { id: 'curry',    icon: '🍛', name: '카레라이스',    need: 2e9,  pct: 0.1 },
      { id: 'pasta',    icon: '🍝', name: '스파게티',      need: 1e11, pct: 0.1 },
      { id: 'chicken',  icon: '🍗', name: '치킨',          need: 6e12, pct: 0.1 },
      { id: 'pizza',    icon: '🍕', name: '피자',          need: 5e14, pct: 0.1 },
      { id: 'ribs',     icon: '🍖', name: '갈비찜',        need: 5e16, pct: 0.1 },
      { id: 'bento',    icon: '🍱', name: '특식 도시락',   need: 5e18, pct: 0.1 },
      { id: 'cake',     icon: '🍰', name: '생일 케이크',   need: 5e20, pct: 0.1 },
      { id: 'icecream', icon: '🍦', name: '아이스크림',    need: 5e22, pct: 0.1 },
    ],

    // ---------- 시간표 ----------
    // 교시마다 정해진 교실의 생산량이 boost배. 점심시간에는 클릭이 강해진다.
    timetable: {
      periodSec: 45, boost: 2,
      periods: [
        { id: 'korean',  name: '1교시 국어', icon: '📖', gens: ['pencil', 'library'] },
        { id: 'math',    name: '2교시 수학', icon: '🧮', gens: ['student', 'computer'] },
        { id: 'science', name: '3교시 과학', icon: '🔬', gens: ['lab', 'space'] },
        { id: 'social',  name: '4교시 사회', icon: '🌍', gens: ['teacher', 'university'] },
        { id: 'lunch',   name: '점심시간',   icon: '🍱', gens: [], click: 3 },
        { id: 'english', name: '5교시 영어', icon: '🔤', gens: ['online', 'multiverse'] },
        { id: 'history', name: '6교시 역사', icon: '🏺', gens: ['timemachine', 'truth'] },
        { id: 'after',   name: '방과후',     icon: '🌙', gens: ['dream', 'tree'] },
      ],
    },

    // ---------- 칭찬 스티커 (가끔 나타나는 보너스) ----------
    praise: {
      firstDelaySec: [20, 45],    // 접속 후 첫 등장
      delaySec: [75, 165],        // 이후 등장 간격 (랜덤)
      lifeSec: 12,                // 화면에 머무는 시간
      albumChance: 0.2,           // 받을 때 앨범 스티커가 함께 나올 확률
      lucky: { bank: 0.10, capSec: 240, baseSec: 15 },   // 참 잘했어요: min(가진 지식 × bank, 생산 capSec초) + 생산 baseSec초
      giftPct: 0.03,              // 교장선생님 선물: 고른 생산기 보유량의 이만큼(최소 1개)
      miniCount: 8, miniSec: 8,   // 스티커 비: 작은 스티커 수, 하나당 생산 몇 초치
      effects: [
        { id: 'lucky',  weight: 5,   name: '참 잘했어요',     desc: '지식을 바로 받아요' },
        { id: 'storm',  weight: 4,   name: '집중 시간',       desc: '30초간 생산 x5',  kind: 'prod',  mult: 5,    sec: 30 },
        { id: 'frenzy', weight: 2,   name: '필기 폭주',       desc: '15초간 클릭 x10', kind: 'click', mult: 10,   sec: 15 },
        { id: 'gift',   weight: 1.5, name: '교장선생님 선물', desc: '가진 생산기 중 하나를 공짜로 더 받아요' },
        { id: 'sale',   weight: 1.5, name: '바자회',          desc: '40초간 생산기 가격 -25%', kind: 'cost', mult: 0.75, sec: 40 },
        { id: 'rain',   weight: 1,   name: '스티커 비',       desc: '작은 스티커가 쏟아져요. 눌러서 받으세요!' },
      ],
    },

    // ---------- 스티커 앨범 (수집) ----------
    // 처음 얻은 스티커 1종마다 전체 생산 +pct, 같은 등급을 다 모으면 setBonus 추가
    rarities: {
      common: { name: '일반', weight: 60, pct: 0.01, setBonus: 0.10, color: '#8fd3ff' },
      rare:   { name: '희귀', weight: 28, pct: 0.02, setBonus: 0.15, color: '#b8f2a1' },
      epic:   { name: '영웅', weight: 10, pct: 0.04, setBonus: 0.25, color: '#d9a8ff' },
      legend: { name: '전설', weight: 2,  pct: 0.10, setBonus: 0.50, color: '#ffe066' },
    },
    stickers: [
      { id: 'star', icon: '⭐', name: '반짝 별', rarity: 'common' },
      { id: 'heart', icon: '❤️', name: '하트', rarity: 'common' },
      { id: 'blossom', icon: '🌸', name: '벚꽃', rarity: 'common' },
      { id: 'clover', icon: '🍀', name: '네잎클로버', rarity: 'common' },
      { id: 'puppy', icon: '🐶', name: '강아지', rarity: 'common' },
      { id: 'kitty', icon: '🐱', name: '고양이', rarity: 'common' },
      { id: 'apple', icon: '🍎', name: '빨간 사과', rarity: 'common' },
      { id: 'sun', icon: '☀️', name: '해님', rarity: 'common' },
      { id: 'rainbow', icon: '🌈', name: '무지개', rarity: 'common' },
      { id: 'balloon', icon: '🎈', name: '풍선', rarity: 'common' },
      { id: 'chick', icon: '🐥', name: '병아리', rarity: 'common' },
      { id: 'berry', icon: '🍓', name: '딸기', rarity: 'common' },
      { id: 'rocket', icon: '🚀', name: '로켓', rarity: 'rare' },
      { id: 'dino', icon: '🦖', name: '공룡', rarity: 'rare' },
      { id: 'guitar', icon: '🎸', name: '기타', rarity: 'rare' },
      { id: 'soccer', icon: '⚽', name: '축구공', rarity: 'rare' },
      { id: 'palette', icon: '🎨', name: '팔레트', rarity: 'rare' },
      { id: 'teddy', icon: '🧸', name: '곰 인형', rarity: 'rare' },
      { id: 'donut', icon: '🍩', name: '도넛', rarity: 'rare' },
      { id: 'fox', icon: '🦊', name: '여우', rarity: 'rare' },
      { id: 'panda', icon: '🐼', name: '판다', rarity: 'rare' },
      { id: 'unicorn', icon: '🦄', name: '유니콘', rarity: 'epic' },
      { id: 'dragon', icon: '🐉', name: '용', rarity: 'epic' },
      { id: 'crown', icon: '👑', name: '왕관', rarity: 'epic' },
      { id: 'gem', icon: '💎', name: '보석', rarity: 'epic' },
      { id: 'trophy', icon: '🏆', name: '우승 트로피', rarity: 'epic' },
      { id: 'volcano', icon: '🌋', name: '화산', rarity: 'epic' },
      { id: 'goldstar', icon: '🌟', name: '황금 별', rarity: 'legend' },
      { id: 'goldcap', icon: '🎓', name: '황금 학사모', rarity: 'legend' },
      { id: 'goldschool', icon: '🏫', name: '황금 학교', rarity: 'legend' },
    ],
    albumPity: 20,   // 이만큼 연속으로 새 스티커가 안 나오면, 아직 없는 스티커(전설 제외)를 보장
    legendPity: 100, // 이만큼 연속으로 전설이 안 나오면, 아직 없는 전설 스티커를 보장
    albumDupSec: 20, // 이미 있는 스티커는 생산 몇 초치 지식으로 돌려받는다

    // ---------- 쪽지 시험 ----------
    // 과목은 학년(grade 번호)이 오르면 열린다
    quiz: {
      cooldownSec: 150, timeSec: 12, rewardSec: 20, rewardMin: 20, stickerChance: 0.08,
      subjects: [
        { id: 'math',     name: '산수',      icon: '🧮', grade: 0 },
        { id: 'english',  name: '영어',      icon: '🔤', grade: 1 },
        { id: 'spelling', name: '맞춤법',    icon: '✍️', grade: 3 },
        { id: 'capitals', name: '세계 수도', icon: '🌍', grade: 5 },
        { id: 'science',  name: '과학',      icon: '🔬', grade: 7 },
        { id: 'proverbs', name: '속담',      icon: '📜', grade: 9 },
      ],
    },

    // 출석: 하루 한 번, 연속 출석일수(최대 maxStreakBonus)만큼 보상이 커진다. 7일마다 스티커 묶음이 커진다
    attendance: { maxStreakBonus: 7, rewardSec: 300, rewardMin: 30, stickers: 2, weekStickers: 5 },

    // 학년: 전체 누적 지식이 at 이상이면 그 학년
    grades: [
      ['유치원', 0], ['초등 1학년', 1e2], ['초등 2학년', 1e3], ['초등 3학년', 1e4], ['초등 4학년', 1e5], ['초등 5학년', 1e6], ['초등 6학년', 1e7],
      ['중학 1학년', 1e8], ['중학 2학년', 1e9], ['중학 3학년', 1e10], ['고등 1학년', 1e11], ['고등 2학년', 1e12], ['고등 3학년', 1e13],
      ['대학 1학년', 1e14], ['대학 2학년', 1e15], ['대학 3학년', 1e16], ['대학 4학년', 1e17], ['석사', 1e18], ['박사', 1e19],
      ['연구원', 1e20], ['조교수', 1e21], ['부교수', 1e22], ['정교수', 1e23], ['석좌교수', 1e24], ['학장', 1e25], ['총장', 1e26],
      ['노벨상 수상자', 1e28], ['살아있는 전설', 1e30], ['인류의 스승', 1e33], ['지식의 화신', 1e36],
    ].map(function (x) { return { name: x[0], at: x[1] }; }),
  };

  // ---------- 학교 발전 계획 (졸업장으로 사는 영구 강화, 졸업해도 유지) ----------
  // 졸업장 보너스는 '받은 졸업장 총량' 기준이라 여기에 써도 줄지 않는다.
  // repeat: 여러 번 살 수 있음 (가격은 살 때마다 × growth)
  D.researchBranches = [
    { id: 'start',  name: '입학 준비' },
    { id: 'rest',   name: '휴식' },
    { id: 'praise', name: '칭찬' },
    { id: 'money',  name: '예산' },
    { id: 'study',  name: '공부법' },
    { id: 'class',  name: '수업' },
    { id: 'grad',   name: '졸업' },
  ];
  D.research = [
    { id: 'legacy',   branch: 'start',  icon: '🎁', name: '신입생 장학금', cost: 1,   desc: '졸업 후 지식 1,000과 연필 10자루로 시작' },
    { id: 'legacy2',  branch: 'start',  icon: '🏫', name: '전통의 명문',   cost: 15,  desc: '졸업 후 연필·학생·선생님을 25씩 가지고 시작', req: 'legacy' },
    { id: 'legacy3',  branch: 'start',  icon: '🚌', name: '통학 버스',     cost: 90, desc: '졸업 후 앞의 7개 교실을 50씩 가지고 시작', req: 'legacy2' },

    { id: 'dream',    branch: 'rest',   icon: '💤', name: '꿈속 복습',     cost: 2,   desc: '오프라인 효율 50% → 75%' },
    { id: 'night',    branch: 'rest',   icon: '🌙', name: '야간 자율학습', cost: 4,   desc: '오프라인 보상 최대 8시간 → 24시간' },
    { id: 'awake',    branch: 'rest',   icon: '☕', name: '밤샘 공부',     cost: 8,   desc: '오프라인 효율 75% → 100%', req: 'dream' },
    { id: 'night2',   branch: 'rest',   icon: '🏖️', name: '방학 특강',     cost: 30,  desc: '오프라인 보상 최대 24시간 → 72시간', req: 'night' },

    { id: 'magnet',   branch: 'praise', icon: '😊', name: '칭찬 문화',     cost: 3,   desc: '칭찬 스티커 등장 간격 -30%' },
    { id: 'linger',   branch: 'praise', icon: '🐢', name: '느긋한 선생님', cost: 3,   desc: '칭찬 스티커가 2배 오래 머무름' },
    { id: 'golden',   branch: 'praise', icon: '🌟', name: '금빛 스티커',   cost: 10,  desc: '칭찬 스티커 효과 2배 (획득량·지속시간)', req: 'magnet' },
    { id: 'album1',   branch: 'praise', icon: '📔', name: '스티커 수집가', cost: 10,  desc: '칭찬 스티커에서 앨범 스티커가 나올 확률 2배', req: 'magnet' },
    { id: 'monitor',  branch: 'praise', icon: '🙋', name: '반장 선출',     cost: 22,  desc: '놓친 칭찬 스티커를 반장이 대신 받아 줌 (효과 절반)', req: 'linger' },

    { id: 'design',   branch: 'money',  icon: '🛒', name: '교구 공동구매', cost: 5,   desc: '생산기 가격 -10%' },
    { id: 'engine',   branch: 'money',  icon: '🏦', name: '교육 예산 확보', cost: 12, desc: '업그레이드 가격 -25%', req: 'design' },
    { id: 'design2',  branch: 'money',  icon: '📦', name: '대량 발주',     cost: 50,  desc: '생산기 가격 추가 -10%', req: 'engine' },

    { id: 'auto1',    branch: 'study',  icon: '🤖', name: '자동 필기',     cost: 3,   desc: '1초에 1번 자동으로 공부 (클릭과 같은 효과)' },
    { id: 'touch',    branch: 'study',  icon: '✋', name: '필기 요령',     cost: 5,   desc: '클릭할 때 초당 생산량의 3% 추가' },
    { id: 'flow',     branch: 'study',  icon: '🔥', name: '몰입',          cost: 12,  desc: '집중력 최대 배율 x2 → x3' },
    { id: 'auto2',    branch: 'study',  icon: '🦾', name: '자동 필기 II',  cost: 20,  desc: '자동 공부 1초에 4번', req: 'auto1' },
    { id: 'eureka',   branch: 'study',  icon: '💡', name: '번뜩임',        cost: 25,  desc: '아하! 확률 3% → 8%' },
    { id: 'auto3',    branch: 'study',  icon: '⚙️', name: '자동 필기 III', cost: 120, desc: '자동 공부 1초에 10번', req: 'auto2' },

    { id: 'cram',     branch: 'class',  icon: '⏱️', name: '족집게 과외',   cost: 6,   desc: '쪽지 시험 대기 시간 -40%' },
    { id: 'notes',    branch: 'class',  icon: '📓', name: '오답 노트',     cost: 14,  desc: '쪽지 시험 보상 2배', req: 'cram' },
    { id: 'extra',    branch: 'class',  icon: '📚', name: '보충 수업',     cost: 16,  desc: '시간표 보너스 x2 → x3' },
    { id: 'synergy',  branch: 'class',  icon: '🤝', name: '융합 교육',     cost: 30,  desc: '시너지 효과 +50%' },
    { id: 'lunch',    branch: 'class',  icon: '👩‍🍳', name: '영양사 선생님', cost: 35,  desc: '급식 효과 +50%' },
    { id: 'extra2',   branch: 'class',  icon: '🎯', name: '심화 학습',     cost: 70,  desc: '시간표 보너스 x3 → x5', req: 'extra' },

    { id: 'amplify',  branch: 'grad',   icon: '🏅', name: '명문 학교',     cost: 20,  desc: '졸업장 1장당 보너스 +5% → +7.5%' },
    { id: 'early',    branch: 'grad',   icon: '🎓', name: '조기 졸업',     cost: 40,  desc: '졸업장 획득량 +25%' },
    { id: 'amplify2', branch: 'grad',   icon: '🏆', name: '세계적 명문',   cost: 250, desc: '졸업장 1장당 보너스 +7.5% → +10%', req: 'amplify' },
    { id: 'hall',     branch: 'grad',   icon: '🏛️', name: '명예의 전당',   cost: 25,  desc: '전체 생산 +10% (살 때마다 누적)', repeat: true, growth: 1.5 },
  ];

  // ---------- 도전 학기 ----------
  // 시작하면 지금 학기를 졸업 처리하고(졸업장은 받음) 규칙이 걸린 새 학기를 시작한다.
  // 이번 학기 누적 지식이 goal에 닿으면 통과 → 영구 보상 + 스티커 5장.
  D.challengeUnlock = 2;     // 졸업 횟수
  D.challengeStickers = 5;
  D.challenges = [
    { id: 'inflation', icon: '📈', name: '물가 폭등 학기',   rule: '생산기 가격이 훨씬 빨리 오릅니다 (1.15배 → 1.25배)', goal: 1e10, reward: '생산기 가격 -5%' },
    { id: 'speedrun',  icon: '⏰', name: '벼락치기 학기',    rule: '15분 안에 목표를 달성해야 합니다',                     goal: 1e10, reward: '전체 생산 +25%', timeLimit: 900 },
    { id: 'noclick',   icon: '🙌', name: '맨손 학기',        rule: '교과서 클릭과 자동 필기로 지식을 얻을 수 없습니다',   goal: 1e12, reward: '아하! 배율 10배 → 15배' },
    { id: 'nopencil',  icon: '🚫', name: '연필 없는 학기',   rule: '연필을 살 수 없습니다',                                goal: 1e14, reward: '연필 생산량 10배' },
    { id: 'quiet',     icon: '🤫', name: '조용한 학기',      rule: '칭찬 스티커와 쪽지 시험이 없습니다',                   goal: 1e16, reward: '칭찬 스티커 효과 +50%' },
    { id: 'strike',    icon: '🪧', name: '선생님 없는 학기', rule: '선생님을 모실 수 없습니다',                            goal: 1e18, reward: '시너지 효과 +25%' },
    { id: 'final',     icon: '💀', name: '최후의 시험',      rule: '모든 생산량이 1/10로 줄어듭니다',                      goal: 1e20, reward: '졸업장 1장당 보너스 +1%p' },
  ];

  // ---------- 숙제 (차례대로 하나씩 하는 목표) ----------
  // prog(s, e) → [현재, 목표]
  // reward: { stickers: n } 또는 지식 = max(min, 그 생산기 기본 가격 × frac, 초당 생산 × sec)
  D.homework = (function () {
    const list = [];
    const hw = function (text, prog, reward) { list.push({ text: text, prog: prog, reward: reward }); };
    const own = function (id, n) { return function (s) { return [s.gens[id], n]; }; };
    const first = function (id, sec) { return { gen: id, frac: 0.2, sec: sec }; };   // 새 교실을 처음 열었을 때의 보상
    const count = function (obj) { return Object.keys(obj).length; };
    const units = function (s) { let t = 0; for (const id in s.gens) t += s.gens[id]; return t; };

    hw('교과서를 10번 눌러 공부하기', function (s) { return [s.clicks, 10]; }, { min: 10 });
    hw('연필 1자루 사기', own('pencil', 1), { min: 15 });
    hw('연필 5자루 모으기', own('pencil', 5), { min: 30 });
    hw('업그레이드 1개 사기', function (s) { return [count(s.upgrades), 1]; }, { min: 40 });
    hw('학생 1명 입학시키기', own('student', 1), { min: 50 });
    hw('쉬지 않고 눌러 집중력 가득 채우기', function (s) { return [s.flags.fullCombo ? 1 : 0, 1]; }, { min: 60, sec: 30 });
    hw('초당 지식 5 만들기', function (s, e) { return [e.baseLps(), 5]; }, { min: 100, sec: 30 });
    hw('쪽지 시험 1문제 맞히기', function (s) { return [s.quiz.correct, 1]; }, { stickers: 1 });
    hw('학생 10명 모으기', own('student', 10), { gen: 'student', frac: 2, sec: 30 });
    hw('칭찬 스티커 1장 받기', function (s) { return [s.bonusClicks, 1]; }, { stickers: 1 });
    hw('선생님 1명 모시기', own('teacher', 1), first('teacher', 45));
    hw('업그레이드 5개 사기', function (s) { return [count(s.upgrades), 5]; }, { min: 300, sec: 45 });
    hw('급식 메뉴 1개 추가하기', function (s, e) { return [e.lunchCount(), 1]; }, { min: 300, sec: 45 });
    hw('선생님 10명 모시기', own('teacher', 10), { gen: 'teacher', frac: 2, sec: 60 });
    hw('도서관 짓기', own('library', 1), first('library', 60));
    hw('초당 지식 1,000 만들기', function (s, e) { return [e.baseLps(), 1000]; }, { sec: 90 });
    hw('쪽지 시험 5문제 맞히기', function (s) { return [s.quiz.correct, 5]; }, { stickers: 2 });
    hw('시너지 업그레이드 1개 사기', function (s, e) { return [e.synergyCount(), 1]; }, { sec: 90 });
    hw('과학실 짓기', own('lab', 1), first('lab', 90));
    hw('생산기 합쳐서 100개 모으기', function (s) { return [units(s), 100]; }, { sec: 120 });
    hw('아하! 10번 터뜨리기', function (s) { return [s.crits, 10]; }, { stickers: 2 });
    hw('컴퓨터실 짓기', own('computer', 1), first('computer', 120));
    hw('스티커 앨범에 5종 모으기', function (s) { return [count(s.album), 5]; }, { sec: 120 });
    hw('초당 지식 10만 만들기', function (s, e) { return [e.baseLps(), 1e5]; }, { sec: 120 });
    hw('대학교 세우기', own('university', 1), first('university', 150));
    hw('업적 30개 달성하기', function (s) { return [count(s.achievements), 30]; }, { stickers: 3 });
    hw('처음으로 졸업하기', function (s) { return [s.prestiges, 1]; }, { stickers: 3 });
    hw('학교 발전 계획 1개 세우기', function (s) { return [count(s.research), 1]; }, { min: 2000, sec: 180 });
    hw('인터넷 강의 채널 열기', own('online', 1), first('online', 180));
    hw('쪽지 시험 25문제 맞히기', function (s) { return [s.quiz.correct, 25]; }, { stickers: 3 });
    hw('3번 졸업하기', function (s) { return [s.prestiges, 3]; }, { stickers: 3 });
    hw('도전 학기 1개 통과하기', function (s) { return [count(s.challenge.done), 1]; }, { stickers: 3 });
    hw('우주 학교 세우기', own('space', 1), first('space', 240));
    hw('스티커 앨범에 12종 모으기', function (s) { return [count(s.album), 12]; }, { sec: 240 });
    hw('학교 발전 계획 8개 세우기', function (s) { return [count(s.research), 8]; }, { sec: 240 });
    hw('타임머신 교실 만들기', own('timemachine', 1), first('timemachine', 300));
    hw('쪽지 시험 60문제 맞히기', function (s) { return [s.quiz.correct, 60]; }, { stickers: 4 });
    hw('6번 졸업하기', function (s) { return [s.prestiges, 6]; }, { stickers: 4 });
    hw('꿈속 학교 열기', own('dream', 1), first('dream', 300));
    hw('업적 80개 달성하기', function (s) { return [count(s.achievements), 80]; }, { stickers: 5 });
    hw('도전 학기 4개 통과하기', function (s) { return [count(s.challenge.done), 4]; }, { stickers: 5 });
    hw('지식의 나무 심기', own('tree', 1), first('tree', 360));
    hw('스티커 앨범에 20종 모으기', function (s) { return [count(s.album), 20]; }, { sec: 480 });
    hw('학교 발전 계획 20개 세우기', function (s) { return [count(s.research), 20]; }, { sec: 480 });
    hw('평행우주 분교 열기', own('multiverse', 1), first('multiverse', 480));
    hw('10번 졸업하기', function (s) { return [s.prestiges, 10]; }, { stickers: 6 });
    hw('진리의 전당 세우기', own('truth', 1), first('truth', 600));
    hw('도전 학기 모두 통과하기', function (s) { return [count(s.challenge.done), D.challenges.length]; }, { stickers: 8 });
    hw('진리의 전당 100곳 세우기', own('truth', 100), { stickers: 10 });
    hw('스티커 앨범 완성하기', function (s) { return [count(s.album), D.stickers.length]; }, { sec: 3600 });
    return list;
  })();

  // ---------- 교내 방송 (화면 위에 흐르는 한 줄 소식) ----------
  // cond(s, e)가 없으면 언제나 나올 수 있다
  D.news = (function () {
    const list = [];
    const n = function (text, cond) { list.push({ text: text, cond: cond }); };
    const has = function (id, k) { return function (s) { return s.gens[id] >= k; }; };

    n('오늘도 즐거운 학교생활! 교과서를 눌러 공부를 시작하세요.', function (s) { return s.allTime < 500; });
    n('분실물 안내: 지우개 3개, 실내화 한 짝, 그리고 어제 외운 영어 단어.');
    n('칠판 당번은 수업이 끝나면 칠판을 지워 주세요.');
    n('오늘의 명언: 티끌 모아 태산, 클릭 모아 지식.');
    n('쉬는 시간 10분은 왜 1분처럼 느껴질까요? 과학실에서 연구 중입니다.');
    n('방과 후 청소 당번: 지금 이 방송을 듣고 있는 당신.');
    n('복도에서는 뛰지 말고, 지식은 뛰게 합시다.');
    n('시험 기간에는 책상 정리가 가장 재미있습니다. 조심하세요.');
    n('오늘 배운 것은 오늘 복습! 내일의 내가 고마워합니다.');
    n('교장선생님 훈화 말씀은 3분 안에 끝납니다. (끝나지 않았습니다.)');
    n('연필들이 스스로 숙제를 하기 시작했다는 제보가 들어왔습니다.', has('pencil', 10));
    n('연필깎이 품귀 현상! 연필 100자루가 동시에 필기 중입니다.', has('pencil', 100));
    n('연필 200자루의 사각사각 소리가 ASMR 차트 1위에 올랐습니다.', has('pencil', 200));
    n('새 학기가 시작되었습니다. 신입생 여러분 환영합니다!', has('student', 1));
    n('학생이 너무 많아 운동장 조회가 이제 3부로 나뉘어 진행됩니다.', has('student', 50));
    n('전교생이 동시에 손을 들었습니다. 질문은 "오늘 급식 뭐예요?"였습니다.', has('student', 100));
    n('교무실 커피가 또 떨어졌습니다.', has('teacher', 10));
    n('선생님 50분이 동시에 "자, 5분만 더 하자"고 외쳤습니다.', has('teacher', 50));
    n('도서관에서는 조용히! 책장 넘기는 소리만 허용됩니다.', has('library', 1));
    n('연체된 책을 반납하면 지식이 쌓입니다. 사실 그냥 읽어도 쌓입니다.', has('library', 25));
    n('과학실에서 또 뭔가 터졌습니다. 다행히 지식이 터진 것입니다.', has('lab', 1));
    n('과학실 개구리가 탈출했습니다. 현재 3학년 2반에서 수업을 듣는 중입니다.', has('lab', 25));
    n('컴퓨터실에서 게임을 하다 걸리면 지식을 압수합니다.', has('computer', 1));
    n('컴퓨터실 와이파이 비밀번호는 "공부해라1234"가 아닙니다.', has('computer', 25));
    n('대학교 학식이 맛있다는 소문에 고등학생들이 줄을 섰습니다.', has('university', 1));
    n('인터넷 강의 2배속 금지. 선생님 목소리가 다람쥐가 됩니다.', has('online', 1));
    n('"좋아요와 구독, 그리고 복습 부탁드립니다." — 스타 강사', has('online', 25));
    n('우주 학교 급식은 튜브에 담겨 나옵니다. 오늘은 떡볶이 맛입니다.', has('space', 1));
    n('우주 학교 체육 시간: 공이 돌아오지 않습니다.', has('space', 25));
    n('내일 시험 문제를 미리 보고 온 학생이 적발되었습니다.', has('timemachine', 1));
    n('타임머신 교실 지각생: "제가 늦은 게 아니라 시간이 빨리 간 겁니다."', has('timemachine', 25));
    n('수업 시간에 조는 학생은 사실 꿈속 학교에서 복습 중입니다.', has('dream', 1));
    n('지식의 나무 열매를 먹으면 구구단이 저절로 외워집니다.', has('tree', 1));
    n('평행우주의 나는 벌써 숙제를 다 했다고 합니다.', has('multiverse', 1));
    n('진리의 전당에 도착했습니다. 진리는 "예습과 복습"이었습니다.', has('truth', 1));
    n('졸업한 선배가 간식을 한가득 들고 학교에 찾아왔습니다.', function (s) { return s.prestiges >= 1; });
    n('졸업식 노래 연습이 한창입니다. 벌써 몇 번째 졸업인가요?', function (s) { return s.prestiges >= 5; });
    n('우리 학교 졸업생이 또 해냈습니다! 현수막을 걸 자리가 모자랍니다.', function (s) { return s.prestiges >= 10; });
    n('쪽지 시험 연속 정답자에게 박수를! 짝짝짝.', function (s) { return s.quiz.streak >= 3; });
    n('오답 노트는 틀린 문제의 일기장입니다.', function (s) { return s.quiz.wrong >= 3; });
    n('칭찬 스티커를 열 장 모으면 기분이 좋아집니다. 스무 장도 좋습니다.', function (s) { return s.bonusClicks >= 10; });
    n('스티커 앨범 교환은 쉬는 시간에만 합시다.', function (s) { return Object.keys(s.album).length >= 5; });
    n('전설 스티커를 뽑은 학생이 있다는 소문이 돌고 있습니다.', function (s) { return Object.keys(s.album).length >= 20; });
    n('오늘 급식에 우유가 나옵니다. 흰 우유입니다. 초코는 없습니다.', function (s, e) { return e.lunchCount() >= 1; });
    n('급식실 앞 줄이 운동장을 한 바퀴 돌았습니다.', function (s, e) { return e.lunchCount() >= 6; });
    n('영양사 선생님: "남기지 않고 먹으면 지식이 10% 더 잘 들어옵니다."', function (s, e) { return e.lunchCount() >= 3; });
    n('도전 학기 참가자를 모집합니다. 준비물: 용기.', function (s) { return s.prestiges >= 2; });
    n('출석 도장이 일주일 연속으로 찍혔습니다. 개근상이 보입니다!', function (s) { return s.attend.streak >= 7; });
    n('지식이 너무 많아 창고를 하나 더 지었습니다.', function (s) { return s.allTime >= 1e9; });
    n('우리 학교가 뉴스에 나왔습니다. 제목: "지식이 넘쳐 흐르는 학교".', function (s) { return s.allTime >= 1e12; });
    n('은하계 교육청에서 우수 학교 표창장이 도착했습니다.', function (s) { return s.allTime >= 1e16; });
    n('이제 우주에서 모르는 것이 거의 없습니다. 급식 메뉴만 빼고요.', function (s) { return s.allTime >= 1e20; });
    return list;
  })();

  // ---------- 업적 ----------
  // 업적 1개당 전체 생산 +ACH_BONUS. cond(s, e): s = 상태, e = 엔진. hidden: 달성 전에는 조건을 숨긴다
  D.achievements = (function () {
    const list = [];
    const add = function (id, name, icon, desc, cond, group, hidden) {
      list.push({ id: id, name: name, icon: icon, desc: desc, cond: cond, group: group, hidden: !!hidden });
    };
    const N = function (n) { return Idddle.fmt ? Idddle.fmt(n) : String(n); };
    const count = function (obj) { return Object.keys(obj).length; };
    const units = function (s) { let t = 0; for (const id in s.gens) t += s.gens[id]; return t; };

    // 지식
    [[1e2, '첫 깨달음'], [1e4, '지식 주머니'], [1e6, '걸어다니는 백과사전'], [1e8, '박사급 두뇌'], [1e10, '노벨상 후보'], [1e12, '인류의 지성'],
      [1e15, '우주의 진리'], [1e18, '은하계 석학'], [1e21, '차원을 넘는 지성'], [1e24, '거의 모든 것을 아는 자'], [1e27, '모든 것을 아는 자'], [1e30, '무량대수의 지식']]
      .forEach(function (x, i) { add('total' + i, x[1], '🧠', function () { return '누적 지식 ' + N(x[0]) + ' 달성'; }, function (s) { return s.allTime >= x[0]; }, '지식'); });
    [[10, '공부 습관'], [1e3, '집중력 향상'], [1e5, '몰입의 경지'], [1e7, '지식 폭발'], [1e9, '지식 공장'], [1e12, '지식 발전소'], [1e15, '지식의 은하'], [1e18, '지식의 빅뱅']]
      .forEach(function (x, i) { add('lps' + i, x[1], '📈', function () { return '초당 지식 ' + N(x[0]); }, function (s, e) { return e.baseLps() >= x[0]; }, '지식'); });
    [[7, '중학교 입학'], [13, '새내기 대학생'], [18, '박사 학위']]
      .forEach(function (x, i) { add('grade' + i, x[1], '🎒', function () { return D.grades[x[0]].name + '(으)로 진급'; }, function (s, e) { return e.grade().index >= x[0]; }, '지식'); });

    // 공부(클릭)
    [[1, '첫 필기'], [100, '부지런한 손'], [1000, '필기 장인'], [5000, '손목 괜찮아요?'], [20000, '클릭의 달인'], [100000, '손가락의 전설']]
      .forEach(function (x, i) { add('click' + i, x[1], '✍️', function () { return '교과서 ' + N(x[0]) + '번 클릭'; }, function (s) { return s.clicks >= x[0]; }, '공부'); });
    add('combo', '몰입', '🔥', function () { return '집중력 게이지를 가득 채우기'; }, function (s) { return !!s.flags.fullCombo; }, '공부');
    [[1, '아하!'], [100, '번뜩이는 머리'], [1000, '유레카의 달인']]
      .forEach(function (x, i) { add('crit' + i, x[1], '💡', function () { return '아하! ' + N(x[0]) + '번'; }, function (s) { return s.crits >= x[0]; }, '공부'); });

    // 교실
    D.generators.forEach(function (g) {
      [[1, '첫 '], [50, '든든한 '], [100, '전설의 '], [200, '끝없는 ']].forEach(function (x, i) {
        add('gen_' + g.id + i, x[1] + g.name, g.icon, function () { return g.name + ' ' + x[0] + g.unit + ' 보유'; }, function (s) { return s.gens[g.id] >= x[0]; }, '교실');
      });
    });
    [[100, '북적이는 학교'], [500, '거대한 학원'], [1000, '지식 도시'], [2000, '지식 제국'], [3500, '지식 우주']]
      .forEach(function (x, i) { add('units' + i, x[1], '🏫', function () { return '생산기 합계 ' + N(x[0]) + '개'; }, function (s) { return units(s) >= x[0]; }, '교실'); });
    add('allRooms', '모든 교실 개방', '🗝️', function () { return '모든 생산기 10개 이상'; }, function (s) {
      return D.generators.every(function (g) { return s.gens[g.id] >= 10; });
    }, '교실');
    add('allRooms100', '꽉 찬 학교', '🏰', function () { return '모든 생산기 100개 이상'; }, function (s) {
      return D.generators.every(function (g) { return s.gens[g.id] >= 100; });
    }, '교실');

    // 업그레이드
    const UPG_TOTAL = D.generators.length * D.genUpgradeTiers.length + D.synergies.length + D.clickUpgrades.length + D.lunches.length;
    [[10, '배움의 시작'], [30, '자기계발 중독'], [60, '업그레이드 수집가'], [100, '끝없는 개선'], [UPG_TOTAL, '완벽주의자']]
      .forEach(function (x, i) { add('upg' + i, x[1], '📘', function () { return '한 학기에 업그레이드 ' + x[0] + '개 구매'; }, function (s) { return count(s.upgrades) >= x[0]; }, '업그레이드'); });
    add('synAll', '환상의 팀워크', '🤝', function () { return '시너지 업그레이드 전부 구매'; }, function (s) {
      return D.synergies.every(function (x) { return s.upgrades['syn_' + x.id]; });
    }, '업그레이드');
    add('lunchAll', '급식 왕', '🍱', function () { return '급식 메뉴 전부 추가'; }, function (s, e) { return e.lunchCount() >= D.lunches.length; }, '업그레이드');

    // 칭찬 스티커 · 앨범
    [[1, '칭찬받았어요'], [10, '칭찬 수집가'], [50, '모범생'], [200, '칭찬 부자'], [500, '선생님의 자랑']]
      .forEach(function (x, i) { add('bonus' + i, x[1], '🌟', function () { return '칭찬 스티커 ' + x[0] + '장 받기'; }, function (s) { return s.bonusClicks >= x[0]; }, '스티커'); });
    [[1, '첫 스티커'], [10, '앨범 한 쪽'], [20, '스티커 박사'], [D.stickers.length, '앨범 완성']]
      .forEach(function (x, i) { add('album' + i, x[1], '📔', function () { return '스티커 앨범 ' + x[0] + '종 모으기'; }, function (s) { return count(s.album) >= x[0]; }, '스티커'); });
    add('legend', '전설을 손에 넣다', '✨', function () { return '전설 스티커 1종 얻기'; }, function (s) {
      return D.stickers.some(function (t) { return t.rarity === 'legend' && s.album[t.id]; });
    }, '스티커');

    // 쪽지 시험
    [[1, '첫 정답'], [10, '척척박사'], [50, '퀴즈왕'], [150, '시험의 달인'], [400, '만점 제조기']]
      .forEach(function (x, i) { add('quiz' + i, x[1], '📝', function () { return '쪽지 시험 ' + x[0] + '문제 맞히기'; }, function (s) { return s.quiz.correct >= x[0]; }, '시험'); });
    add('quizStreak', '연속 정답 5', '🔥', function () { return '쪽지 시험 5번 연속 정답'; }, function (s) { return s.quiz.best >= 5; }, '시험');
    add('quizStreak10', '연속 정답 10', '🔥', function () { return '쪽지 시험 10번 연속 정답'; }, function (s) { return s.quiz.best >= 10; }, '시험');
    add('quizStreak20', '연속 정답 20', '🔥', function () { return '쪽지 시험 20번 연속 정답'; }, function (s) { return s.quiz.best >= 20; }, '시험');
    D.quiz.subjects.forEach(function (sb) {
      add('subj_' + sb.id, sb.name + ' 우등생', sb.icon, function () { return sb.name + ' 문제 15개 맞히기'; }, function (s) { return (s.quiz.subj[sb.id] || [0])[0] >= 15; }, '시험');
    });
    add('subjAll', '전 과목 우등생', '💯', function () { return '모든 과목에서 15문제씩 맞히기'; }, function (s) {
      return D.quiz.subjects.every(function (sb) { return (s.quiz.subj[sb.id] || [0])[0] >= 15; });
    }, '시험');

    // 학교생활
    [[3, '개근 시작'], [7, '일주일 개근'], [30, '한 달 출석']]
      .forEach(function (x, i) { add('attend' + i, x[1], '📅', function () { return '출석 ' + x[0] + '일'; }, function (s) { return s.attend.total >= x[0]; }, '학교생활'); });
    [[10, '숙제 잘하는 아이'], [30, '숙제 모범생'], [D.homework.length, '숙제 끝!']]
      .forEach(function (x, i) { add('hw' + i, x[1], '📚', function () { return '숙제 ' + x[0] + '개 제출'; }, function (s) { return s.homework.index >= x[0]; }, '학교생활'); });

    // 졸업
    [[1, '첫 졸업'], [5, '졸업 장인'], [10, '졸업이 취미'], [25, '졸업 전문가'], [50, '영원한 졸업생']]
      .forEach(function (x, i) { add('pres' + i, x[1], '🎓', function () { return '졸업 ' + x[0] + '회'; }, function (s) { return s.prestiges >= x[0]; }, '졸업'); });
    [[1, '첫 계획'], [10, '계획이 다 있구나'], [D.research.length, '완벽한 학교']]
      .forEach(function (x, i) { add('res' + i, x[1], '📜', function () { return '학교 발전 계획 ' + x[0] + '개'; }, function (s) { return count(s.research) >= x[0]; }, '졸업'); });
    [[1, '도전자'], [4, '시련을 넘어'], [D.challenges.length, '모든 시험 통과']]
      .forEach(function (x, i) { add('chal' + i, x[1], '🏅', function () { return '도전 학기 ' + x[0] + '개 통과'; }, function (s) { return count(s.challenge.done) >= x[0]; }, '졸업'); });
    add('fast0', '우등 신입생', '⏩', function () { return '새 학기 10분 안에 지식 ' + N(1e9) + ' 모으기'; }, function (s) { return s.runSec <= 600 && s.runTotal >= 1e9; }, '졸업');
    add('fast1', '월반', '⚡', function () { return '새 학기 10분 안에 지식 ' + N(1e16) + ' 모으기'; }, function (s) { return s.runSec <= 600 && s.runTotal >= 1e16; }, '졸업');

    // 숨겨진 업적
    add('speed10', '번개 손가락', '⚡', function () { return '1초에 10번 클릭'; }, function (s) { return !!s.flags.speed10; }, '비밀', true);
    add('nightowl', '올빼미족', '🦉', function () { return '자정부터 새벽 4시 사이에 공부하기'; }, function (s) { return !!s.flags.nightowl; }, '비밀', true);
    add('wrong10', '틀려도 괜찮아', '🩹', function () { return '쪽지 시험 10번 틀리기'; }, function (s) { return s.quiz.wrong >= 10; }, '비밀', true);
    add('patience', '명상의 시간', '🧘', function () { return '5분 동안 한 번도 클릭하지 않기'; }, function (s) { return !!s.flags.patience; }, '비밀', true);
    add('dup10', '최애 스티커', '💞', function () { return '같은 스티커 10장 모으기'; }, function (s) {
      for (const id in s.album) if (s.album[id] >= 10) return true;
      return false;
    }, '비밀', true);
    add('broke', '용돈 탕진', '💸', function () { return '큰 물건을 사고 지식을 한 톨도 남기지 않기'; }, function (s) { return !!s.flags.broke; }, '비밀', true);
    add('flow60', '무아지경', '🌊', function () { return '집중력 가득 상태를 1분 동안 유지'; }, function (s) { return !!s.flags.flow60; }, '비밀', true);
    add('bigclick', '한 방', '💥', function () { return '클릭 한 번으로 지식 1조 얻기'; }, function (s) { return s.stats.bestClick >= 1e12; }, '비밀', true);

    return list;
  })();
})();
