/* 화면 렌더링. Idddle.mount(rootElement, { saveKey }) 로 아무 페이지에나 붙일 수 있다. */
window.Idddle = window.Idddle || {};

(function () {
  const UNITS = [[1e44, '재'], [1e40, '정'], [1e36, '간'], [1e32, '구'], [1e28, '양'], [1e24, '자'], [1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  const EN_UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const ROOM_CAP = 40;        // 교실마다 화면에 그리는 일꾼 최대 수 (그 이상은 숫자로만)
  const ROOM_CYCLE = 3;       // 교실 진행 막대 한 바퀴(초) — 다 차면 그동안 번 지식을 띄운다
  let notation = 'ko';        // 'ko' | 'en' | 'sci'

  function short(x) { return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2); }

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n >= 1e48 || (notation === 'sci' && n >= 1e4)) return n.toExponential(2).replace('e+', 'e');
    if (notation === 'en' && n >= 1e3) {
      const i = Math.min(EN_UNITS.length, Math.floor(Math.log10(n) / 3));
      return short(n / Math.pow(1000, i)) + EN_UNITS[i - 1];
    }
    for (const [v, u] of UNITS) {
      if (n >= v) return short(n / v) + u;
    }
    if (n < 10 && n % 1 !== 0) return n.toFixed(1);
    return Math.floor(n).toLocaleString('ko-KR');
  }

  function fmtTime(sec) {
    sec = Math.floor(sec);
    if (sec >= 86400 * 999) return '아주 오래';
    if (sec >= 86400) return Math.floor(sec / 86400) + '일 ' + Math.floor((sec % 86400) / 3600) + '시간';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + '시간' + (m ? ' ' + m + '분' : '');
    if (m) return m + '분 ' + s + '초';
    return s + '초';
  }

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
      buy: function () { tone(523, 0, 0.08, 'square', 0.03); tone(784, 0.06, 0.1, 'square', 0.03); },
      bonus: function () { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, i * 0.06, 0.18, 'triangle', 0.06); }); },
      ach: function () { tone(1047, 0, 0.25, 'sine', 0.07); tone(1568, 0.08, 0.35, 'sine', 0.05); },
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
    const genById = {};
    D.generators.forEach(function (g) { genById[g.id] = g; });

    root.classList.add('idd');
    root.innerHTML = `
      <canvas class="idd-sky" aria-hidden="true"></canvas>
      <div class="idd-bonus-layer" data-r="bonusLayer"></div>
      <header class="idd-top">
        <div class="idd-logo">✏️ 아이들 스쿨</div>
        <div class="idd-mults">
          <span data-tip="mult-core">📜 <b data-r="coreMult">x1.0</b></span>
          <span data-tip="mult-ach">🏆 <b data-r="achMult">x1.0</b></span>
        </div>
      </header>
      <main class="idd-main">
        <section class="idd-left">
          <div class="idd-amount"><span data-r="light">0</span></div>
          <div class="idd-amount-label">지식</div>
          <div class="idd-rate">초당 <b data-r="lps">0</b></div>
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
          </button>
          <div class="idd-clickpow">클릭당 <b data-r="click">1</b></div>
          <div class="idd-desk" data-r="desk" hidden></div>
          <div class="idd-buffs" data-r="buffs"></div>
        </section>

        <section class="idd-campus">
          <div class="idd-campus-title idd-row"><span>🏫 우리 학교</span><small data-r="campusSum"></small></div>
          <div class="idd-rooms" data-r="rooms"></div>
          <div class="idd-campus-empty" data-r="campusEmpty">상점에서 <b>연필</b>을 사면<br>여기서 일하는 모습을 볼 수 있어요 ✏️</div>
        </section>

        <section class="idd-panel">
          <nav class="idd-tabs">
            <button type="button" data-tab="shop" class="on">상점<i class="idd-dot" data-r="dotShop" hidden></i></button>
            <button type="button" data-tab="ach">업적 <small data-r="achCount">0</small></button>
            <button type="button" data-tab="prestige">졸업<i class="idd-dot" data-r="dotPrestige" hidden></i></button>
            <button type="button" data-tab="stats">기록·설정</button>
          </nav>
          <div class="idd-tabbody">
            <div data-pane="shop">
              <div class="idd-sec-title">업그레이드</div>
              <div class="idd-upgrades" data-r="upgrades"></div>
              <div class="idd-sec-title idd-row">
                <span>생산기</span>
                <span class="idd-seg" data-r="amtSeg">
                  <button type="button" data-amt="1" class="on">1</button><button type="button" data-amt="10">10</button><button type="button" data-amt="100">100</button><button type="button" data-amt="max">MAX</button>
                </span>
              </div>
              <div class="idd-gens" data-r="gens"></div>
            </div>

            <div data-pane="ach" hidden>
              <p class="idd-note">업적 1개당 전체 생산 <b>+${D.ACH_BONUS * 100}%</b>. 졸업해도 유지됩니다.</p>
              <div class="idd-achs" data-r="achs"></div>
            </div>

            <div data-pane="prestige" hidden>
              <div class="idd-prestige">
                <div class="idd-nova">🎓</div>
                <h3>졸업하기</h3>
                <p>지식·생산기·업그레이드를 모두 초기화하고 <b>졸업장</b>을 받습니다.<br>졸업장 1장당 전체 생산 <b>+${D.CORE_BONUS * 100}%</b> (영구).</p>
                <div class="idd-prestige-stats">
                  <div><small>받은 졸업장 (보너스 <span data-r="coreMultBig">x1</span>)</small><b data-r="cores">0</b></div>
                  <div><small>지금 졸업하면</small><b>+<span data-r="pgain">0</span></b></div>
                </div>
                <p class="idd-note" data-r="pnext"></p>
                <button class="idd-btn idd-btn-prestige" type="button" data-act="prestige">졸업하기</button>
              </div>
              <div class="idd-sec-title idd-row idd-research-head"><span>학교 발전 계획</span><span>남은 졸업장 <b data-r="coresFree">0</b></span></div>
              <p class="idd-note">졸업장을 써서 영구 강화를 얻습니다. 써도 졸업장 생산 보너스는 줄지 않습니다.</p>
              <div class="idd-research" data-r="research"></div>
            </div>

            <div data-pane="stats" hidden>
              <div class="idd-sec-title">기록</div>
              <dl class="idd-stats" data-r="stats"></dl>
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
              <div class="idd-sec-title">저장</div>
              <div class="idd-btn-grid">
                <button class="idd-btn idd-btn-ghost" type="button" data-act="save">지금 저장</button>
                <button class="idd-btn idd-btn-ghost" type="button" data-act="export">내보내기</button>
                <button class="idd-btn idd-btn-ghost" type="button" data-act="import">가져오기</button>
                <button class="idd-btn idd-btn-ghost idd-btn-danger" type="button" data-act="reset">전체 초기화</button>
              </div>
              <p class="idd-note">10초마다 브라우저에 자동 저장됩니다. 다른 기기로 옮길 땐 내보내기 코드를 복사해 가져오기에 붙여넣으세요.</p>
            </div>
          </div>
        </section>
      </main>
      <div class="idd-tip" data-r="tip" hidden></div>
      <div class="idd-toasts" data-r="toasts"></div>
      <div class="idd-modal" data-r="modal" hidden><div class="idd-modal-box"><div data-r="modalText"></div><div class="idd-modal-btns" data-r="modalBtns"></div></div></div>
    `;

    const R = {};
    root.querySelectorAll('[data-r]').forEach(function (e) { R[e.dataset.r] = e; });
    const orb = root.querySelector('.idd-orb');

    // ---------- 상점: 생산기 행 ----------
    const genRows = {};
    D.generators.forEach(function (g) {
      const row = el('button', 'idd-gen');
      row.type = 'button';
      row.dataset.gen = g.id;
      row.dataset.tip = 'gen:' + g.id;
      row.innerHTML = `
        <span class="idd-gen-icon">${g.icon}</span>
        <span class="idd-gen-info">
          <span class="idd-gen-name">${g.name}</span>
          <span class="idd-gen-cost">📘 <span data-g="cost"></span> <span class="idd-gen-eta" data-g="eta"></span></span>
        </span>
        <span class="idd-gen-owned" data-g="owned">0</span>`;
      const refs = { row: row };
      row.querySelectorAll('[data-g]').forEach(function (e) { refs[e.dataset.g] = e; });
      genRows[g.id] = refs;
      R.gens.appendChild(row);
    });

    // ---------- 업적 타일 ----------
    const achTiles = {};
    D.achievements.forEach(function (a) {
      const t = el('div', 'idd-ach', '<span>' + a.icon + '</span>');
      t.dataset.tip = 'ach:' + a.id;
      achTiles[a.id] = t;
      R.achs.appendChild(t);
    });

    // ---------- 학교 발전 계획 타일 ----------
    const resTiles = {};
    game.research.forEach(function (r) {
      const t = el('button', 'idd-res');
      t.type = 'button';
      t.dataset.id = r.id;
      t.dataset.tip = 'res:' + r.id;
      t.innerHTML = `<span class="idd-res-icon">${r.icon}</span><span class="idd-res-name">${r.name}</span><span class="idd-res-cost">📜 ${r.cost}</span>`;
      resTiles[r.id] = t;
      R.research.appendChild(t);
    });
    R.research.addEventListener('click', function (ev) {
      const t = ev.target.closest('.idd-res');
      if (t && game.buyResearch(t.dataset.id)) {
        sound.play('ach');
        toast('📜 발전 계획 완료 · <b>' + game.research.find(function (x) { return x.id === t.dataset.id; }).name + '</b>', 'gold');
        bonusCfg = game.bonusConfig();
        refreshShop(true);
        if (tipTarget === t) showTip(t);
      }
    });

    // ---------- 툴팁 ----------
    const upgById = {};
    game.upgrades.forEach(function (u) { upgById[u.id] = u; });
    const achById = {};
    D.achievements.forEach(function (a) { achById[a.id] = a; });

    function tipHtml(key) {
      const s = game.state;
      const [kind, id] = key.split(':');
      if (kind === 'upg') {
        const u = upgById[id];
        const foot = s.upgrades[id]
          ? '<div class="idd-tip-dim">구매 완료</div>'
          : `<div class="idd-tip-cost ${s.light >= game.upgradeCost(u) ? '' : 'no'}">📘 ${fmt(game.upgradeCost(u))}</div>`;
        return `<b class="idd-tip-title">${u.icon} ${u.name}</b><div>${u.desc}</div>${foot}`;
      }
      if (kind === 'gen') {
        const g = genById[id];
        const r = game.genRate(g);
        return `<b class="idd-tip-title">${g.icon} ${g.name}</b><div class="idd-tip-dim">${g.desc}</div>
          <div>1${g.unit}당 <b>${fmt(r)}</b>/초 · ${s.gens[id]}${g.unit} 합계 <b>${fmt(r * s.gens[id])}</b>/초</div>
          ${s.gens[id] ? '<div class="idd-tip-dim">전체 생산의 ' + (r * s.gens[id] / Math.max(1e-9, game.baseLps()) * 100).toFixed(1) + '%</div>' : ''}`;
      }
      if (kind === 'ach') {
        const a = achById[id], got = s.achievements[id];
        return got
          ? `<b class="idd-tip-title">${a.icon} ${a.name}</b><div>${a.desc()}</div><div class="idd-tip-dim">달성 완료</div>`
          : `<b class="idd-tip-title">🔒 ???</b><div>${a.desc()}</div>`;
      }
      if (kind === 'res') {
        const r = game.research.find(function (x) { return x.id === id; });
        const req = r.req && !game.has(r.req) ? '<div class="idd-tip-cost no">먼저 필요: ' + game.research.find(function (x) { return x.id === r.req; }).name + '</div>' : '';
        return `<b class="idd-tip-title">${r.icon} ${r.name}</b><div>${r.desc}</div>${req}`;
      }
      if (kind === 'mult-core') return `<b class="idd-tip-title">졸업장 보너스</b><div>받은 졸업장 ${fmt(s.cores)}장 → 전체 생산 x${game.coreMult().toFixed(2)}</div>`;
      if (kind === 'mult-ach') return `<b class="idd-tip-title">업적 보너스</b><div>업적 ${game.achCount()}개 → 전체 생산 x${game.achMult().toFixed(2)}</div>`;
      return '';
    }

    let tipTarget = null;
    function showTip(target) {
      tipTarget = target;
      R.tip.innerHTML = tipHtml(target.dataset.tip);
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
      const t = ev.target.closest('[data-tip]');
      if (t && t !== tipTarget) showTip(t);
      else if (!t && tipTarget) hideTip();
    });
    root.addEventListener('mouseleave', hideTip);

    // ---------- 이펙트 ----------
    function rootXY(x, y) { const r = root.getBoundingClientRect(); return [x - r.left, y - r.top]; }

    function floatText(x, y, text, cls) {
      const f = el('span', 'idd-float' + (cls ? ' ' + cls : ''), text);
      const p = rootXY(x, y);
      f.style.left = p[0] + 'px'; f.style.top = p[1] + 'px';
      root.appendChild(f);
      setTimeout(function () { f.remove(); }, 1000);
    }

    // 분필 가루
    function sparks(x, y, n, color) {
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

    // 졸업 축하 색종이
    function confetti() {
      const colors = ['#ffe066', '#ff8fab', '#8fd3ff', '#b8f2a1', '#fff'];
      const w = root.clientWidth;
      for (let i = 0; i < 70; i++) {
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

    function toast(html, cls) {
      const t = el('div', 'idd-toast' + (cls ? ' ' + cls : ''), html);
      R.toasts.appendChild(t);
      while (R.toasts.children.length > 3) R.toasts.firstChild.remove(); // 최대 3개만
      requestAnimationFrame(function () { t.classList.add('show'); });
      setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2600);
    }

    // buttons: [{ label, primary, onClick }] — 생략하면 '확인' 하나. onClick이 false를 반환하면 닫지 않음
    function showModal(html, buttons) {
      R.modalText.innerHTML = html;
      R.modalBtns.innerHTML = '';
      (buttons || [{ label: '확인', primary: true }]).forEach(function (b) {
        const btn = el('button', 'idd-btn' + (b.primary ? '' : ' idd-btn-ghost'), b.label);
        btn.type = 'button';
        btn.addEventListener('click', function () {
          if (b.onClick && b.onClick() === false) return;
          R.modal.hidden = true;
        });
        R.modalBtns.appendChild(btn);
      });
      R.modal.hidden = false;
    }

    // ---------- 우리 학교 (교실 풍경) ----------
    // 생산기마다 교실 하나. 1개 살 때마다 일꾼이 한 명 늘고, 업그레이드를 사면 교실에 물건이 놓인다.
    const rooms = {};
    let deskReady = false;

    function buildRoom(g) {
      const room = el('div', 'idd-room');
      room.dataset.gen = g.id;
      room.dataset.anim = g.anim;
      room.innerHTML = `
        <div class="idd-room-head" data-tip="gen:${g.id}">
          <span class="idd-room-name">${g.icon} ${g.name} <b data-k="count">0</b></span>
          <span class="idd-room-rate" data-k="rate"></span>
        </div>
        <div class="idd-room-floor" data-k="floor">
          <div class="idd-room-items" data-k="items"></div>
        </div>
        <div class="idd-room-bar"><i data-k="bar"></i></div>`;
      const ref = { el: room, shown: 0, placed: {}, ready: false };
      room.querySelectorAll('[data-k]').forEach(function (e) { ref[e.dataset.k] = e; });
      ref.bar.style.animationDuration = ROOM_CYCLE + 's';
      // 진행 막대가 한 바퀴 돌 때마다 그동안 이 교실이 번 지식을 띄운다
      ref.bar.addEventListener('animationiteration', function () {
        const earned = game.genRate(g) * game.state.gens[g.id] * game.buffMult('prod') * ROOM_CYCLE;
        if (earned <= 0) return;
        const f = el('span', 'idd-room-gain', '+' + fmt(earned));
        ref.el.appendChild(f);
        setTimeout(function () { f.remove(); }, 1200);
      });
      // 교실 순서는 상점 순서대로
      const order = D.generators.findIndex(function (x) { return x.id === g.id; });
      const next = Array.prototype.find.call(R.rooms.children, function (c) {
        return D.generators.findIndex(function (x) { return x.id === c.dataset.gen; }) > order;
      });
      R.rooms.insertBefore(room, next || null);
      rooms[g.id] = ref;
      return ref;
    }

    function addWorker(ref, g, i, isNew) {
      const w = el('span', 'idd-worker' + (isNew ? ' new' : ''), g.sprites[i % g.sprites.length]);
      const col = Math.floor(i / 2), lane = i % 2;
      w.style.left = (8 + col * 26 + lane * 13 + hash(i) * 4) + 'px';
      w.style.top = (lane ? 30 : 6) + hash(i + 99) * 4 + 'px';
      w.style.animationDelay = (-hash(i + 7) * 2).toFixed(2) + 's' + (isNew ? ', 0s' : '');
      w.style.zIndex = lane + 1;
      ref.floor.insertBefore(w, ref.items);
    }

    function renderCampus(flashId) {
      const s = game.state;
      let any = false, totalUnits = 0;
      D.generators.forEach(function (g) {
        const n = s.gens[g.id];
        let ref = rooms[g.id];
        if (!n) {
          if (ref) { ref.el.remove(); delete rooms[g.id]; }
          return;
        }
        any = true; totalUnits += n;
        if (!ref) ref = buildRoom(g);

        // 일꾼: 보유 수만큼 (최대 ROOM_CAP)
        const want = Math.min(n, ROOM_CAP);
        if (want < ref.shown) {
          ref.floor.querySelectorAll('.idd-worker').forEach(function (w) { w.remove(); });
          ref.shown = 0;
        }
        const fresh = ref.ready || flashId === g.id;   // 처음 화면을 그릴 땐 등장 효과 없이
        for (let i = ref.shown; i < want; i++) addWorker(ref, g, i, fresh);
        ref.shown = want;
        ref.count.textContent = '×' + n.toLocaleString('ko-KR');

        // 업그레이드 물건: 산 것만 교실에 놓인다. 단계가 오를수록 일하는 속도도 빨라짐
        let tiers = 0;
        game.upgrades.forEach(function (u) {
          if (u.gen !== g.id) return;
          const owned = !!s.upgrades[u.id];
          if (owned) tiers++;
          if (owned && !ref.placed[u.id]) {
            const it = el('span', 'idd-item' + (ref.ready ? ' new' : ''), u.icon);
            it.dataset.tip = 'upg:' + u.id;
            ref.items.appendChild(it);
            ref.placed[u.id] = it;
          } else if (!owned && ref.placed[u.id]) {
            ref.placed[u.id].remove(); delete ref.placed[u.id];
          }
        });
        ref.el.style.setProperty('--spd', (1.6 / (1 + tiers * 0.35)).toFixed(2) + 's');
        ref.rate.textContent = fmt(game.genRate(g) * n * game.buffMult('prod')) + '/초';
        ref.ready = true;
      });
      R.campusEmpty.hidden = any;
      R.campusSum.textContent = any ? '교실 ' + Object.keys(rooms).length + '곳 · 일꾼 ' + fmt(totalUnits) : '';

      if (flashId && rooms[flashId]) {
        const e = rooms[flashId].el;
        e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash');
      }

      // 책상 위 클릭 업그레이드
      const desk = D.clickUpgrades.filter(function (c) { return s.upgrades[c.id]; });
      R.desk.hidden = !desk.length;
      const deskKey = desk.map(function (c) { return c.id; }).join(',');
      if (deskReady && R.desk.dataset.key === deskKey) return;
      const before = (R.desk.dataset.key || '').split(',');
      R.desk.dataset.key = deskKey;
      R.desk.innerHTML = '<span class="idd-desk-label">책상</span>' + desk.map(function (c) {
        const isNew = deskReady && before.indexOf(c.id) < 0;
        return `<span class="idd-desk-item${isNew ? ' new' : ''}" data-tip="upg:${c.id}">${c.icon}</span>`;
      }).join('');
      deskReady = true;
    }

    // 일꾼 머리 위로 작업 이모지가 떠오른다 (일하는 중!)
    function workParticles() {
      for (const id in rooms) {
        const ref = rooms[id], g = genById[id];
        if (!ref.shown || Math.random() > Math.min(0.9, 0.2 + ref.shown * 0.05)) continue;
        const ws = ref.floor.querySelectorAll('.idd-worker');
        const w = ws[Math.floor(Math.random() * ws.length)];
        if (!w) continue;
        const p = el('span', 'idd-work', g.work);
        p.style.left = (parseFloat(w.style.left) + 6) + 'px';
        p.style.top = (parseFloat(w.style.top) - 4) + 'px';
        ref.floor.appendChild(p);
        setTimeout(function () { p.remove(); }, 1100);
      }
    }

    // ---------- 입력 ----------
    orb.addEventListener('click', function (ev) {
      const p = game.click();
      let x = ev.clientX, y = ev.clientY;
      if (!x && !y) { const r = orb.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      floatText(x, y, '+' + fmt(p));
      sparks(x, y, 5);
      sound.play('click');
      orb.classList.remove('pop'); void orb.offsetWidth; orb.classList.add('pop');
    });

    R.gens.addEventListener('click', function (ev) {
      const row = ev.target.closest('.idd-gen');
      if (row && game.buyGen(row.dataset.gen, buyAmount)) {
        sound.play('buy');
        refreshShop(true);
        renderCampus(row.dataset.gen);
        if (tipTarget === row) showTip(row);
      }
    });

    R.upgrades.addEventListener('click', function (ev) {
      const card = ev.target.closest('.idd-upg');
      if (card && game.buyUpgrade(card.dataset.id)) {
        const u = upgById[card.dataset.id];
        hideTip();
        sound.play('buy');
        toast(u.icon + ' <b>' + u.name + '</b> 구매! ' + (u.kind === 'gen' ? genById[u.gen].name + ' 교실에 놓였어요' : '책상에 놓였어요'));
        refreshShop(true);
        renderCampus(u.gen);
      }
    });

    R.amtSeg.addEventListener('click', function (ev) {
      const b = ev.target.closest('button');
      if (!b) return;
      buyAmount = b.dataset.amt === 'max' ? 'max' : Number(b.dataset.amt);
      R.amtSeg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      refreshShop(true);
    });

    function syncSettingsUI() {
      const st = game.state.settings;
      R.notation.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.notation === st.notation); });
      R.soundSeg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', (b.dataset.sound === '1') === st.sound); });
    }
    R.notation.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-notation]');
      if (!b) return;
      game.state.settings.notation = notation = b.dataset.notation;
      syncSettingsUI(); upgKey = ''; refreshShop(true); renderCampus();
    });
    R.soundSeg.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-sound]');
      if (!b) return;
      game.state.settings.sound = sound.enabled = b.dataset.sound === '1';
      syncSettingsUI();
      sound.play('buy');
    });

    root.querySelector('.idd-tabs').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      root.querySelectorAll('.idd-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      root.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== tab; });
      hideTip();
      refreshShop(true);
    });

    function afterStateReplaced() {
      upgKey = ''; bonusCfg = game.bonusConfig();
      for (const id in rooms) { rooms[id].el.remove(); delete rooms[id]; }
      deskReady = false;
      refreshShop(true); renderCampus();
    }

    root.addEventListener('click', function (ev) {
      const a = ev.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'save') { game.save(); toast('💾 저장했습니다'); }
      if (act === 'reset') {
        showModal('<div class="idd-modal-icon">⚠️</div>정말 <b>모든 진행</b>을 지울까요?<br><small>졸업장·업적·발전 계획까지 전부 사라집니다.</small>', [
          { label: '취소' },
          { label: '전체 초기화', primary: true, onClick: function () { game.hardReset(); afterStateReplaced(); toast('초기화했습니다'); } },
        ]);
      }
      if (act === 'export') {
        const code = game.exportSave();
        showModal('<div class="idd-modal-icon">📤</div>아래 코드를 복사해 보관하세요.<textarea class="idd-code" readonly>' + code + '</textarea>', [
          { label: '닫기' },
          { label: '복사', primary: true, onClick: function () {
            const ta = R.modalText.querySelector('textarea');
            ta.select();
            (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).catch(function () { document.execCommand('copy'); });
            toast('📋 복사했습니다');
          } },
        ]);
      }
      if (act === 'import') {
        showModal('<div class="idd-modal-icon">📥</div>내보내기 코드를 붙여넣으세요.<br><small>현재 진행은 덮어써집니다.</small><textarea class="idd-code" placeholder="코드 붙여넣기"></textarea>', [
          { label: '취소' },
          { label: '가져오기', primary: true, onClick: function () {
            const ok = game.importSave(R.modalText.querySelector('textarea').value);
            if (!ok) { toast('⚠️ 올바르지 않은 코드입니다'); return false; }
            notation = game.state.settings.notation; sound.enabled = game.state.settings.sound;
            syncSettingsUI(); afterStateReplaced();
            toast('📥 불러왔습니다');
          } },
        ]);
      }
      if (act === 'prestige') {
        const g = game.prestigeGain();
        if (g < 1) return;
        showModal('<div class="idd-modal-icon">🎓</div>졸업하고 졸업장 <b>' + fmt(g) + '</b>장을 받을까요?<br><small>지식·생산기·업그레이드가 초기화됩니다.<br>업적·발전 계획·졸업장은 유지됩니다.</small>', [
          { label: '취소' },
          { label: '졸업!', primary: true, onClick: function () {
            game.prestige(); afterStateReplaced();
            sound.play('grad');
            confetti();
            toast('🎓 졸업 축하해요! 졸업장 <b>+' + fmt(g) + '</b>', 'gold');
          } },
        ]);
      }
    });

    // ---------- 칭찬 스티커 (보너스) ----------
    let bonusCfg = game.bonusConfig();
    let bonusTimer = rand(bonusCfg.firstDelay[0], bonusCfg.firstDelay[1]);

    function spawnBonus() {
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
      b.style.left = rand(40, Math.max(60, w - 110)) + 'px';
      b.style.top = rand(60, Math.max(80, Math.min(h, 700) - 130)) + 'px';
      b.style.animationDuration = bonusCfg.life + 's, 1.6s, 3s';
      b.addEventListener('click', function (ev) {
        const r = game.claimBonus();
        const e = r.effect;
        let x = ev.clientX, y = ev.clientY;
        if (!x && !y) { const br = b.getBoundingClientRect(); x = br.left + 32; y = br.top + 32; }
        sparks(x, y, 14, '#ffe066');
        sound.play('bonus');
        if (e.id === 'lucky') {
          floatText(x, y, '+' + fmt(r.amount), 'big');
          toast('🌟 <b>' + e.name + '</b> 지식 +' + fmt(r.amount), 'gold');
        } else {
          floatText(x, y, e.name + '!', 'big');
          const b0 = game.state.buffs.find(function (x2) { return x2.id === e.id; });
          toast('🌟 <b>' + e.name + '</b> ' + Math.round(b0 ? b0.total : e.sec) + '초간 ' + (e.kind === 'prod' ? '생산' : '클릭') + ' x' + e.mult, 'gold');
        }
        b.remove();
      });
      R.bonusLayer.appendChild(b);
      setTimeout(function () { b.remove(); }, bonusCfg.life * 1000);
    }

    // ---------- 렌더: 상점/업적/졸업/기록 ----------
    let upgKey = '';
    function refreshShop(force) {
      const s = game.state;

      const visible = game.upgrades.filter(game.upgradeVisible).sort(function (a, b) { return a.cost - b.cost; });
      const key = visible.map(function (u) { return u.id; }).join(',');
      if (force || key !== upgKey) {
        upgKey = key;
        R.upgrades.innerHTML = visible.length ? '' : '<div class="idd-empty">조건을 만족하면 업그레이드가 나타납니다.</div>';
        visible.forEach(function (u) {
          const c = el('button', 'idd-upg');
          c.type = 'button';
          c.dataset.id = u.id;
          c.dataset.tip = 'upg:' + u.id;
          const badge = u.kind === 'gen'
            ? '<span class="idd-upg-tier">' + genById[u.gen].icon + ROMAN[u.tier] + '</span>'
            : '<span class="idd-upg-tier">✍️</span>';
          c.innerHTML = `<span class="idd-upg-icon">${u.icon}</span>${badge}`;
          R.upgrades.appendChild(c);
        });
      }
      R.upgrades.querySelectorAll('.idd-upg').forEach(function (c) {
        c.classList.toggle('off', s.light < game.upgradeCost(upgById[c.dataset.id]));
      });
      R.dotShop.hidden = tab === 'shop' || !visible.some(function (u) { return s.light >= game.upgradeCost(u); });

      // 생산기: 보유 중이거나 바로 다음 1개까지만 공개
      let revealNext = true;
      const rate = game.lps();
      D.generators.forEach(function (g, gi) {
        const r = genRows[g.id];
        const owned = s.gens[g.id];
        const known = gi === 0 || owned > 0 || s.allTime >= g.baseCost * 0.5;
        if (!known && !revealNext) { r.row.hidden = true; return; }
        r.row.hidden = false;
        r.row.classList.toggle('locked', !known);
        if (!known) revealNext = false;

        const k = buyAmount === 'max' ? Math.max(1, game.maxAffordable(g)) : buyAmount;
        const cost = game.bulkCost(g, k);
        r.owned.textContent = owned;
        r.cost.textContent = fmt(cost) + (k > 1 ? '  ×' + k : '');
        r.row.classList.toggle('off', s.light < cost);
        r.eta.textContent = s.light < cost && rate > 0 && known ? '⏱ ' + fmtTime((cost - s.light) / rate) : '';
      });

      for (const id in achTiles) achTiles[id].classList.toggle('got', !!s.achievements[id]);
      R.achCount.textContent = game.achCount() + '/' + D.achievements.length;

      const pg = game.prestigeGain();
      R.pgain.textContent = fmt(pg);
      R.cores.textContent = fmt(s.cores);
      R.coresFree.textContent = fmt(game.coresFree());
      R.coreMultBig.textContent = 'x' + game.coreMult().toFixed(1);
      const nextAt = Math.pow(pg + 1, 2) * D.PRESTIGE_DIVISOR;
      R.pnext.innerHTML = '이번 학년 누적 ' + fmt(s.runTotal) + ' · 다음 졸업장까지 ' + fmt(Math.max(0, nextAt - s.runTotal));
      root.querySelector('.idd-btn-prestige').disabled = pg < 1;
      let canResearch = false;
      game.research.forEach(function (r) {
        const t = resTiles[r.id], done = game.has(r.id), avail = game.researchAvailable(r);
        t.classList.toggle('done', done);
        t.classList.toggle('lock', !done && !avail);
        t.classList.toggle('off', !done && avail && game.coresFree() < r.cost);
        if (avail && game.coresFree() >= r.cost) canResearch = true;
      });
      R.dotPrestige.hidden = tab === 'prestige' || !(canResearch || pg >= Math.max(1, s.cores));

      R.coreMult.textContent = 'x' + game.coreMult().toFixed(1);
      R.achMult.textContent = 'x' + game.achMult().toFixed(2);

      if (tab === 'stats') {
        const rows = [
          ['전체 누적 지식', fmt(s.allTime)], ['이번 학년 누적', fmt(s.runTotal)],
          ['초당 생산 (기본)', fmt(game.baseLps())], ['공부 클릭', s.clicks.toLocaleString('ko-KR') + '회'],
          ['칭찬 스티커', s.bonusClicks + '장'], ['졸업', s.prestiges + '회'], ['발전 계획', Object.keys(s.research).length + ' / ' + game.research.length],
          ['오프라인 보상', Math.round(game.offlineRate() * 100) + '% · 최대 ' + fmtTime(game.offlineCap())],
          ['업적', game.achCount() + ' / ' + D.achievements.length], ['이번 학년 플레이', fmtTime((Date.now() - s.startedAt) / 1000)],
        ];
        R.stats.innerHTML = rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');
      }
    }

    let buffKey = '';
    function refreshStats() {
      const s = game.state;
      R.light.textContent = fmt(s.light);
      R.lps.textContent = fmt(game.lps());
      R.click.textContent = fmt(game.clickPower());

      const key = s.buffs.map(function (b) { return b.id; }).join(',');
      if (key !== buffKey) {
        buffKey = key;
        R.buffs.innerHTML = s.buffs.map(function (b) {
          return `<div class="idd-buff" data-b="${b.id}"><span>${b.name} ×${b.mult}</span><span class="idd-buff-t"></span><i></i></div>`;
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

    // ---------- 칠판 배경: 분필 가루와 희미한 낙서 ----------
    const sky = root.querySelector('.idd-sky');
    const ctx = sky.getContext('2d');
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    }
    function drawSky() {
      const w = root.clientWidth, h = root.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      for (const d of doodles) {
        if (!reduceMotion) { d.x += d.vx; if (d.x < -100) d.x = w + 100; if (d.x > w + 100) d.x = -100; }
        ctx.save();
        ctx.globalAlpha = d.a;
        ctx.translate(d.x, d.y); ctx.rotate(d.rot);
        ctx.font = d.size + 'px "Gaegu", "Comic Sans MS", cursive';
        ctx.fillText(d.t, 0, 0);
        ctx.restore();
      }
      for (const p of dust) {
        if (!reduceMotion) { p.x += p.vx; p.y += p.vy; if (p.y < -2) { p.y = h + 2; p.x = Math.random() * w; } }
        ctx.globalAlpha = p.a;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    resizeSky();
    if (window.ResizeObserver) new ResizeObserver(resizeSky).observe(root);
    else window.addEventListener('resize', resizeSky);

    // ---------- 루프 ----------
    // requestAnimationFrame은 백그라운드 탭에서 멈추지만, 경과 시간(dt)을 그대로 반영하므로 손실 없음.
    let last = performance.now(), shopAcc = 0, saveAcc = 0, skyAcc = 0, workAcc = 0;
    function frame(now) {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      game.tick(dt);
      refreshStats();
      shopAcc += dt; saveAcc += dt; skyAcc += dt; workAcc += dt;
      if (shopAcc > 0.2) {
        shopAcc = 0;
        const got = game.checkAchievements();
        if (got.length) sound.play('ach');
        if (got.length === 1) toast('🏆 업적 달성 · <b>' + got[0].name + '</b>', 'gold');
        else if (got.length > 1) toast('🏆 업적 <b>' + got.length + '개</b> 달성 · ' + got[0].name + ' 외', 'gold');
        refreshShop(false);
        renderCampus();
      }
      if (workAcc > 0.35) { workAcc = 0; workParticles(); }
      if (skyAcc > 1 / 30) { skyAcc = 0; drawSky(); }
      if (saveAcc > D.AUTOSAVE_SEC) { saveAcc = 0; game.save(); }
      bonusTimer -= Math.min(dt, 1); // 백그라운드 복귀 시 한꺼번에 튀어나오지 않게
      if (bonusTimer <= 0) { spawnBonus(); bonusTimer = rand(bonusCfg.delay[0], bonusCfg.delay[1]); }
      requestAnimationFrame(frame);
    }
    syncSettingsUI();
    refreshShop(true);
    renderCampus();
    requestAnimationFrame(frame);

    window.addEventListener('beforeunload', game.save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) game.save(); });

    if (offline && offline.earned > 0) {
      showModal('<div class="idd-modal-icon">🌙</div>자리를 비운 ' + fmtTime(offline.seconds) + ' 동안<br>지식 <b>' + fmt(offline.earned) + '</b>을 쌓았습니다.<br><small>(오프라인 효율 ' + Math.round(offline.rate * 100) + '%)</small>');
    }

    game.spawnBonus = spawnBonus; // 디버깅용
    return game;
  };
})();
