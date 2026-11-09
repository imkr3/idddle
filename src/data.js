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
