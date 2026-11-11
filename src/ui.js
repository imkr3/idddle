/* 화면 렌더링. Idddle.mount(rootElement, { saveKey }) 로 아무 페이지에나 붙일 수 있다.
 * 규칙·계산은 전부 engine.js에 있고, 이 파일은 보여 주고 입력을 받기만 한다. */
window.Idddle = window.Idddle || {};

(function () {
  const UNITS = [[1e68, '무량대수'], [1e64, '불가사의'], [1e60, '나유타'], [1e56, '아승기'], [1e52, '항하사'], [1e48, '극'], [1e44, '재'], [1e40, '정'],
    [1e36, '간'], [1e32, '구'], [1e28, '양'], [1e24, '자'], [1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  const EN_UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const ROOM_CYCLE = 3;       // 교실 진행 막대 한 바퀴(초) — 다 차면 그동안 번 지식을 띄운다
  let notation = 'ko';        // 'ko' | 'en' | 'sci'

  // 반올림 대신 버림: 9999.9만이 "10000만"으로 보이지 않게
  function short(x) {
    if (x >= 100) return String(Math.floor(x));
    if (x >= 10) return (Math.floor(x * 10) / 10).toFixed(1);
    return (Math.floor(x * 100) / 100).toFixed(2);
  }
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    const sci = function () { return n.toExponential(2).replace('e+', 'e'); };
    if (n >= 1e72 || (notation === 'sci' && n >= 1e4)) return sci();
    if (notation === 'en' && n >= 1e3) {
      const i = Math.floor(Math.log10(n) / 3 + 1e-9);
      return i > EN_UNITS.length ? sci() : short(n / Math.pow(1000, i)) + EN_UNITS[i - 1];
    }
    for (const [v, u] of UNITS) {
      if (n >= v) return short(n / v) + u;
    }
    if (n < 10 && n % 1 !== 0) return n.toFixed(1);
    return Math.floor(n).toLocaleString('ko-KR');
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    if (sec >= 86400 * 999) return '아주 오래';
    if (sec >= 86400) return Math.floor(sec / 86400) + '일 ' + Math.floor((sec % 86400) / 3600) + '시간';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + '시간' + (m ? ' ' + m + '분' : '');
    if (m) return m + '분' + (s ? ' ' + s + '초' : '');
    return s + '초';
  }
  function mmss(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function pct(x) { return '+' + (Math.round(x * 1000) / 10) + '%'; }
  function xmult(m) { return 'x' + (m >= 100 ? fmt(m) : m >= 10 ? m.toFixed(1) : m.toFixed(2)); }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function hash(i) { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); } // 0~1, 결정적
  function starPath(cx, cy, outer, inner) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }
  // 받침에 따라 조사 고르기: josa('연필', '을', '를')
  function josa(word, withBatchim, without) {
    const c = word.charCodeAt(word.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return withBatchim;
    return (c - 0xAC00) % 28 ? withBatchim : without;
  }

  Idddle.fmt = fmt;

  // ---------- 효과음 (WebAudio로 합성, 파일 없음) ----------
  function createSound() {
    let ac = null, on = true;
    function tone(freq, start, dur, type, vol) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ac.currentTime + start);
      g.gain.setValueAtTime(0.0001, ac.currentTime + start);
      g.gain.exponentialRampToValueAtTime(vol || 0.08, ac.currentTime + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + start);
      o.stop(ac.currentTime + start + dur + 0.02);
    }
    const sfx = {
      click: function () { tone(700 + Math.random() * 160, 0, 0.05, 'triangle', 0.04); },
      crit: function () { tone(1175, 0, 0.09, 'triangle', 0.07); tone(1568, 0.06, 0.16, 'triangle', 0.06); },
      buy: function () { tone(523, 0, 0.08, 'square', 0.03); tone(784, 0.06, 0.1, 'square', 0.03); },
      bonus: function () { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, i * 0.06, 0.18, 'triangle', 0.06); }); },
      ach: function () { tone(1047, 0, 0.25, 'sine', 0.07); tone(1568, 0.08, 0.35, 'sine', 0.05); },
      sticker: function () { tone(880, 0, 0.1, 'sine', 0.06); tone(1109, 0.08, 0.1, 'sine', 0.06); tone(1319, 0.16, 0.22, 'sine', 0.06); },
      wrong: function () { tone(220, 0, 0.18, 'sawtooth', 0.04); tone(185, 0.12, 0.25, 'sawtooth', 0.04); },
      // 학교 종소리 (도-미-솔-도)
      grad: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.18, 0.5, 'sine', 0.08); }); },
    };
    return {
      set enabled(v) { on = v; },
      play: function (name) {
        if (!on) return;
        try {
          if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); }
          if (ac.state === 'suspended') ac.resume();
          sfx[name]();
        } catch (e) { /* 소리 실패는 무시 */ }
      },
    };
  }

  Idddle.mount = function (root, opts) {
    opts = opts || {};
    const D = Idddle.DATA;
    const game = Idddle.createEngine(opts.saveKey || 'idddle-school-v1');
    const offline = game.load();
    game.checkAchievements(); // 불러온 상태 기준으로 조용히 갱신
    notation = game.state.settings.notation;
    const sound = createSound();
    sound.enabled = game.state.settings.sound;
    let buyAmount = 1;
    let tab = 'shop';
    const genById = {}, upgById = {}, achById = {}, stickerById = {}, resById = {}, chalById = {};
    D.generators.forEach(function (g) { genById[g.id] = g; });
    game.upgrades.forEach(function (u) { upgById[u.id] = u; });
    D.achievements.forEach(function (a) { achById[a.id] = a; });
    D.stickers.forEach(function (t) { stickerById[t.id] = t; });
    D.research.forEach(function (r) { resById[r.id] = r; });
    D.challenges.forEach(function (c) { chalById[c.id] = c; });
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.classList.add('idd');
    root.innerHTML = `
      <canvas class="idd-sky" aria-hidden="true"></canvas>
      <div class="idd-bonus-layer" data-r="bonusLayer"></div>
      <header class="idd-top">
        <div class="idd-brand">
          <div class="idd-logo">✏️ 아이들 스쿨</div>
          <span class="idd-grade" data-r="grade" data-tip="grade">유치원</span>
        </div>
        <svg class="idd-clock" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="#fffdf6" stroke="#8a5a33" stroke-width="3"/>
          <g stroke="#3b2a1a" stroke-width="1.5" stroke-linecap="round"><path d="M20 4v3M20 33v3M4 20h3M33 20h3"/></g>
          <path data-r="clockH" d="M20 20V11" stroke="#3b2a1a" stroke-width="2.6" stroke-linecap="round"/>
          <path data-r="clockM" d="M20 20V7" stroke="#3b2a1a" stroke-width="1.8" stroke-linecap="round"/>
          <path data-r="clockS" d="M20 22V6" stroke="#e2574c" stroke-width="1" stroke-linecap="round"/>
          <circle cx="20" cy="20" r="1.8" fill="#e2574c"/>
        </svg>
        <div class="idd-top-right">
          <span class="idd-chip" data-tip="mult">✨ 전체 <b data-r="multAll">x1.00</b></span>
          <button class="idd-iconbtn" type="button" data-act="help" aria-label="도움말">?</button>
        </div>
      </header>
      <div class="idd-news" data-tip="news"><span class="idd-news-icon">📢</span><span class="idd-news-text" data-r="newsText"></span></div>

      <main class="idd-main">
        <section class="idd-left">
          <div class="idd-score">
            <div class="idd-amount"><span data-r="light">0</span></div>
            <div class="idd-amount-label">지식</div>
            <div class="idd-rate">초당 <b data-r="lps">0</b></div>
          </div>
          <button class="idd-orb" type="button" aria-label="공부하기">
            <svg viewBox="0 0 200 200" class="idd-book">
              <ellipse cx="100" cy="168" rx="78" ry="10" fill="#000" opacity=".25"/>
              <path d="M18 62 Q100 44 182 62 L182 158 Q100 142 18 158 Z" fill="#b5523b" stroke="#7d3426" stroke-width="3"/>
              <path d="M100 58 Q64 44 26 54 L26 150 Q64 140 100 152 Z" fill="#fffaf0" stroke="#e6dcc4" stroke-width="2"/>
              <path d="M100 58 Q136 44 174 54 L174 150 Q136 140 100 152 Z" fill="#fffdf6" stroke="#e6dcc4" stroke-width="2"/>
              <g stroke="#b9cbe4" stroke-width="2" stroke-linecap="round">
                <path d="M38 74 Q66 66 90 72M38 90 Q66 82 90 88M38 106 Q66 98 90 104M38 122 Q60 115 78 119"/>
                <path d="M110 72 Q134 66 162 74M110 88 Q134 82 162 90M110 104 Q134 98 162 106"/>
              </g>
              <text x="136" y="132" font-size="18" text-anchor="middle" fill="#e2574c" font-weight="700" font-family="sans-serif">A+</text>
              <path d="M100 58 L100 152" stroke="#d8ccb0" stroke-width="3"/>
              <path d="M150 50 L150 84 L157 77 L164 84 L164 48" fill="#e2574c"/>
              <path class="idd-flip" d="M100 58 Q136 44 174 54 L174 150 Q136 140 100 152 Z" fill="#fff8e8" stroke="#e6dcc4" stroke-width="2"/>
            </svg>
            <span class="idd-hint" data-r="hint">👆 교과서를 눌러 공부하세요!</span>
          </button>
          <div class="idd-under">
            <div class="idd-clickpow">클릭당 <b data-r="click">1</b><span data-r="autoInfo"></span></div>
            <div class="idd-combo" data-tip="combo"><i data-r="comboBar"></i><span data-r="comboText">집중력</span></div>
          </div>
          <div class="idd-desk" data-r="desk" hidden></div>
          <div class="idd-buffs" data-r="buffs"></div>
          <div class="idd-chal-banner" data-r="chalBanner" hidden></div>
          <div class="idd-cards">
            <div class="idd-card idd-hw" data-r="hwCard">
              <span class="idd-card-icon">📚</span>
              <span class="idd-card-body">
                <b class="idd-card-title">숙제 <small data-r="hwCount"></small></b>
                <span class="idd-hw-text" data-r="hwText"></span>
                <span class="idd-hw-bar"><i data-r="hwBar"></i></span>
                <span class="idd-hw-foot"><small data-r="hwReward"></small><button type="button" class="idd-mini" data-act="homework" data-r="hwBtn">제출</button></span>
              </span>
            </div>
            <button class="idd-card idd-quiz" type="button" data-act="quiz" data-r="quizCard">
              <span class="idd-card-icon">📝</span>
              <span class="idd-card-body"><b class="idd-card-title">쪽지 시험</b><small data-r="quizInfo">준비 중…</small></span>
            </button>
            <div class="idd-card idd-attend" data-tip="attend">
              <span class="idd-card-icon">📅</span>
              <span class="idd-card-body"><b class="idd-card-title">출석부</b><span class="idd-stamps" data-r="stamps"></span></span>
            </div>
          </div>
        </section>

        <section class="idd-campus">
          <div class="idd-campus-title">
            <span>🏫 우리 학교</span>
            <span class="idd-period" data-r="period" data-tip="period"><span data-r="periodName"></span><b data-r="periodLeft"></b><i data-r="periodBar"></i></span>
          </div>
          <div class="idd-rooms" data-r="rooms"></div>
          <div class="idd-campus-empty" data-r="campusEmpty">상점에서 <b>연필</b>을 사면<br>여기서 일하는 모습을 볼 수 있어요 ✏️</div>
        </section>

        <section class="idd-panel">
          <nav class="idd-tabs" data-r="tabs">
            <button type="button" data-tab="shop" class="on">상점<i class="idd-dot" data-r="dotShop" hidden></i></button>
            <button type="button" data-tab="ach">업적<i class="idd-dot" data-r="dotAch" hidden></i></button>
            <button type="button" data-tab="album">앨범<i class="idd-dot" data-r="dotAlbum" hidden></i></button>
            <button type="button" data-tab="prestige">졸업<i class="idd-dot" data-r="dotPrestige" hidden></i></button>
            <button type="button" data-tab="stats">기록</button>
          </nav>
          <div class="idd-tabbody" data-r="tabbody">
            <div data-pane="shop">
              <div class="idd-sec-title idd-row">
                <span>업그레이드</span>
                <button type="button" class="idd-mini" data-act="buyAll" data-r="buyAll">모두 구매</button>
              </div>
              <div class="idd-upgrades" data-r="upgrades"></div>
              <div class="idd-sec-title idd-row">
                <span>교실</span>
                <span class="idd-seg" data-r="amtSeg">
                  <button type="button" data-amt="1" class="on">1</button><button type="button" data-amt="10">10</button><button type="button" data-amt="100">100</button><button type="button" data-amt="max">MAX</button>
                </span>
              </div>
              <div class="idd-gens" data-r="gens"></div>
            </div>

            <div data-pane="ach" hidden>
              <div class="idd-summary"><span><b data-r="achCount">0</b> / ${D.achievements.length} 달성</span><span>전체 생산 <b data-r="achBonus">+0%</b></span></div>
              <p class="idd-note">업적 1개당 전체 생산 <b>${pct(D.ACH_BONUS)}</b>. 졸업해도 유지됩니다.</p>
              <div data-r="achs"></div>
            </div>

            <div data-pane="album" hidden>
              <div class="idd-summary"><span><b data-r="albumCount">0</b> / ${D.stickers.length} 종</span><span>전체 생산 <b data-r="albumBonus">+0%</b></span></div>
              <p class="idd-note">칭찬 스티커를 받거나, 쪽지 시험을 맞히거나, 숙제·출석·도전 학기 보상으로 얻습니다. 처음 얻은 스티커마다 생산이 오르고, 같은 등급을 다 모으면 추가 보너스! 졸업해도 유지됩니다.</p>
              <div data-r="album"></div>
            </div>

            <div data-pane="prestige" hidden>
              <div class="idd-prestige">
                <div class="idd-nova">🎓</div>
                <h3>졸업하기</h3>
                <div data-r="pLocked" class="idd-plock" hidden>
                  <p>🔒 전체 누적 지식 <b>${fmt(D.prestige.unlockAt)}</b>을 모으면 졸업할 수 있어요.</p>
                  <div class="idd-meter"><i data-r="pLockBar"></i></div>
                </div>
                <div data-r="pOpen">
                  <p>지식·교실·업그레이드를 초기화하고 <b>졸업장</b>을 받습니다.<br>졸업장 1장당 전체 생산 <b data-r="coreEach">+5%</b> (영구).</p>
                  <div class="idd-prestige-stats">
                    <div><small>받은 졸업장 (보너스 <span data-r="coreMultBig">x1</span>)</small><b data-r="cores">0</b></div>
                    <div><small>지금 졸업하면</small><b>+<span data-r="pgain">0</span></b></div>
                  </div>
                  <div class="idd-meter" data-tip="pnext"><i data-r="pNextBar"></i></div>
                  <p class="idd-note" data-r="pnext"></p>
                  <button class="idd-btn idd-btn-prestige" type="button" data-act="prestige" data-r="pBtn">졸업하기</button>
                </div>
              </div>

              <div class="idd-sec-title idd-row idd-divider"><span>학교 발전 계획</span><span>남은 졸업장 <b data-r="coresFree">0</b></span></div>
              <p class="idd-note">졸업장을 써서 영구 강화를 얻습니다. 써도 졸업장의 생산 보너스는 줄지 않습니다.</p>
              <div data-r="research"></div>

              <div class="idd-sec-title idd-row idd-divider"><span>도전 학기</span><span data-r="chalCount"></span></div>
              <p class="idd-note" data-r="chalNote"></p>
              <div class="idd-chals" data-r="chals"></div>
            </div>

            <div data-pane="stats" hidden>
              <div class="idd-sec-title">기록</div>
              <dl class="idd-stats" data-r="stats"></dl>
              <div class="idd-sec-title">성적표</div>
              <table class="idd-report" data-r="report"></table>
              <div class="idd-sec-title">설정</div>
              <div class="idd-setting">
                <span>숫자 표기</span>
                <span class="idd-seg" data-r="notation">
                  <button type="button" data-notation="ko">만·억·조</button><button type="button" data-notation="en">K·M·B</button><button type="button" data-notation="sci">1e6</button>
                </span>
              </div>
              <div class="idd-setting">
                <span>효과음</span>
                <span class="idd-seg" data-r="soundSeg">
                  <button type="button" data-sound="1">켜기</button><button type="button" data-sound="0">끄기</button>
                </span>
              </div>
              <div class="idd-setting">
                <span>화면 효과 <small>(느린 기기는 줄이기)</small></span>
                <span class="idd-seg" data-r="fxSeg">
                  <button type="button" data-fx="1">전체</button><button type="button" data-fx="0">줄이기</button>
                </span>
              </div>
              <div class="idd-sec-title">저장</div>
              <div class="idd-btn-grid">
                <button class="idd-btn idd-btn-ghost" type="button" data-act="save">지금 저장</button>
                <button class="idd-btn idd-btn-ghost" type="button" data-act="export">내보내기</button>
                <button class="idd-btn idd-btn-ghost" type="button" data-act="import">가져오기</button>
                <button class="idd-btn idd-btn-ghost idd-btn-danger" type="button" data-act="reset">전체 초기화</button>
              </div>
              <p class="idd-note">10초마다 이 브라우저에 자동 저장됩니다. 다른 기기로 옮길 땐 내보내기 코드를 복사해 가져오기에 붙여넣으세요.</p>
              <button class="idd-btn idd-btn-ghost" type="button" data-act="help">📖 게임 안내 보기</button>
              <p class="idd-note idd-version">아이들 스쿨 v${D.VERSION}</p>
            </div>
          </div>
        </section>
      </main>
      <div class="idd-tip" data-r="tip" hidden></div>
      <div class="idd-toasts" data-r="toasts"></div>
      <div class="idd-modal" data-r="modal" hidden><div class="idd-modal-box" data-r="modalBox"><div data-r="modalText"></div><div class="idd-modal-btns" data-r="modalBtns"></div></div></div>
    `;

    const R = {};
    root.querySelectorAll('[data-r]').forEach(function (e) { R[e.dataset.r] = e; });
    const orb = root.querySelector('.idd-orb');

    // ---------- 상점: 교실(생산기) 행 ----------
    const genRows = {};
    D.generators.forEach(function (g) {
      const row = el('button', 'idd-gen');
      row.type = 'button';
      row.dataset.gen = g.id;
      row.dataset.tip = 'gen:' + g.id;
      row.innerHTML = `
        <span class="idd-gen-icon">${g.icon}</span>
        <span class="idd-gen-info">
          <span class="idd-gen-name">${g.name}<em data-g="tag"></em></span>
          <span class="idd-gen-cost">📘 <span data-g="cost"></span> <span class="idd-gen-eta" data-g="eta"></span></span>
        </span>
        <span class="idd-gen-owned" data-g="owned">0</span>
        <span class="idd-gen-next"><i data-g="next"></i></span>`;
      const refs = { row: row };
      row.querySelectorAll('[data-g]').forEach(function (e) { refs[e.dataset.g] = e; });
      genRows[g.id] = refs;
      R.gens.appendChild(row);
    });

    // ---------- 업적 타일 (묶음별) ----------
    const achTiles = {};
    (function () {
      const groups = [];
      D.achievements.forEach(function (a) { if (groups.indexOf(a.group) < 0) groups.push(a.group); });
      groups.forEach(function (gname) {
        R.achs.appendChild(el('div', 'idd-sub-title', gname));
        const grid = el('div', 'idd-achs');
        D.achievements.filter(function (a) { return a.group === gname; }).forEach(function (a) {
          const t = el('div', 'idd-ach', '<span>' + (a.hidden ? '❓' : a.icon) + '</span>');
          t.dataset.tip = 'ach:' + a.id;
          achTiles[a.id] = t;
          grid.appendChild(t);
        });
        R.achs.appendChild(grid);
      });
    })();

    // ---------- 스티커 앨범 칸 (등급별) ----------
    const albumSlots = {}, albumHeads = {};
    Object.keys(D.rarities).forEach(function (rid) {
      const rar = D.rarities[rid];
      const head = el('div', 'idd-sub-title idd-row', `<span style="color:${rar.color}">● ${rar.name}</span><small data-k="info"></small>`);
      albumHeads[rid] = head.querySelector('[data-k]');
      R.album.appendChild(head);
      const grid = el('div', 'idd-album');
      D.stickers.filter(function (t) { return t.rarity === rid; }).forEach(function (t) {
        const slot = el('div', 'idd-slot', `<span class="idd-slot-icon">${t.icon}</span><span class="idd-slot-name">${t.name}</span><i></i>`);
        slot.dataset.tip = 'sticker:' + t.id;
        slot.dataset.rarity = rid;
        slot.style.setProperty('--rar', rar.color);
        albumSlots[t.id] = slot;
        grid.appendChild(slot);
      });
      R.album.appendChild(grid);
    });

    // ---------- 학교 발전 계획 타일 (갈래별) ----------
    const resTiles = {};
    D.researchBranches.forEach(function (b) {
      R.research.appendChild(el('div', 'idd-sub-title', b.name));
      const grid = el('div', 'idd-research');
      D.research.filter(function (r) { return r.branch === b.id; }).forEach(function (r) {
        const t = el('button', 'idd-res', `<span class="idd-res-icon">${r.icon}</span><span class="idd-res-name">${r.name}</span><span class="idd-res-cost"></span>`);
        t.type = 'button';
        t.dataset.id = r.id;
        t.dataset.tip = 'res:' + r.id;
        resTiles[r.id] = t;
        grid.appendChild(t);
      });
      R.research.appendChild(grid);
    });

    // ---------- 도전 학기 카드 ----------
    const chalCards = {};
    D.challenges.forEach(function (c) {
      const card = el('div', 'idd-chal', `
        <span class="idd-chal-icon">${c.icon}</span>
        <span class="idd-chal-body">
          <b>${c.name}</b>
          <span>${c.rule}</span>
          <small>목표: 이번 학기 지식 <em data-k="goal"></em> · 보상: ${c.reward}</small>
        </span>
        <button type="button" class="idd-mini" data-chal="${c.id}"></button>`);
      chalCards[c.id] = { el: card, goal: card.querySelector('[data-k=goal]'), btn: card.querySelector('button') };
      R.chals.appendChild(card);
    });

    // ============================================================ 툴팁
    let lastPointer = 'mouse';   // 마지막 입력 장치: 터치면 '누르면 설명 → 한 번 더 누르면 구매'
    root.addEventListener('pointerdown', function (ev) { lastPointer = ev.pointerType || 'mouse'; }, true);
    const isTouch = function () { return lastPointer === 'touch'; };

    function tipHtml(key) {
      const s = game.state;
      const i = key.indexOf(':');
      const kind = i < 0 ? key : key.slice(0, i), id = i < 0 ? '' : key.slice(i + 1);
      const title = function (t) { return '<b class="idd-tip-title">' + t + '</b>'; };
      if (kind === 'upg') {
        const u = upgById[id];
        let foot;
        if (s.upgrades[id]) foot = '<div class="idd-tip-dim">구매 완료</div>';
        else {
          const c = game.upgradeCost(u);
          foot = `<div class="idd-tip-cost ${s.light >= c ? '' : 'no'}">📘 ${fmt(c)}</div>` + (isTouch() ? '<div class="idd-tip-dim">한 번 더 누르면 구매</div>' : '');
        }
        return title(u.icon + ' ' + u.name) + '<div>' + game.upgradeDesc(u) + '</div>' + foot;
      }
      if (kind === 'gen') {
        const g = genById[id], n = s.gens[id];
        const r = game.genRate(g), boost = game.genBoost(id);
        const nextTier = D.genUpgradeTiers.find(function (t) { return n < t.need; });
        return title(g.icon + ' ' + g.name) + `<div class="idd-tip-dim">${g.desc}</div>
          <div>1${g.unit}당 <b>${fmt(r)}</b>/초 · ${n}${g.unit} 합계 <b>${fmt(r * n)}</b>/초</div>` +
          (n ? '<div class="idd-tip-dim">전체 생산의 ' + (r * n / Math.max(1e-9, game.baseLps()) * 100).toFixed(1) + '%</div>' : '') +
          (boost > 1 ? '<div class="idd-tip-cost">📖 지금 수업 중: 생산 x' + boost + '</div>' : '') +
          (nextTier ? '<div class="idd-tip-dim">다음 업그레이드: ' + nextTier.need + g.unit + ' (' + (nextTier.need - n) + g.unit + ' 남음)</div>' : '') +
          (game.genLocked(id) ? '<div class="idd-tip-cost no">도전 학기 규칙으로 살 수 없어요</div>' : '');
      }
      if (kind === 'ach') {
        const a = achById[id], got = s.achievements[id];
        if (got) return title(a.icon + ' ' + a.name) + '<div>' + a.desc() + '</div><div class="idd-tip-dim">달성 완료 · 전체 생산 ' + pct(D.ACH_BONUS) + '</div>';
        if (a.hidden) return title('❓ 숨겨진 업적') + '<div class="idd-tip-dim">조건은 비밀이에요. 이것저것 해 보세요!</div>';
        return title('🔒 ' + a.name) + '<div>' + a.desc() + '</div>';
      }
      if (kind === 'sticker') {
        const t = stickerById[id], rar = D.rarities[t.rarity], n = s.album[id] || 0;
        if (!n) return title('❔ 아직 없는 스티커') + `<div><span style="color:${rar.color}">●</span> ${rar.name} 등급 · 얻으면 전체 생산 ${pct(rar.pct)}</div>`;
        return title(t.icon + ' ' + t.name) + `<div><span style="color:${rar.color}">●</span> ${rar.name} 등급 · 전체 생산 ${pct(rar.pct)}</div><div class="idd-tip-dim">${n}장 보유</div>`;
      }
      if (kind === 'res') {
        const r = resById[id], lv = game.lvl(id);
        const need = r.req && !game.has(r.req) ? '<div class="idd-tip-cost no">먼저 필요: ' + resById[r.req].name + '</div>' : '';
        const done = !r.repeat && game.has(id);
        return title(r.icon + ' ' + r.name + (r.repeat && lv ? ' Lv.' + lv : '')) + '<div>' + r.desc + '</div>' + need +
          (done ? '<div class="idd-tip-dim">완료</div>' : `<div class="idd-tip-cost ${game.coresFree() >= game.researchCost(r) ? '' : 'no'}">📜 졸업장 ${fmt(game.researchCost(r))}장</div>` +
            (isTouch() && game.researchAvailable(r) ? '<div class="idd-tip-dim">한 번 더 누르면 구매</div>' : ''));
      }
      if (kind === 'grade') {
        const gr = game.grade();
        return title('🎒 ' + gr.name) + '<div>누적 지식이 쌓이면 진급해요. 학년이 오르면 쪽지 시험 과목이 늘어납니다.</div>' +
          (gr.next ? `<div class="idd-tip-dim">다음: ${gr.next.name} (누적 ${fmt(gr.next.at)})</div>` : '');
      }
      if (kind === 'attend') {
        const a = s.attend;
        return title('📅 출석부') + `<div>하루 한 번 접속하면 출석 보상과 스티커! 연속 출석할수록 커져요 (최대 ${D.attendance.maxStreakBonus}배). 7일째에는 스티커 ${D.attendance.weekStickers}장.</div><div class="idd-tip-dim">연속 ${a.streak}일 · 총 ${a.total}일</div>`;
      }
      if (kind === 'mult') {
        const list = game.multBreakdown();
        return title('✨ 전체 생산 배율 ' + xmult(game.globalMult())) + (list.length
          ? list.map(function (x) { return '<div>' + x.icon + ' ' + x.name + ' <b>' + xmult(x.mult) + '</b></div>'; }).join('')
          : '<div class="idd-tip-dim">업적·급식·스티커·졸업장으로 올라갑니다.</div>');
      }
      if (kind === 'period') {
        const p = game.period();
        return title('⏰ 시간표') + '<div>교시마다 정해진 교실의 생산이 <b>x' + p.mult + '</b>, 점심시간에는 클릭이 강해져요.</div>' +
          D.timetable.periods.map(function (pd, k) {
            const what = pd.click ? '클릭 x' + pd.click : pd.gens.map(function (g) { return genById[g].name; }).join('·');
            return '<div class="' + (k === p.index ? 'idd-tip-now' : 'idd-tip-dim') + '">' + pd.icon + ' ' + pd.name + ' — ' + what + '</div>';
          }).join('');
      }
      if (kind === 'combo') {
        return title('🔥 집중력') + `<div>쉬지 않고 누르면 집중력이 차서 클릭 지식이 최대 <b>x${game.comboMax()}</b>까지 올라요. 멈추면 서서히 줄어듭니다.</div>
          <div class="idd-tip-dim">💡 아하! 확률 ${Math.round(game.critChance() * 100)}% (지식 x${game.critMult()})</div>`;
      }
      if (kind === 'pnext') return title('다음 졸업장') + '<div>전체 누적 지식 ' + fmt(game.nextDiplomaAt()) + '에서 1장 더</div>';
      if (kind === 'news') return title('📢 교내 방송') + '<div class="idd-tip-dim">학교가 커질수록 새로운 소식이 들려옵니다.</div>';
      if (kind === 'lunch') {
        const own = D.lunches.filter(function (l) { return s.upgrades['lunch_' + l.id]; });
        return title('🍱 급식실') + '<div>' + own.map(function (l) { return l.icon + ' ' + l.name; }).join(' · ') + '</div><div class="idd-tip-dim">전체 생산 ' + xmult(game.lunchMult()) + '</div>';
      }
      if (kind === 'buff') {
        const e = D.praise.effects.find(function (x) { return x.id === id; });
        return e ? title('🌟 ' + e.name) + '<div>' + e.desc.replace(/^\d+초간 /, '') + '</div>' : '';
      }
      return '';
    }

    let tipTarget = null;
    function showTip(target) {
      const html = tipHtml(target.dataset.tip);
      if (!html) return;
      tipTarget = target;
      R.tip.innerHTML = html;
      R.tip.hidden = false;
      const rr = root.getBoundingClientRect(), tr = target.getBoundingClientRect();
      const w = R.tip.offsetWidth, h = R.tip.offsetHeight;
      let x = tr.left - rr.left + tr.width / 2 - w / 2;
      let y = tr.top - rr.top - h - 8;
      if (y < 4) y = tr.bottom - rr.top + 8;
      x = Math.max(6, Math.min(rr.width - w - 6, x));
      R.tip.style.left = x + 'px';
      R.tip.style.top = y + 'px';
    }
    function hideTip() { tipTarget = null; R.tip.hidden = true; }
    root.addEventListener('mouseover', function (ev) {
      if (isTouch()) return;    // 터치에서는 click 처리에서 직접 띄운다
      const t = ev.target.closest('[data-tip]');
      if (t && t !== tipTarget) showTip(t);
      else if (!t && tipTarget) hideTip();
    });
    root.addEventListener('mouseleave', function () { if (!isTouch()) hideTip(); });
    // 터치: 설명이 달린 것을 누르면 설명을 띄우고, 다른 곳을 누르면 닫는다
    root.addEventListener('click', function (ev) {
      if (!isTouch()) return;
      const t = ev.target.closest('[data-tip]');
      if (!t) hideTip();
      else if (t !== tipTarget && !t.matches('.idd-upg, .idd-res, .idd-gen')) showTip(t);
    });
    // 터치에서 구매 전에 설명부터 보여 줄지: 처음 누른 것이면 true
    function tapFirst(target) {
      if (!isTouch() || tipTarget === target) return false;
      showTip(target);
      return true;
    }

    // ============================================================ 이펙트
    const fxOn = function () { return game.state.settings.fx && !reduceMotion; };
    function rootXY(x, y) { const r = root.getBoundingClientRect(); return [x - r.left, y - r.top]; }
    function centerOf(elm) { const r = elm.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

    function floatText(x, y, text, cls) {
      const f = el('span', 'idd-float' + (cls ? ' ' + cls : ''), text);
      const p = rootXY(x, y);
      f.style.left = p[0] + 'px'; f.style.top = p[1] + 'px';
      root.appendChild(f);
      setTimeout(function () { f.remove(); }, 1000);
    }
    // 분필 가루
    function sparks(x, y, n, color) {
      if (!fxOn()) return;
      const p = rootXY(x, y);
      for (let i = 0; i < n; i++) {
        const sp = el('span', 'idd-spark');
        const a = rand(0, Math.PI * 2), d = rand(30, 80);
        sp.style.left = p[0] + 'px'; sp.style.top = p[1] + 'px';
        sp.style.setProperty('--dx', Math.cos(a) * d + 'px');
        sp.style.setProperty('--dy', Math.sin(a) * d + 'px');
        if (color) sp.style.background = color;
        root.appendChild(sp);
        setTimeout(function () { sp.remove(); }, 700);
      }
    }
    function ring(x, y) {
      if (!fxOn()) return;
      const p = rootXY(x, y), r = el('span', 'idd-ring');
      r.style.left = p[0] + 'px'; r.style.top = p[1] + 'px';
      root.appendChild(r);
      setTimeout(function () { r.remove(); }, 500);
    }
    // 축하 색종이
    function confetti(count) {
      if (!fxOn()) return;
      const colors = ['#ffe066', '#ff8fab', '#8fd3ff', '#b8f2a1', '#fff'];
      const w = root.clientWidth;
      for (let i = 0; i < (count || 70); i++) {
        const c = el('span', 'idd-confetti');
        c.style.left = rand(0, w) + 'px';
        c.style.background = colors[i % colors.length];
        c.style.setProperty('--rx', rand(-120, 120) + 'px');
        c.style.setProperty('--rot', rand(-720, 720) + 'deg');
        c.style.animationDelay = rand(0, 0.6) + 's';
        c.style.animationDuration = rand(1.8, 3) + 's';
        root.appendChild(c);
        setTimeout(function () { c.remove(); }, 3800);
      }
    }
    function restartAnim(elm, cls) { elm.classList.remove(cls); void elm.offsetWidth; elm.classList.add(cls); }

    function toast(html, cls) {
      const t = el('div', 'idd-toast' + (cls ? ' ' + cls : ''), html);
      R.toasts.appendChild(t);
      const maxToasts = root.clientWidth < 600 ? 2 : 3;   // 좁은 화면에선 2개만
      while (R.toasts.children.length > maxToasts) R.toasts.firstChild.remove();
      requestAnimationFrame(function () { t.classList.add('show'); });
      setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2800);
    }

    // ---------- 모달 (여러 개가 겹치면 차례대로 보여 준다) ----------
    // buttons: [{ label, primary, onClick }] — 생략하면 '확인' 하나. onClick이 false를 반환하면 닫지 않음
    // o: { cls, onOpen(box), onClose() }
    const modalQueue = [];
    let modalCur = null;
    function showModal(html, buttons, o) {
      modalQueue.push({ html: html, buttons: buttons, o: o || {} });
      if (!modalCur) nextModal();
    }
    function nextModal() {
      modalCur = modalQueue.shift() || null;
      if (!modalCur) { R.modal.hidden = true; return; }
      R.modalBox.className = 'idd-modal-box' + (modalCur.o.cls ? ' ' + modalCur.o.cls : '');
      R.modalText.innerHTML = modalCur.html;
      setModalButtons(modalCur.buttons === undefined ? [{ label: '확인', primary: true }] : modalCur.buttons);
      R.modal.hidden = false;
      hideTip();
      if (modalCur.o.onOpen) modalCur.o.onOpen(R.modalText);
    }
    function setModalButtons(buttons) {
      R.modalBtns.innerHTML = '';
      (buttons || []).forEach(function (b) {
        const btn = el('button', 'idd-btn' + (b.primary ? '' : ' idd-btn-ghost'), b.label);
        btn.type = 'button';
        btn.addEventListener('click', function () {
          if (b.onClick && b.onClick() === false) return;
          closeModal();
        });
        R.modalBtns.appendChild(btn);
      });
    }
    function closeModal() {
      const cur = modalCur;
      modalCur = null;
      if (cur && cur.o.onClose) cur.o.onClose();
      nextModal();
    }

    // ---------- 앨범 스티커를 얻었을 때 ----------
    function stickerChip(d) {
      const t = d.sticker, rar = D.rarities[t.rarity];
      return `<span class="idd-drop${d.isNew ? ' new' : ''}" style="--rar:${rar.color}"><span class="idd-drop-icon">${t.icon}</span><span class="idd-drop-name">${t.name}</span>` +
        `<small>${d.isNew ? 'NEW · ' + rar.name : '+' + fmt(d.dupReward) + ' 지식'}</small></span>`;
    }
    function dropsHtml(drops) { return '<div class="idd-drops">' + drops.map(stickerChip).join('') + '</div>'; }
    // 1장이면 토스트, 여러 장이면 창으로 보여 준다
    function announceDrops(drops, label) {
      if (!drops || !drops.length) return;
      albumDirty = true;
      const best = drops.some(function (d) { return d.isNew && (d.sticker.rarity === 'legend' || d.sticker.rarity === 'epic'); });
      if (drops.some(function (d) { return d.isNew; })) { sound.play('sticker'); R.dotAlbum.hidden = tab === 'album'; }
      if (best) confetti(40);
      if (drops.length === 1) {
        const d = drops[0], rar = D.rarities[d.sticker.rarity];
        toast(d.isNew
          ? '📔 새 스티커! ' + d.sticker.icon + ' <b>' + d.sticker.name + '</b> <small>(' + rar.name + ')</small>'
          : '📔 ' + d.sticker.icon + ' ' + d.sticker.name + ' 한 장 더 <small>(+' + fmt(d.dupReward) + ')</small>', d.isNew ? 'gold' : '');
      } else {
        showModal('<div class="idd-modal-icon">📔</div><b>' + (label || '스티커') + '</b> — 스티커 ' + drops.length + '장!' + dropsHtml(drops));
      }
    }

    // ============================================================ 우리 학교 (교실 풍경)
    // 생산기마다 교실 하나. 1개 살 때마다 일꾼이 한 명 늘고, 업그레이드를 사면 교실 선반에 물건이 놓인다.
    const rooms = {};
    let roomCap = 24, deskReady = false, cafeteria = null;
    const stripQuery = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
    const isStrip = function () { return stripQuery.matches; };   // 좁은 화면: 교실이 가로로 늘어선다

    // 교실 폭에 맞춰 화면에 그릴 일꾼 수를 정한다 (그 이상은 숫자로만)
    function computeRoomCap() {
      const floor = R.rooms.querySelector('.idd-room-floor');
      const w = floor ? floor.clientWidth : 0;
      if (!w) return;
      const cap = Math.max(8, Math.min(40, Math.floor((w - 12) / 24) * 2));
      if (cap === roomCap) return;
      roomCap = cap;
      for (const id in rooms) {
        rooms[id].floor.querySelectorAll('.idd-worker').forEach(function (x) { x.remove(); });
        rooms[id].shown = 0;
      }
    }

    function buildRoom(g) {
      const room = el('div', 'idd-room');
      room.dataset.gen = g.id;
      room.dataset.anim = g.anim;
      room.innerHTML = `
        <div class="idd-room-head" data-tip="gen:${g.id}">
          <span class="idd-room-name">${g.icon} ${g.name} <b data-k="count">0</b><em data-k="stars"></em></span>
          <span class="idd-room-boost" data-k="boost" hidden></span>
          <span class="idd-room-rate" data-k="rate"></span>
        </div>
        <div class="idd-room-floor" data-k="floor"></div>
        <div class="idd-room-shelf" data-k="shelf"></div>
        <div class="idd-room-bar"><i data-k="bar"></i></div>`;
      const ref = { el: room, shown: 0, placed: {}, ready: false, tiers: -1 };
      room.querySelectorAll('[data-k]').forEach(function (e) { ref[e.dataset.k] = e; });
      ref.bar.style.animationDuration = ROOM_CYCLE + 's';
      // 진행 막대가 한 바퀴 돌 때마다 그동안 이 교실이 번 지식을 띄운다
      ref.bar.addEventListener('animationiteration', function () {
        const earned = game.genRate(g) * game.state.gens[g.id] * game.genBoost(g.id) * game.buffMult('prod') * ROOM_CYCLE;
        if (!(earned > 0) || !fxOn()) return;
        const f = el('span', 'idd-room-gain', '+' + fmt(earned));
        ref.el.appendChild(f);
        setTimeout(function () { f.remove(); }, 1200);
      });
      // 교실 순서는 상점 순서대로 (급식실은 맨 끝)
      const order = D.generators.indexOf(g);
      const next = Array.prototype.find.call(R.rooms.children, function (c) {
        return c.dataset.gen === 'cafeteria' || D.generators.indexOf(genById[c.dataset.gen]) > order;
      });
      R.rooms.insertBefore(room, next || null);
      rooms[g.id] = ref;
      return ref;
    }

    function addWorker(ref, g, i, isNew) {
      const w = el('span', 'idd-worker' + (isNew ? ' new' : ''), g.sprites[i % g.sprites.length]);
      const col = Math.floor(i / 2), lane = i % 2;
      w.style.left = (6 + col * 24 + lane * 12 + hash(i) * 3) + 'px';
      w.style.top = (lane ? 32 : 9) + hash(i + 99) * 3 + 'px';
      w.style.animationDelay = (-hash(i + 7) * 2).toFixed(2) + 's' + (isNew ? ', 0s' : '');
      w.style.zIndex = lane + 1;
      ref.floor.appendChild(w);
    }

    // 새로 산 교실이 보이게 목록만 스크롤 (페이지 전체는 움직이지 않는다)
    function revealRoom(elm) {
      const c = R.rooms;
      const smooth = fxOn() ? 'smooth' : 'auto';
      if (isStrip()) {
        c.scrollTo({ left: elm.offsetLeft - (c.clientWidth - elm.offsetWidth) / 2, behavior: smooth });
      } else if (elm.offsetTop < c.scrollTop || elm.offsetTop + elm.offsetHeight > c.scrollTop + c.clientHeight) {
        c.scrollTo({ top: elm.offsetTop - 6, behavior: smooth });
      }
    }

    function renderCampus(flashId) {
      const s = game.state;
      const prodBuff = game.buffMult('prod');
      let any = false;
      D.generators.forEach(function (g) {
        const n = s.gens[g.id];
        let ref = rooms[g.id];
        if (!n) {
          if (ref) { ref.el.remove(); delete rooms[g.id]; }
          return;
        }
        any = true;
        if (!ref) { ref = buildRoom(g); computeRoomCap(); }

        // 일꾼: 보유 수만큼 (최대 roomCap)
        const want = Math.min(n, roomCap);
        if (want < ref.shown) {
          ref.floor.querySelectorAll('.idd-worker').forEach(function (w) { w.remove(); });
          ref.shown = 0;
        }
        const fresh = ref.ready && fxOn();   // 처음 화면을 그릴 땐 등장 효과 없이
        for (let i = ref.shown; i < want; i++) addWorker(ref, g, i, fresh);
        ref.shown = want;
        ref.count.textContent = '×' + n.toLocaleString('ko-KR');

        // 선반: 산 업그레이드(단계·시너지)가 물건으로 놓인다. 단계가 오를수록 일하는 속도도 빨라짐
        let tiers = 0;
        game.upgrades.forEach(function (u) {
          if (u.gen !== g.id) return;
          const owned = !!s.upgrades[u.id];
          if (owned && u.kind === 'gen') tiers++;
          if (owned && !ref.placed[u.id]) {
            const it = el('span', 'idd-item' + (ref.ready && fxOn() ? ' new' : ''), u.icon);
            it.dataset.tip = 'upg:' + u.id;
            ref.shelf.appendChild(it);
            ref.placed[u.id] = it;
          } else if (!owned && ref.placed[u.id]) {
            ref.placed[u.id].remove(); delete ref.placed[u.id];
          }
        });
        if (tiers !== ref.tiers) {
          ref.tiers = tiers;
          ref.el.style.setProperty('--spd', (1.6 / (1 + tiers * 0.3)).toFixed(2) + 's');
          ref.el.dataset.lv = tiers >= 7 ? 3 : tiers >= 5 ? 2 : tiers >= 3 ? 1 : 0;
          ref.stars.textContent = tiers ? ' ★' + tiers : '';
        }
        const boost = game.genBoost(g.id);
        ref.el.classList.toggle('boost', boost > 1);
        ref.boost.hidden = boost <= 1;
        if (boost > 1) ref.boost.textContent = '📖 수업 중 x' + boost;
        ref.rate.textContent = fmt(game.genRate(g) * n * boost * prodBuff) + '/초';
        ref.ready = true;
      });

      // 급식실: 산 급식 메뉴가 차려진다
      const lunches = D.lunches.filter(function (l) { return s.upgrades['lunch_' + l.id]; });
      if (!lunches.length && cafeteria) { cafeteria.el.remove(); cafeteria = null; }
      if (lunches.length) {
        any = true;
        if (!cafeteria) {
          const room = el('div', 'idd-room');
          room.dataset.gen = 'cafeteria';
          room.innerHTML = `<div class="idd-room-head" data-tip="lunch"><span class="idd-room-name">🍱 급식실 <b data-k="count"></b></span><span class="idd-room-rate" data-k="rate"></span></div><div class="idd-room-floor idd-trays" data-k="floor"></div>`;
          cafeteria = { el: room, placed: {}, ready: false };
          room.querySelectorAll('[data-k]').forEach(function (e) { cafeteria[e.dataset.k] = e; });
          R.rooms.appendChild(room);
        }
        lunches.forEach(function (l) {
          if (cafeteria.placed[l.id]) return;
          const f = el('span', 'idd-food' + (cafeteria.ready && fxOn() ? ' new' : ''), l.icon);
          f.dataset.tip = 'upg:lunch_' + l.id;
          cafeteria.floor.appendChild(f);
          cafeteria.placed[l.id] = f;
        });
        for (const id in cafeteria.placed) {
          if (!s.upgrades['lunch_' + id]) { cafeteria.placed[id].remove(); delete cafeteria.placed[id]; }
        }
        cafeteria.count.textContent = lunches.length + '가지';
        cafeteria.rate.textContent = '전체 생산 ' + xmult(game.lunchMult());
        cafeteria.ready = true;
      }
      R.campusEmpty.hidden = any;

      if (flashId) {
        const target = flashId === 'cafeteria' ? cafeteria : rooms[flashId];
        if (target) { restartAnim(target.el, 'flash'); revealRoom(target.el); }
      }

      // 책상 위 클릭 업그레이드
      const desk = D.clickUpgrades.filter(function (c) { return s.upgrades[c.id]; });
      R.desk.hidden = !desk.length;
      const deskKey = desk.map(function (c) { return c.id; }).join(',');
      if (deskReady && R.desk.dataset.key === deskKey) return;
      const before = (R.desk.dataset.key || '').split(',');
      R.desk.dataset.key = deskKey;
      R.desk.innerHTML = '<span class="idd-desk-label">책상</span>' + desk.map(function (c) {
        const isNew = deskReady && fxOn() && before.indexOf(c.id) < 0;
        return `<span class="idd-desk-item${isNew ? ' new' : ''}" data-tip="upg:${c.id}">${c.icon}</span>`;
      }).join('');
      deskReady = true;
    }

    // 일꾼 머리 위로 작업 이모지가 떠오른다 (일하는 중!)
    function workParticles() {
      if (!fxOn()) return;
      for (const id in rooms) {
        const ref = rooms[id], g = genById[id];
        if (!ref.shown || Math.random() > Math.min(0.9, 0.2 + ref.shown * 0.05)) continue;
        const ws = ref.floor.querySelectorAll('.idd-worker');
        const w = ws[Math.floor(Math.random() * ws.length)];
        if (!w) continue;
        const p = el('span', 'idd-work', g.work);
        p.style.left = (parseFloat(w.style.left) + 6) + 'px';
        p.style.top = (parseFloat(w.style.top) - 6) + 'px';
        ref.floor.appendChild(p);
        setTimeout(function () { p.remove(); }, 1100);
      }
    }

    // ============================================================ 입력
    function study(x, y) {
      const r = game.click();
      if (r.crit) {
        floatText(x, y, '💡 아하! +' + fmt(r.amount), 'crit');
        sparks(x, y, 12, '#ffe066');
        sound.play('crit');
      } else {
        floatText(x, y, '+' + fmt(r.amount));
        sparks(x, y, 4);
        sound.play('click');
      }
      ring(x, y);
      restartAnim(orb, 'pop');
      if (!R.hint.hidden && game.state.clicks >= 3) R.hint.hidden = true;
    }
    // 손가락이 닿는 순간 바로 반응(연타가 잘 먹히게). 키보드(Enter/Space)는 click으로 처리
    orb.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault();
      study(ev.clientX, ev.clientY);
    });
    orb.addEventListener('click', function (ev) {
      if (ev.detail !== 0) return;   // 마우스/터치 클릭은 pointerdown에서 이미 처리
      const c = centerOf(orb);
      study(c[0], c[1]);
    });
    // 더블탭 확대·길게 눌러 메뉴 막기
    root.addEventListener('dblclick', function (ev) { ev.preventDefault(); });
    root.addEventListener('contextmenu', function (ev) { if (ev.target.closest('.idd-orb, .idd-bonus, .idd-mini-sticker')) ev.preventDefault(); });

    function pointOf(ev, elm) { return ev.clientX || ev.clientY ? [ev.clientX, ev.clientY] : centerOf(elm); }

    R.gens.addEventListener('click', function (ev) {
      const row = ev.target.closest('.idd-gen');
      if (!row) return;
      const id = row.dataset.gen, g = genById[id];
      if (game.genLocked(id)) { toast('🚫 도전 학기 규칙으로 ' + g.name + josa(g.name, '은', '는') + ' 살 수 없어요'); return; }
      const before = game.state.gens[id];
      if (game.buyGen(id, buyAmount)) {
        const k = game.state.gens[id] - before, p = pointOf(ev, row);
        sound.play('buy');
        floatText(p[0], p[1], g.sprites[before % g.sprites.length] + ' +' + k, 'buy');
        refreshShop(true);
        renderCampus(id);
        if (tipTarget === row) showTip(row);
      } else {
        restartAnim(row, 'nope');
      }
    });

    function upgradePlace(u) {
      if (u.kind === 'click') return '책상에 놓였어요';
      if (u.kind === 'lunch') return '급식실에 차려졌어요';
      return genById[u.gen].name + ' 교실 선반에 놓였어요';
    }
    R.upgrades.addEventListener('click', function (ev) {
      const card = ev.target.closest('.idd-upg');
      if (!card || tapFirst(card)) return;
      const u = upgById[card.dataset.id];
      if (game.buyUpgrade(u.id)) {
        hideTip();
        sound.play('buy');
        toast(u.icon + ' <b>' + u.name + '</b> 구매! ' + upgradePlace(u));
        refreshShop(true);
        renderCampus(u.kind === 'lunch' ? 'cafeteria' : u.gen);
      } else {
        restartAnim(card, 'nope');
      }
    });

    R.amtSeg.addEventListener('click', function (ev) {
      const b = ev.target.closest('button');
      if (!b) return;
      buyAmount = b.dataset.amt === 'max' ? 'max' : Number(b.dataset.amt);
      R.amtSeg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      refreshShop(true);
    });

    R.research.addEventListener('click', function (ev) {
      const t = ev.target.closest('.idd-res');
      if (!t || tapFirst(t)) return;
      const r = resById[t.dataset.id];
      if (game.buyResearch(r.id)) {
        sound.play('ach');
        toast('📜 발전 계획 · <b>' + r.name + (r.repeat ? ' Lv.' + game.lvl(r.id) : '') + '</b>', 'gold');
        praiseCfg = game.praiseConfig();
        refreshShop(true);
        if (tipTarget === t) showTip(t);
      } else {
        restartAnim(t, 'nope');
      }
    });

    function syncSettingsUI() {
      const st = game.state.settings;
      R.notation.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.notation === st.notation); });
      R.soundSeg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', (b.dataset.sound === '1') === st.sound); });
      R.fxSeg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', (b.dataset.fx === '1') === st.fx); });
      root.classList.toggle('idd-lowfx', !st.fx);
    }
    R.notation.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-notation]');
      if (!b) return;
      game.state.settings.notation = notation = b.dataset.notation;
      syncSettingsUI(); redrawAll();
    });
    R.soundSeg.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-sound]');
      if (!b) return;
      game.state.settings.sound = sound.enabled = b.dataset.sound === '1';
      syncSettingsUI();
      sound.play('buy');
    });
    R.fxSeg.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-fx]');
      if (!b) return;
      game.state.settings.fx = b.dataset.fx === '1';
      syncSettingsUI();
    });

    R.tabs.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      R.tabs.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      root.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== tab; });
      R.tabbody.scrollTop = 0;
      hideTip();
      if (tab === 'ach') { R.dotAch.hidden = true; achDirty = true; }
      if (tab === 'album') { R.dotAlbum.hidden = true; albumDirty = true; }
      refreshShop(true);
    });

    // 상태가 통째로 바뀐 뒤(졸업·초기화·가져오기) 화면을 처음부터 다시 그린다
    function redrawAll() {
      upgKey = ''; praiseCfg = game.praiseConfig();
      for (const id in rooms) { rooms[id].el.remove(); delete rooms[id]; }
      if (cafeteria) { cafeteria.el.remove(); cafeteria = null; }
      deskReady = false; achDirty = albumDirty = true;
      shownLight = game.state.light;
      refreshShop(true); renderCampus(); refreshSlow();
    }

    // ============================================================ 버튼 동작
    const esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

    const actions = {
      save: function () { game.save(); toast('💾 저장했습니다'); },
      quiz: function () { openQuiz(); },
      help: function () { showHelp(); },
      homework: function (ev, btn) {
        const r = game.homeworkClaim();
        if (!r) return;
        const c = centerOf(btn);
        sound.play('ach');
        sparks(c[0], c[1], 12, '#b8f2a1');
        if (r.drops.length) announceDrops(r.drops, '숙제 보상');
        else { floatText(c[0], c[1], '+' + fmt(r.amount), 'big'); toast('📚 숙제 제출! 지식 <b>+' + fmt(r.amount) + '</b>', 'gold'); }
        refreshSlow(); refreshShop(true);
      },
      buyAll: function () {
        const bought = game.buyAllUpgrades();
        if (!bought.length) { toast('지금 살 수 있는 업그레이드가 없어요'); return; }
        sound.play('buy');
        hideTip();
        toast('🛒 업그레이드 <b>' + bought.length + '개</b> 구매! ' + bought.slice(0, 6).map(function (u) { return u.icon; }).join('') + (bought.length > 6 ? '…' : ''));
        refreshShop(true); renderCampus();
      },
      reset: function () {
        showModal('<div class="idd-modal-icon">⚠️</div>정말 <b>모든 진행</b>을 지울까요?<br><small>졸업장·업적·스티커·발전 계획까지 전부 사라집니다.</small>', [
          { label: '취소' },
          { label: '전체 초기화', primary: true, onClick: function () { game.hardReset(); redrawAll(); toast('초기화했습니다'); } },
        ]);
      },
      export: function () {
        const code = game.exportSave();
        showModal('<div class="idd-modal-icon">📤</div>아래 코드를 복사해 보관하세요.<textarea class="idd-code" readonly>' + code + '</textarea>', [
          { label: '닫기' },
          { label: '복사', primary: true, onClick: function () {
            const ta = R.modalText.querySelector('textarea');
            ta.select();
            (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).catch(function () { try { document.execCommand('copy'); } catch (e) { /* 무시 */ } });
            toast('📋 복사했습니다');
          } },
        ]);
      },
      import: function () {
        showModal('<div class="idd-modal-icon">📥</div>내보내기 코드를 붙여넣으세요.<br><small>현재 진행은 덮어써집니다.</small><textarea class="idd-code" placeholder="코드 붙여넣기"></textarea>', [
          { label: '취소' },
          { label: '가져오기', primary: true, onClick: function () {
            const ok = game.importSave(R.modalText.querySelector('textarea').value);
            if (!ok) { toast('⚠️ 올바르지 않은 코드입니다'); return false; }
            notation = game.state.settings.notation; sound.enabled = game.state.settings.sound;
            syncSettingsUI(); redrawAll();
            toast('📥 불러왔습니다');
          } },
        ]);
      },
      prestige: function () {
        const g = game.prestigeGain();
        if (g < 1) return;
        const ch = game.activeChallenge();
        showModal('<div class="idd-modal-icon">🎓</div>졸업하고 졸업장 <b>' + fmt(g) + '</b>장을 받을까요?<br><small>지식·교실·업그레이드가 초기화됩니다.<br>업적·스티커·발전 계획·졸업장은 유지됩니다.' +
          (ch ? '<br><b>진행 중인 도전 학기(' + ch.name + ')는 포기하게 됩니다.</b>' : '') + '</small>', [
          { label: '취소' },
          { label: '졸업!', primary: true, onClick: function () {
            game.prestige(); redrawAll();
            sound.play('grad');
            confetti();
            toast('🎓 졸업 축하해요! 졸업장 <b>+' + fmt(g) + '</b>', 'gold');
          } },
        ]);
      },
    };

    function challengeAction(id) {
      const c = chalById[id], st = game.state;
      if (st.challenge.done[id]) return;
      if (st.challenge.active === id) {
        showModal('<div class="idd-modal-icon">🏳️</div><b>' + c.name + '</b>을(를) 포기할까요?<br><small>규칙만 사라지고 이번 학기는 그대로 이어집니다.<br>나중에 다시 도전할 수 있어요.</small>', [
          { label: '계속 도전' },
          { label: '포기', primary: true, onClick: function () { game.challengeAbandon(); toast('도전 학기를 포기했습니다'); redrawAll(); } },
        ]);
        return;
      }
      if (!game.challengeUnlocked()) { toast('🔒 졸업을 ' + D.challengeUnlock + '번 하면 도전할 수 있어요'); return; }
      if (st.challenge.active) { toast('이미 다른 도전 학기를 진행 중이에요'); return; }
      const gain = game.prestigeGain();
      showModal('<div class="idd-modal-icon">' + c.icon + '</div><b>' + c.name + '</b>에 도전할까요?<br>' + c.rule + '<br><small>지금 학기는 졸업 처리되고' + (gain ? ' (졸업장 +' + fmt(gain) + ')' : '') +
        ' 규칙이 걸린 새 학기가 시작됩니다.<br>목표: 이번 학기 지식 ' + fmt(c.goal) + (c.timeLimit ? ' · 제한 ' + fmtTime(c.timeLimit) : '') + '<br>보상: ' + c.reward + ' + 스티커 ' + D.challengeStickers + '장</small>', [
        { label: '취소' },
        { label: '도전!', primary: true, onClick: function () {
          if (game.challengeStart(id)) { redrawAll(); sound.play('grad'); toast(c.icon + ' <b>' + c.name + '</b> 시작!', 'gold'); }
        } },
      ]);
    }

    root.addEventListener('click', function (ev) {
      const a = ev.target.closest('[data-act]');
      if (a) { if (actions[a.dataset.act] && !a.disabled) actions[a.dataset.act](ev, a); return; }
      const c = ev.target.closest('[data-chal]');
      if (c) challengeAction(c.dataset.chal);
    });

    function showHelp() {
      const T = D.timetable, P = D.praise;
      showModal(`<div class="idd-help">
        <h3>📖 아이들 스쿨 안내</h3>
        <h4>✏️ 기본</h4>
        <p>교과서를 눌러 <b>지식</b>을 모으고, 상점에서 <b>교실</b>(연필·학생·선생님…)을 사면 저절로 지식이 쌓입니다. 교실을 살 때마다 <b>우리 학교</b>에 일꾼이 늘고, 업그레이드를 사면 그 교실 선반에 물건이 놓여요.</p>
        <h4>🔥 집중력과 아하!</h4>
        <p>쉬지 않고 누르면 집중력이 차서 클릭 지식이 최대 x${game.comboMax()}. 가끔 <b>💡 아하!</b>가 터지면 x${game.critMult()}!</p>
        <h4>⏰ 시간표</h4>
        <p>${T.periodSec}초마다 교시가 바뀌고, 그 교시의 교실은 생산이 x${game.periodMult()}가 됩니다. 점심시간에는 클릭이 x3.</p>
        <h4>🌟 칭찬 스티커</h4>
        <p>가끔 화면에 나타나는 <b>참잘했어요</b> 도장을 누르면 지식·생산 폭발·선물 같은 보너스를 받고, 앨범에 붙일 스티커도 나와요.</p>
        <h4>📝 쪽지 시험 · 📚 숙제 · 📅 출석</h4>
        <p>쪽지 시험은 맞힐수록 보상이 커지고, 학년이 오르면 영어·맞춤법·수도·과학·속담 과목이 열립니다. 숙제는 다음에 할 일을 알려 주는 길잡이예요. 출석은 하루 한 번, 연속으로 할수록 좋아요.</p>
        <h4>🎓 졸업</h4>
        <p>전체 누적 지식 ${fmt(D.prestige.unlockAt)}부터 졸업할 수 있어요. 진행은 초기화되지만 <b>졸업장</b>이 생산을 영구히 올려 주고, <b>학교 발전 계획</b>에 쓸 수 있습니다. 보통 졸업장이 지금의 절반쯤 더 모였을 때 졸업하면 좋아요.</p>
        <h4>🏅 도전 학기</h4>
        <p>졸업을 ${D.challengeUnlock}번 하면 열립니다. 규칙이 걸린 학기에서 목표를 달성하면 영구 보상!</p>
        <h4>🌙 자리를 비우면</h4>
        <p>게임을 닫아도 지식이 쌓입니다 (기본 최대 ${fmtTime(D.OFFLINE_CAP_SEC)}, 효율 ${Math.round(D.OFFLINE_RATE * 100)}% — 발전 계획으로 늘릴 수 있어요).</p>
      </div>`, [{ label: '닫기', primary: true }], { cls: 'wide' });
    }

    // ============================================================ 쪽지 시험
    let quizTimer = null;
    function openQuiz() {
      if (modalCur) return;
      if (game.state.challenge.active === 'quiet') { toast('🤫 조용한 학기에는 쪽지 시험이 없어요'); return; }
      const q = game.quizStart();
      if (!q) { toast('📝 아직 쉬는 시간이에요 (' + fmtTime(game.quizReadyIn() / 1000) + ' 남음)'); return; }
      refreshSlow();
      const streak = game.state.quiz.streak;
      let done = false, left = q.timeSec;
      showModal(`<div class="idd-quiz-head"><span>${q.icon} ${q.subjectName}</span><span class="idd-quiz-streak">${streak ? '🔥 ' + streak + '연속' : ''}</span></div>
        <div class="idd-quiz-hint">${q.hint ? esc(q.hint) : '&nbsp;'}</div>
        <div class="idd-quiz-q${q.text.length > 11 ? ' long' : ''}">${esc(q.text)}</div>
        <div class="idd-quiz-time"><i style="animation-duration:${q.timeSec}s"></i></div>
        <div class="idd-quiz-choices">${q.choices.map(function (c, i) { return '<button type="button" class="idd-quiz-c" data-i="' + i + '">' + esc(c) + '</button>'; }).join('')}</div>
        <div class="idd-quiz-msg"></div>`, [], {
        cls: 'quiz',
        onClose: function () { clearInterval(quizTimer); if (!done) game.quizAnswer(q, null); },
        onOpen: function (box) {
          const bar = box.querySelector('.idd-quiz-time i');
          function finish(i) {
            if (done) return;
            done = true;
            clearInterval(quizTimer);
            const picked = i == null ? null : q.choices[i];
            const res = game.quizAnswer(q, picked);
            box.querySelectorAll('.idd-quiz-c').forEach(function (b, k) {
              b.disabled = true;
              if (q.choices[k] === q.answer) b.classList.add('right');
              else if (k === i) b.classList.add('wrong');
            });
            bar.style.animationPlayState = 'paused';
            const msg = box.querySelector('.idd-quiz-msg');
            if (res.ok) {
              sound.play('bonus');
              msg.innerHTML = '💯 정답! 지식 <b>+' + fmt(res.reward) + '</b>' + (res.streak > 1 ? ' <small>(' + res.streak + '연속 보너스)</small>' : '');
              const c = centerOf(box);
              sparks(c[0], c[1], 16, '#ffe066');
              if (res.drop) announceDrops([res.drop], '쪽지 시험');
            } else {
              sound.play('wrong');
              msg.innerHTML = (i == null ? '⏰ 시간 초과! ' : '❌ 아쉬워요. ') + '정답은 <b>' + esc(q.answer) + '</b>';
            }
            setModalButtons([{ label: '확인', primary: true }]);
            refreshSlow();
          }
          box.querySelectorAll('.idd-quiz-c').forEach(function (b) {
            b.addEventListener('click', function () { finish(Number(b.dataset.i)); });
          });
          clearInterval(quizTimer);
          quizTimer = setInterval(function () { left -= 0.25; if (left <= 0) finish(null); }, 250);
        },
      });
    }

    // ============================================================ 칭찬 스티커
    let praiseCfg = game.praiseConfig();
    let praiseTimer = rand(praiseCfg.firstDelay[0], praiseCfg.firstDelay[1]);

    function applyPraise(r, pt) {
      if (!r) return;
      const e = r.effect, who = r.auto ? '🙋 반장이 받아 줌 · ' : '';
      sound.play('bonus');
      if (pt) sparks(pt[0], pt[1], 14, '#ffe066');
      if (e.id === 'gift' && r.gen) {
        const g = genById[r.gen];
        if (pt) floatText(pt[0], pt[1], g.icon + ' +' + r.count, 'big');
        toast(who + '🎁 <b>' + e.name + '</b> ' + g.name + ' ' + r.count + g.unit + ' 받았어요!', 'gold');
        refreshShop(true); renderCampus(r.gen);
      } else if (e.id === 'lucky') {
        if (pt) floatText(pt[0], pt[1], '+' + fmt(r.amount), 'big');
        toast(who + '🌟 <b>' + e.name + '</b> 지식 +' + fmt(r.amount), 'gold');
      } else if (e.id === 'rain') {
        toast('🌧️ <b>' + e.name + '</b> 떨어지는 스티커를 눌러요!', 'gold');
        spawnRain(r.minis);
      } else {
        if (pt) floatText(pt[0], pt[1], e.name + '!', 'big');
        const b = game.state.buffs.find(function (x) { return x.id === e.id; });
        toast(who + '🌟 <b>' + e.name + '</b> ' + Math.round(b ? b.total : e.sec) + '초간 ' + e.desc.replace(/^\d+초간 /, ''), 'gold');
      }
      announceDrops(r.drops, '칭찬 스티커');
    }

    function spawnPraise() {
      if (!praiseCfg.enabled) return;
      const b = el('button', 'idd-bonus');
      b.type = 'button';
      b.setAttribute('aria-label', '칭찬 스티커');
      b.innerHTML = `<svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="#ff6b6b" stroke="#fff" stroke-width="4"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#ffd1d1" stroke-width="2" stroke-dasharray="4 4"/>
        <path d="${starPath(50, 42, 22, 10)}" fill="#ffe066" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
        <text x="50" y="77" font-size="12" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif" textLength="56" lengthAdjust="spacingAndGlyphs">참잘했어요</text>
      </svg>`;
      const w = root.clientWidth, h = root.clientHeight;
      b.style.left = rand(30, Math.max(40, w - 110)) + 'px';
      b.style.top = rand(70, Math.max(90, Math.min(h, 720) - 130)) + 'px';
      b.style.animationDuration = praiseCfg.life + 's, 1.6s, 3s';
      let claimed = false;
      b.addEventListener('click', function (ev) {
        if (claimed) return;
        claimed = true;
        const pt = pointOf(ev, b);
        b.remove();
        applyPraise(game.claimBonus(), pt);
      });
      R.bonusLayer.appendChild(b);
      setTimeout(function () {
        if (claimed || !b.isConnected) return;
        b.remove();
        if (game.praiseConfig().auto) applyPraise(game.claimBonus({ auto: true }), null);   // 반장이 대신 받는다
      }, praiseCfg.life * 1000);
    }

    // 스티커 비: 작은 스티커가 위에서 떨어진다
    function spawnRain(n) {
      const icons = ['⭐', '💛', '🌟', '✨'];
      for (let i = 0; i < n; i++) {
        setTimeout(function () {
          const m = el('button', 'idd-mini-sticker', icons[i % icons.length]);
          m.type = 'button';
          m.setAttribute('aria-label', '작은 스티커');
          m.style.left = rand(20, Math.max(30, root.clientWidth - 70)) + 'px';
          const dur = rand(3.6, 5.2);
          m.style.animationDuration = dur + 's';
          m.style.setProperty('--fall', Math.min(root.clientHeight, 760) + 'px');
          let got = false;
          m.addEventListener('pointerdown', function (ev) {
            if (got) return;
            got = true;
            ev.preventDefault();
            const amount = game.claimMini();
            floatText(ev.clientX, ev.clientY, '+' + fmt(amount), 'big');
            sparks(ev.clientX, ev.clientY, 6, '#ffe066');
            sound.play('click');
            m.remove();
          });
          R.bonusLayer.appendChild(m);
          setTimeout(function () { m.remove(); }, dur * 1000);
        }, i * 280);
      }
    }

    // ============================================================ 화면 갱신
    let upgKey = '', achDirty = true, albumDirty = true;
    const knownGens = {};
    let knownReady = false;

    function upgradeBadge(u) {
      if (u.kind === 'gen') return '<span class="idd-upg-tier">' + genById[u.gen].icon + ROMAN[u.tier] + '</span>';
      if (u.kind === 'syn') return '<span class="idd-upg-tier idd-syn">' + genById[u.gen].icon + '+' + genById[u.from].icon + '</span>';
      if (u.kind === 'lunch') return '<span class="idd-upg-tier idd-lunch">급식</span>';
      return '<span class="idd-upg-tier">✍️</span>';
    }

    function refreshShop(force) {
      const s = game.state;

      // 업그레이드 타일: 목록이 바뀔 때만 다시 만든다
      const visible = game.visibleUpgrades();
      const key = visible.map(function (u) { return u.id; }).join(',');
      if (force || key !== upgKey) {
        upgKey = key;
        if (tipTarget && tipTarget.classList.contains('idd-upg')) hideTip();
        R.upgrades.innerHTML = visible.length ? '' : '<div class="idd-empty">조건을 채우면 업그레이드가 나타납니다.</div>';
        visible.forEach(function (u) {
          const c = el('button', 'idd-upg ' + u.kind, '<span class="idd-upg-icon">' + u.icon + '</span>' + upgradeBadge(u));
          c.type = 'button';
          c.dataset.id = u.id;
          c.dataset.tip = 'upg:' + u.id;
          R.upgrades.appendChild(c);
        });
      }
      let affordable = 0;
      R.upgrades.querySelectorAll('.idd-upg').forEach(function (c) {
        const off = s.light < game.upgradeCost(upgById[c.dataset.id]);
        c.classList.toggle('off', off);
        if (!off) affordable++;
      });
      R.buyAll.disabled = !affordable;
      R.buyAll.textContent = affordable > 1 ? '모두 구매 (' + affordable + ')' : '모두 구매';
      R.dotShop.hidden = tab === 'shop' || !affordable;

      // 교실: 가진 것과 바로 다음 1개까지만 공개
      let revealNext = true;
      const rate = game.income();
      D.generators.forEach(function (g, gi) {
        const r = genRows[g.id];
        const owned = s.gens[g.id];
        const known = gi === 0 || owned > 0 || s.allTime >= g.baseCost * 0.5;
        if (known && !knownGens[g.id]) {
          knownGens[g.id] = true;
          if (knownReady && !owned) toast('🆕 새 교실을 열 수 있어요: ' + g.icon + ' <b>' + g.name + '</b>');
        }
        if (!known && !revealNext) { r.row.hidden = true; return; }
        r.row.hidden = false;
        r.row.classList.toggle('locked', !known);
        if (!known) revealNext = false;
        const banned = game.genLocked(g.id);
        const k = buyAmount === 'max' ? Math.max(1, game.maxAffordable(g)) : buyAmount;
        const cost = game.bulkCost(g, k);
        r.owned.textContent = owned;
        r.cost.textContent = fmt(cost) + (k > 1 ? '  ×' + k : '');
        r.row.classList.toggle('off', banned || s.light < cost);
        r.row.classList.toggle('banned', banned);
        r.eta.textContent = banned ? '🚫 도전 규칙' : (s.light < cost && rate > 0 && known ? '⏱ ' + fmtTime((cost - s.light) / rate) : '');
        const boost = owned ? game.genBoost(g.id) : 1;
        r.tag.textContent = boost > 1 ? '수업 중 x' + boost : '';
        // 다음 업그레이드가 열리는 보유 수까지의 진행도
        const nextTier = D.genUpgradeTiers.find(function (t) { return owned < t.need; });
        r.next.style.width = nextTier ? (owned / nextTier.need * 100) + '%' : '100%';
      });
      knownReady = true;

      R.multAll.textContent = xmult(game.globalMult());

      // 졸업 탭 알림 점: 졸업장이 40% 넘게 늘 수 있거나, 살 수 있는 발전 계획이 있을 때
      const pg = game.prestigeGain();
      const canResearch = D.research.some(function (r) { return game.researchAvailable(r) && game.coresFree() >= game.researchCost(r); });
      R.dotPrestige.hidden = tab === 'prestige' || !(canResearch || (pg >= 1 && pg >= s.cores * 0.4));

      if (tab === 'prestige') refreshPrestige(pg);
      if (tab === 'ach' && (achDirty || force)) refreshAch();
      if (tab === 'album' && (albumDirty || force)) refreshAlbum();
      if (tab === 'stats') refreshRecords();
    }

    function refreshPrestige(pg) {
      const s = game.state, P = D.prestige;
      const unlocked = game.prestigeUnlocked();
      R.pLocked.hidden = unlocked;
      R.pOpen.hidden = !unlocked;
      if (!unlocked) R.pLockBar.style.width = Math.min(100, Math.log10(s.allTime + 1) / Math.log10(P.unlockAt) * 100) + '%';
      const b = game.coreBonus();
      R.coreEach.textContent = pct(b);
      R.pgain.textContent = fmt(pg);
      R.cores.textContent = fmt(s.cores);
      R.coresFree.textContent = fmt(game.coresFree());
      R.coreMultBig.textContent = xmult(game.coreMult());
      R.pNextBar.style.width = (game.diplomaProgress() * 100) + '%';
      const more = '다음 졸업장까지 지식 ' + fmt(Math.max(0, game.nextDiplomaAt() - s.allTime));
      R.pnext.innerHTML = pg > 0
        ? '지금 졸업하면 전체 생산 <b>' + xmult((1 + (s.cores + pg) * b) / (1 + s.cores * b)) + '</b><br>' + more
        : more;
      R.pBtn.disabled = pg < 1;
      R.pBtn.textContent = pg >= 1 ? '졸업하기 (졸업장 +' + fmt(pg) + ')' : '졸업하기';

      D.research.forEach(function (r) {
        const t = resTiles[r.id], done = !r.repeat && game.has(r.id), avail = game.researchAvailable(r), cost = game.researchCost(r);
        t.classList.toggle('done', done);
        t.classList.toggle('lock', !done && !avail);
        t.classList.toggle('off', !done && avail && game.coresFree() < cost);
        t.lastChild.textContent = done ? '완료' : (r.repeat && game.lvl(r.id) ? 'Lv.' + game.lvl(r.id) + ' · ' : '') + '📜 ' + fmt(cost);
      });

      const open = game.challengeUnlocked(), act = s.challenge.active;
      R.chalNote.textContent = open
        ? '규칙이 걸린 학기에서 목표를 달성하면 영구 보상과 스티커 ' + D.challengeStickers + '장을 받습니다. 시작하면 지금 학기는 졸업 처리됩니다.'
        : '🔒 졸업을 ' + D.challengeUnlock + '번 하면 열립니다.';
      R.chalCount.textContent = Object.keys(s.challenge.done).length + ' / ' + D.challenges.length;
      D.challenges.forEach(function (c) {
        const card = chalCards[c.id], done = !!s.challenge.done[c.id];
        card.goal.textContent = fmt(c.goal) + (c.timeLimit ? ' (' + fmtTime(c.timeLimit) + ' 안에)' : '');
        card.el.classList.toggle('done', done);
        card.el.classList.toggle('active', act === c.id);
        card.el.classList.toggle('lock', !open);
        card.btn.textContent = done ? '통과 ✓' : act === c.id ? '포기' : '도전';
        card.btn.disabled = done || !open || !!(act && act !== c.id);
      });
    }

    function refreshAch() {
      const s = game.state;
      achDirty = false;
      D.achievements.forEach(function (a) {
        const got = !!s.achievements[a.id], t = achTiles[a.id];
        if (got !== t.classList.contains('got')) {
          t.classList.toggle('got', got);
          if (a.hidden) t.firstChild.textContent = got ? a.icon : '❓';
        }
      });
      R.achCount.textContent = game.achCount();
      R.achBonus.textContent = pct(game.achMult() - 1);
    }

    function refreshAlbum() {
      const s = game.state;
      albumDirty = false;
      const have = {}, total = {};
      D.stickers.forEach(function (t) {
        const n = s.album[t.id] || 0, slot = albumSlots[t.id];
        slot.classList.toggle('got', n > 0);
        slot.lastChild.textContent = n > 1 ? '×' + n : '';
        total[t.rarity] = (total[t.rarity] || 0) + 1;
        if (n) have[t.rarity] = (have[t.rarity] || 0) + 1;
      });
      Object.keys(D.rarities).forEach(function (rid) {
        const rar = D.rarities[rid], h = have[rid] || 0;
        albumHeads[rid].textContent = h + '/' + total[rid] + ' · 1종당 ' + pct(rar.pct) + ' · 다 모으면 ' + pct(rar.setBonus) + (h === total[rid] ? ' ✓' : '');
      });
      R.albumCount.textContent = game.albumCount();
      R.albumBonus.textContent = pct(game.albumBonus());
    }

    function refreshRecords() {
      const s = game.state;
      const rows = [
        ['학년', game.grade().name],
        ['전체 누적 지식', fmt(s.allTime)], ['이번 학기 누적', fmt(s.runTotal)],
        ['초당 생산 (기본)', fmt(game.baseLps())], ['최고 초당 생산', fmt(s.stats.bestLps)],
        ['교과서 클릭', s.clicks.toLocaleString('ko-KR') + '번'], ['아하!', s.crits.toLocaleString('ko-KR') + '번'], ['가장 큰 한 번', fmt(s.stats.bestClick)],
        ['칭찬 스티커', s.bonusClicks + '장' + (s.bonusAuto ? ' (+반장 ' + s.bonusAuto + '장)' : '')],
        ['졸업', s.prestiges + '회' + (s.stats.fastestGrad ? ' · 가장 빠른 졸업 ' + fmtTime(s.stats.fastestGrad) : '')],
        ['받은 졸업장', fmt(s.cores) + '장'],
        ['발전 계획', Object.keys(s.research).length + ' / ' + D.research.length],
        ['도전 학기', Object.keys(s.challenge.done).length + ' / ' + D.challenges.length],
        ['숙제', Math.min(s.homework.index, D.homework.length) + ' / ' + D.homework.length],
        ['출석', '총 ' + s.attend.total + '일 · 연속 ' + s.attend.streak + '일'],
        ['오프라인 보상', Math.round(game.offlineRate() * 100) + '% · 최대 ' + fmtTime(game.offlineCap())],
        ['업적', game.achCount() + ' / ' + D.achievements.length], ['스티커 앨범', game.albumCount() + ' / ' + D.stickers.length],
        ['이번 학기 시간', fmtTime(s.runSec)], ['총 플레이 시간', fmtTime(s.stats.playSec)],
      ];
      R.stats.innerHTML = rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');

      // 성적표: 과목별 정답률
      const open = game.quizSubjects().map(function (x) { return x.id; });
      const grade = function (rate) { return rate >= 0.9 ? '수' : rate >= 0.8 ? '우' : rate >= 0.7 ? '미' : rate >= 0.6 ? '양' : '가'; };
      R.report.innerHTML = '<tr><th>과목</th><th>정답</th><th>정답률</th><th>성적</th></tr>' + D.quiz.subjects.map(function (sb) {
        if (open.indexOf(sb.id) < 0) return '<tr class="lock"><td>' + sb.icon + ' ' + sb.name + '</td><td colspan="3">🔒 ' + D.grades[sb.grade].name + '부터</td></tr>';
        const rec = s.quiz.subj[sb.id] || [0, 0];
        const rate = rec[1] ? rec[0] / rec[1] : 0;
        return '<tr><td>' + sb.icon + ' ' + sb.name + '</td><td>' + rec[0] + ' / ' + rec[1] + '</td><td>' + (rec[1] ? Math.round(rate * 100) + '%' : '-') + '</td><td><b>' + (rec[1] ? grade(rate) : '-') + '</b></td></tr>';
      }).join('') + '<tr class="sum"><td>합계</td><td>' + s.quiz.correct + ' / ' + s.quiz.asked + '</td><td>' + (s.quiz.asked ? Math.round(s.quiz.correct / s.quiz.asked * 100) + '%' : '-') + '</td><td>🔥 최고 ' + s.quiz.best + '연속</td></tr>';
    }

    // 매 프레임: 숫자와 게이지
    let buffKey = '', shownLight = game.state.light;
    function refreshStats() {
      const s = game.state;
      // 숫자가 툭툭 끊기지 않고 부드럽게 올라가게 (쓸 때는 바로 내려감)
      shownLight = s.light < shownLight || !isFinite(shownLight) ? s.light : shownLight + (s.light - shownLight) * 0.25;
      if (s.light - shownLight < 0.01) shownLight = s.light;
      R.light.textContent = fmt(shownLight);
      R.lps.textContent = fmt(game.income());
      R.click.textContent = fmt(game.clickPower());

      const cm = game.comboMult();
      R.comboBar.style.width = s.combo + '%';
      R.comboText.textContent = s.combo >= 99.5 ? '🔥 몰입! x' + cm.toFixed(1) : '집중력 x' + cm.toFixed(1);
      R.comboBar.parentNode.classList.toggle('full', s.combo >= 99.5);
      orb.classList.toggle('hot', s.combo >= 99.5);

      const key = s.buffs.map(function (b) { return b.id; }).join(',');
      if (key !== buffKey) {
        buffKey = key;
        R.buffs.innerHTML = s.buffs.map(function (b) {
          return `<div class="idd-buff" data-b="${b.id}" data-tip="buff:${b.id}"><span>${b.name} ${b.kind === 'cost' ? '-' + Math.round((1 - b.mult) * 100) + '%' : '×' + b.mult}</span><span class="idd-buff-t"></span><i></i></div>`;
        }).join('');
        root.classList.toggle('idd-storm', s.buffs.some(function (b) { return b.kind === 'prod'; }));
      }
      s.buffs.forEach(function (b) {
        const d = R.buffs.querySelector('[data-b="' + b.id + '"]');
        if (!d) return;
        d.querySelector('.idd-buff-t').textContent = Math.ceil(b.left) + '초';
        d.querySelector('i').style.width = (b.left / b.total * 100) + '%';
      });
    }

    // 0.2초마다: 시계, 카드, 시간표, 도전 현황, 학년
    let gradeIdx = game.grade().index, subjectCount = game.quizSubjects().length, lastDay = '', periodIdx = -1;
    function todayStr() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function stampsHtml(streak) {
      const filled = streak ? ((streak - 1) % 7) + 1 : 0;
      let h = '';
      for (let i = 0; i < 7; i++) h += '<i class="' + (i < filled ? 'on' : '') + '">' + (i < filled ? '✔' : i + 1) + '</i>';
      return h;
    }

    function refreshSlow() {
      const s = game.state;
      // 벽시계
      const d = new Date();
      const sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      R.clockS.setAttribute('transform', 'rotate(' + sec * 6 + ' 20 20)');
      R.clockM.setAttribute('transform', 'rotate(' + min * 6 + ' 20 20)');
      R.clockH.setAttribute('transform', 'rotate(' + hr * 30 + ' 20 20)');
      if (d.getHours() < 4 && !s.flags.nightowl) game.setFlag('nightowl');

      // 날짜가 바뀌면 출석 체크
      const day = todayStr();
      if (day !== lastDay) {
        const first = lastDay === '';
        lastDay = day;
        const att = game.attendance(day);
        if (att && !first) showAttendance(att);
        else if (att) pendingAttendance = att;
      }

      // 쪽지 시험 카드
      const quiet = s.challenge.active === 'quiet';
      const wait = game.quizReadyIn();
      R.quizCard.classList.toggle('ready', !quiet && wait <= 0);
      R.quizInfo.textContent = quiet ? '조용한 학기에는 쉬어요' : wait <= 0 ? '지금 풀 수 있어요!' : '다음 시험까지 ' + fmtTime(wait / 1000);

      // 숙제 카드
      const h = game.homeworkCurrent();
      R.hwCard.classList.toggle('ready', !h.finished && h.done);
      R.hwCard.classList.toggle('finished', h.finished);
      if (h.finished) {
        R.hwCount.textContent = h.total + '/' + h.total;
        R.hwText.textContent = '숙제를 모두 끝냈어요! 🎉';
        R.hwBar.style.width = '100%';
        R.hwReward.textContent = '';
      } else {
        R.hwCount.textContent = (h.index + 1) + '/' + h.total;
        R.hwText.textContent = h.task.text;
        R.hwBar.style.width = (h.target ? h.cur / h.target * 100 : 0) + '%';
        R.hwReward.textContent = (h.target > 1 ? fmt(h.cur) + ' / ' + fmt(h.target) + ' · ' : '') + '🎁 ' + (h.stickers ? '스티커 ' + h.stickers + '장' : '지식 ' + fmt(h.amount));
      }
      R.hwBtn.disabled = h.finished || !h.done;

      // 시간표
      const p = game.period();
      R.periodName.textContent = p.def.icon + ' ' + p.def.name;
      R.periodLeft.textContent = mmss(p.left);
      R.periodBar.style.width = (100 - p.left / D.timetable.periodSec * 100) + '%';
      if (p.index !== periodIdx) {
        if (periodIdx >= 0) restartAnim(R.period, 'ding');
        periodIdx = p.index;
        R.period.classList.toggle('lunch', !!p.def.click);
      }

      // 도전 학기 현황
      const ch = game.activeChallenge();
      R.chalBanner.hidden = !ch;
      if (ch) {
        const prog = Math.min(1, s.runTotal > 0 ? Math.log10(s.runTotal + 1) / Math.log10(ch.goal) : 0);
        R.chalBanner.innerHTML = `<div class="idd-chal-top"><b>${ch.icon} ${ch.name}</b><button type="button" class="idd-mini" data-chal="${ch.id}">포기</button></div>
          <small>${ch.rule}</small>
          <div class="idd-meter"><i style="width:${prog * 100}%"></i></div>
          <small>이번 학기 ${fmt(s.runTotal)} / ${fmt(ch.goal)}${ch.timeLimit ? ' · ⏰ ' + mmss(ch.timeLimit - s.runSec) : ''}</small>`;
      }

      // 학년
      const gr = game.grade();
      R.grade.textContent = gr.name;
      if (gr.index > gradeIdx) {
        sound.play('grad');
        toast('🎒 <b>' + gr.name + '</b>' + josa(gr.name, '으로', '로') + ' 진급했어요!', 'gold');
        restartAnim(R.grade, 'up');
        const subs = game.quizSubjects();
        if (subs.length > subjectCount) toast('📝 쪽지 시험에 새 과목: ' + subs[subs.length - 1].icon + ' <b>' + subs[subs.length - 1].name + '</b>');
        subjectCount = subs.length;
      }
      gradeIdx = gr.index;

      // 출석 도장 (이번 주 7칸)
      const key = s.attend.streak + '/' + s.attend.total;
      if (R.stamps.dataset.key !== key) { R.stamps.dataset.key = key; R.stamps.innerHTML = stampsHtml(s.attend.streak); }

      R.hint.hidden = s.clicks >= 3;

      // 엔진에서 일어난 일
      game.drainEvents().forEach(function (ev) {
        const c = chalById[ev.id];
        if (ev.type === 'challengeDone') {
          sound.play('grad'); confetti();
          albumDirty = true;
          showModal('<div class="idd-modal-icon">🏅</div><b>도전 통과!</b> ' + c.icon + ' ' + c.name + '<br>영구 보상: <b>' + c.reward + '</b><br><small>규칙이 사라졌어요. 이번 학기는 그대로 이어집니다.</small>' + dropsHtml(ev.drops));
          redrawAll();
        } else if (ev.type === 'challengeFail') {
          sound.play('wrong');
          showModal('<div class="idd-modal-icon">⏰</div><b>' + c.name + '</b> 시간 초과!<br><small>이번 학기는 그대로 이어집니다. 더 강해져서 다시 도전해 보세요.</small>');
          redrawAll();
        }
      });
    }

    let pendingAttendance = null;
    function attendanceHtml(att) {
      return '<div class="idd-modal-icon">📅</div><b>출석 체크!</b> 연속 ' + att.streak + '일째<div class="idd-stamps big">' + stampsHtml(att.streak) + '</div>지식 <b>+' + fmt(att.reward) + '</b>' +
        (att.drops.length ? ' · 스티커 ' + att.drops.length + '장' + dropsHtml(att.drops) : '');
    }
    function showAttendance(att) {
      albumDirty = true;
      sound.play('sticker');
      showModal(attendanceHtml(att));
    }

    // ---------- 교내 방송 ----------
    let newsLast = -1;
    function nextNews() {
      const s = game.state;
      const ok = [];
      D.news.forEach(function (n, i) { if (i !== newsLast && (!n.cond || n.cond(s, game))) ok.push(i); });
      if (!ok.length) return;
      newsLast = ok[Math.floor(Math.random() * ok.length)];
      R.newsText.textContent = D.news[newsLast].text;
      restartAnim(R.newsText, 'in');
    }

    // ---------- 칠판 배경: 분필 가루와 희미한 낙서 ----------
    const sky = root.querySelector('.idd-sky');
    const ctx = sky.getContext('2d');
    const DOODLES = ['E = mc²', 'a² + b² = c²', 'πr²', '∫ x dx', '3 × 7 = 21', 'H₂O', 'sin²θ + cos²θ = 1', 'ㄱㄴㄷ', 'ABC', '√2', '1 + 1 = 2', 'F = ma', '♪', '☆', '가나다'];
    let dust = [], doodles = [];
    function resizeSky() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = root.clientWidth, h = root.clientHeight;
      sky.width = w * dpr; sky.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dust = [];
      for (let i = 0; i < Math.round(w * h / 9000); i++) dust.push({ x: Math.random() * w, y: Math.random() * h, r: rand(.4, 1.3), vy: rand(-.08, -.02), vx: rand(-.03, .03), a: rand(.08, .3) });
      doodles = [];
      for (let i = 0; i < Math.max(8, Math.round(w * h / 60000)); i++) {
        doodles.push({ t: DOODLES[i % DOODLES.length], x: Math.random() * w, y: Math.random() * h, rot: rand(-.25, .25), size: rand(16, 30), a: rand(.04, .08), vx: rand(-.05, .05) });
      }
      drawSky(true);
      computeRoomCap();
    }
    function drawSky(still) {
      const w = root.clientWidth, h = root.clientHeight;
      const move = !still && fxOn();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      for (const d of doodles) {
        if (move) { d.x += d.vx; if (d.x < -100) d.x = w + 100; if (d.x > w + 100) d.x = -100; }
        ctx.save();
        ctx.globalAlpha = d.a;
        ctx.translate(d.x, d.y); ctx.rotate(d.rot);
        ctx.font = d.size + 'px "Gaegu", "Comic Sans MS", cursive';
        ctx.fillText(d.t, 0, 0);
        ctx.restore();
      }
      for (const p of dust) {
        if (move) { p.x += p.vx; p.y += p.vy; if (p.y < -2) { p.y = h + 2; p.x = Math.random() * w; } }
        ctx.globalAlpha = p.a;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (window.ResizeObserver) new ResizeObserver(resizeSky).observe(root);
    else window.addEventListener('resize', resizeSky);

    // ============================================================ 루프
    // requestAnimationFrame은 백그라운드 탭에서 멈추지만, 돌아왔을 때 지난 시간(dt)을 그대로 반영하므로 손실이 없다.
    let last = performance.now(), slowAcc = 0, saveAcc = 0, skyAcc = 0, workAcc = 0, newsAcc = 100;
    function frame(now) {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      game.tick(dt);
      refreshStats();
      slowAcc += dt; saveAcc += dt; skyAcc += dt; workAcc += dt; newsAcc += dt;
      if (slowAcc > 0.2) {
        slowAcc = 0;
        const got = game.checkAchievements();
        if (got.length) {
          sound.play('ach');
          achDirty = true;
          R.dotAch.hidden = tab === 'ach';
          toast(got.length === 1 ? '🏆 업적 달성 · <b>' + got[0].name + '</b>' : '🏆 업적 <b>' + got.length + '개</b> 달성 · ' + got[0].name + ' 외', 'gold');
        }
        refreshShop(false);
        renderCampus();
        refreshSlow();
      }
      if (workAcc > 0.35) { workAcc = 0; workParticles(); }
      if (skyAcc > 1 / 30) { skyAcc = 0; if (fxOn()) drawSky(); }
      if (newsAcc > 13) { newsAcc = 0; nextNews(); }
      if (saveAcc > D.AUTOSAVE_SEC) { saveAcc = 0; game.save(); }
      // 칭찬 스티커: 창이 떠 있는 동안은 기다린다. 백그라운드에서 돌아왔을 때 한꺼번에 나오지 않게 1초씩만 센다
      if (!modalCur) praiseTimer -= Math.min(dt, 1);
      if (praiseTimer <= 0) { spawnPraise(); praiseTimer = rand(praiseCfg.delay[0], praiseCfg.delay[1]); }
      requestAnimationFrame(frame);
    }

    // ---------- 시작 ----------
    syncSettingsUI();
    resizeSky();
    refreshShop(true);
    renderCampus();
    refreshSlow();          // 여기서 오늘 출석도 처리된다
    requestAnimationFrame(frame);

    window.addEventListener('beforeunload', game.save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) game.save(); });

    // 접속 인사: 처음이면 환영, 돌아왔으면 오프라인 보상, 그리고 오늘의 출석
    (function () {
      const parts = [];
      const s = game.state;
      if (!offline && s.clicks === 0 && s.prestiges === 0 && s.runSec < 5) {
        parts.push('<div class="idd-modal-icon">🏫</div><b>아이들 스쿨에 오신 걸 환영해요!</b><br>교과서를 눌러 지식을 모으고,<br>교실을 하나씩 열어 학교를 키워 보세요.<br><small>왼쪽의 📚 숙제가 다음에 할 일을 알려 줍니다.</small>');
      }
      if (offline && offline.earned > 0) {
        parts.push('<div class="idd-modal-icon">🌙</div>자리를 비운 ' + fmtTime(offline.seconds) + ' 동안<br>지식이 <b>' + fmt(offline.earned) + '</b> 쌓였어요.<br><small>(오프라인 효율 ' + Math.round(offline.rate * 100) + '%' +
          (offline.capped ? ' · 최대 ' + fmtTime(game.offlineCap()) + '까지만 쌓여요' : '') + ')</small>');
      }
      if (pendingAttendance) { parts.push(attendanceHtml(pendingAttendance)); albumDirty = true; pendingAttendance = null; }
      if (parts.length) showModal(parts.join('<hr class="idd-hr">'), [{ label: parts.length > 1 || offline ? '좋아요!' : '시작하기', primary: true }]);
    })();

    game.spawnPraise = spawnPraise;   // 디버깅용: 콘솔에서 game.spawnPraise()
    game.spawnRain = spawnRain;
    return game;
  };
})();
