// 엔진을 Node에서 불러오는 도우미 (단위 테스트와 tools/sim.js가 함께 쓴다)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = ['data.js', 'quiz-data.js', 'engine.js'].map(function (f) {
  return { name: f, code: fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8') };
});

// 가짜 시계: 테스트·시뮬레이션에서 시간을 마음대로 흐르게 한다
function makeClock(start) {
  let t = start || 1_700_000_000_000;
  return { now: function () { return t; }, advance: function (ms) { t += ms; } };
}

// store: localStorage 역할을 하는 객체, clock: makeClock() 결과 (없으면 새로 만든다)
// tweak(DATA): 엔진을 만들기 전에 데이터를 바꿔 볼 때 쓴다 (밸런스 실험용)
function makeEngine(store, clock, tweak) {
  store = store || {};
  clock = clock || makeClock();
  const ctx = {
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
    },
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    Math: Math,   // 테스트에서 Math.random을 고정할 수 있게 바깥 Math를 그대로 쓴다
    unescape: unescape, escape: escape, encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  SRC.forEach(function (f) {
    if (f.name === 'engine.js' && tweak) tweak(ctx.Idddle.DATA);
    vm.runInContext(f.code, ctx, { filename: f.name });
  });
  const game = ctx.Idddle.createEngine('test-save', { now: clock.now });
  return { game: game, store: store, clock: clock, D: ctx.Idddle.DATA, Q: ctx.Idddle.QUIZ, Idddle: ctx.Idddle };
}

module.exports = { makeEngine: makeEngine, makeClock: makeClock };
