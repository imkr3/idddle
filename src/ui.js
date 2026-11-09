/* 화면 렌더링. Idddle.mount(rootElement, { saveKey }) 로 아무 페이지에나 붙일 수 있다. */
window.Idddle = window.Idddle || {};

(function () {
  const UNITS = [[1e44, '재'], [1e40, '정'], [1e36, '간'], [1e32, '구'], [1e28, '양'], [1e24, '자'], [1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n >= 1e48) return n.toExponential(2);
    for (const [v, u] of UNITS) {
      if (n >= v) {
        const x = n / v;
        return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + u;
      }
    }
    if (n < 10 && n % 1 !== 0) return n.toFixed(1);
    return Math.floor(n).toLocaleString('ko-KR');
  }

  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + '시간 ' + m + '분';
    if (m) return m + '분 ' + s + '초';
    return s + '초';
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  Idddle.fmt = fmt;

  Idddle.mount = function (root, opts) {
    opts = opts || {};
    const D = Idddle.DATA;
    const game = Idddle.createEngine(opts.saveKey || 'idddle-save-v1');
    const offline = game.load();
    let buyAmount = 1;

    root.classList.add('idd');
    root.innerHTML = `
      <header class="idd-header">
        <div class="idd-title">✦ 별가루 수집가</div>
        <div class="idd-amount"><span data-r="light">0</span><small>별가루</small></div>
        <div class="idd-rate">초당 <b data-r="lps">0</b></div>
      </header>
      <main class="idd-main">
        <section class="idd-left">
          <button class="idd-orb" type="button" aria-label="별 클릭">
            <span class="idd-orb-core">★</span>
          </button>
          <div class="idd-clickpow">클릭당 <b data-r="click">1</b></div>
          <div class="idd-panel idd-prestige">
            <div class="idd-panel-title">🌟 초신성 (환생)</div>
            <p>모든 진행을 초기화하고 <b>성핵</b>을 얻습니다. 성핵 1개당 전체 생산 +${D.CORE_BONUS * 100}%.</p>
            <p>보유 성핵: <b data-r="cores">0</b> (x<span data-r="gmult">1</span>)</p>
            <button class="idd-btn idd-btn-prestige" type="button" data-act="prestige">
              초신성 폭발 (+<span data-r="pgain">0</span>)
            </button>
          </div>
        </section>
        <section class="idd-right">
          <div class="idd-panel">
            <div class="idd-panel-title">업그레이드</div>
            <div class="idd-upgrades" data-r="upgrades"></div>
          </div>
          <div class="idd-panel">
            <div class="idd-panel-title idd-row">
              <span>생산기</span>
              <span class="idd-buyamt">
                <button type="button" data-amt="1" class="on">x1</button>
                <button type="button" data-amt="10">x10</button>
                <button type="button" data-amt="100">x100</button>
                <button type="button" data-amt="max">MAX</button>
              </span>
            </div>
            <div class="idd-gens" data-r="gens"></div>
          </div>
        </section>
      </main>
      <footer class="idd-footer">
        <span>누적 <b data-r="alltime">0</b> · 클릭 <b data-r="clicks">0</b>회</span>
        <span>
          <button class="idd-btn idd-btn-sm" type="button" data-act="save">저장</button>
          <button class="idd-btn idd-btn-sm idd-btn-danger" type="button" data-act="reset">초기화</button>
        </span>
      </footer>
      <div class="idd-toast" data-r="toast"></div>
      <div class="idd-modal" data-r="modal" hidden><div class="idd-modal-box"><div data-r="modalText"></div><button class="idd-btn" type="button" data-act="closeModal">확인</button></div></div>
    `;

    const R = {};
    root.querySelectorAll('[data-r]').forEach(function (e) { R[e.dataset.r] = e; });
    const orb = root.querySelector('.idd-orb');

    // ---------- 생산기 행 ----------
    const genRows = {};
    D.generators.forEach(function (g) {
      const row = el('button', 'idd-gen');
      row.type = 'button';
      row.dataset.gen = g.id;
      row.innerHTML = `
        <span class="idd-gen-icon">${g.icon}</span>
        <span class="idd-gen-info">
          <span class="idd-gen-name">${g.name}</span>
          <span class="idd-gen-desc">${g.desc}</span>
          <span class="idd-gen-meta">개당 <b data-g="rate"></b>/초 · 총 <b data-g="total"></b>/초</span>
        </span>
        <span class="idd-gen-right">
          <span class="idd-gen-owned" data-g="owned">0</span>
          <span class="idd-gen-cost">✦ <span data-g="cost"></span></span>
        </span>`;
      const refs = { row: row };
      row.querySelectorAll('[data-g]').forEach(function (e) { refs[e.dataset.g] = e; });
      genRows[g.id] = refs;
      R.gens.appendChild(row);
    });

    // ---------- 이벤트 ----------
    function floatText(x, y, text) {
      const f = el('span', 'idd-float', text);
      const rect = root.getBoundingClientRect();
      f.style.left = (x - rect.left) + 'px';
      f.style.top = (y - rect.top) + 'px';
      root.appendChild(f);
      setTimeout(function () { f.remove(); }, 900);
    }

    orb.addEventListener('click', function (ev) {
      const p = game.click();
      let x = ev.clientX, y = ev.clientY;
      if (!x && !y) { const r = orb.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      floatText(x, y, '+' + fmt(p));
      orb.classList.remove('pop'); void orb.offsetWidth; orb.classList.add('pop');
    });

    R.gens.addEventListener('click', function (ev) {
      const row = ev.target.closest('.idd-gen');
      if (row && game.buyGen(row.dataset.gen, buyAmount)) refreshShop(true);
    });

    R.upgrades.addEventListener('click', function (ev) {
      const card = ev.target.closest('.idd-upg');
      if (card && game.buyUpgrade(card.dataset.id)) { toast(card.dataset.name + ' 구매!'); refreshShop(true); }
    });

    root.querySelector('.idd-buyamt').addEventListener('click', function (ev) {
      const b = ev.target.closest('button');
      if (!b) return;
      buyAmount = b.dataset.amt === 'max' ? 'max' : Number(b.dataset.amt);
      root.querySelectorAll('.idd-buyamt button').forEach(function (x) { x.classList.toggle('on', x === b); });
      refreshShop(true);
    });

    root.addEventListener('click', function (ev) {
      const a = ev.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'save') { game.save(); toast('저장했습니다'); }
      if (act === 'reset' && confirm('정말 모든 진행(성핵 포함)을 지울까요?')) { game.hardReset(); upgKey = ''; refreshShop(true); toast('초기화했습니다'); }
      if (act === 'prestige') {
        const g = game.prestigeGain();
        if (g < 1) return;
        if (!confirm('초신성 폭발로 성핵 ' + fmt(g) + '개를 얻고 진행을 초기화할까요?')) return;
        game.prestige(); upgKey = ''; refreshShop(true);
        showModal('💥 초신성 폭발!<br>성핵 <b>' + fmt(g) + '</b>개를 얻었습니다.');
      }
      if (act === 'closeModal') R.modal.hidden = true;
    });

    let toastTimer;
    function toast(msg) {
      R.toast.textContent = msg;
      R.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { R.toast.classList.remove('show'); }, 1600);
    }
    function showModal(html) { R.modalText.innerHTML = html; R.modal.hidden = false; }

    // ---------- 렌더 ----------
    let upgKey = '';
    function refreshShop(force) {
      const s = game.state;

      // 업그레이드: 보이는 목록이 바뀔 때만 다시 그림
      const visible = game.upgrades.filter(game.upgradeVisible).sort(function (a, b) { return a.cost - b.cost; });
      const key = visible.map(function (u) { return u.id; }).join(',');
      if (force || key !== upgKey) {
        upgKey = key;
        R.upgrades.innerHTML = visible.length ? '' : '<div class="idd-empty">조건을 만족하면 업그레이드가 나타납니다.</div>';
        visible.forEach(function (u) {
          const c = el('button', 'idd-upg');
          c.type = 'button';
          c.dataset.id = u.id; c.dataset.name = u.name; c.dataset.cost = u.cost;
          c.title = u.name + '\n' + u.desc + '\n비용: ' + fmt(u.cost);
          c.innerHTML = `<span class="idd-upg-icon">${u.icon}</span><span class="idd-upg-name">${u.name}</span><span class="idd-upg-desc">${u.desc}</span><span class="idd-upg-cost">✦ ${fmt(u.cost)}</span>`;
          R.upgrades.appendChild(c);
        });
      }
      R.upgrades.querySelectorAll('.idd-upg').forEach(function (c) {
        c.classList.toggle('off', s.light < Number(c.dataset.cost));
      });

      // 생산기: 보유 중이거나 바로 다음 1개까지만 공개
      let revealNext = true;
      D.generators.forEach(function (g) {
        const r = genRows[g.id];
        const owned = s.gens[g.id];
        const known = owned > 0 || s.allTime >= g.baseCost * 0.5;
        if (!known && !revealNext) { r.row.hidden = true; return; }
        r.row.hidden = false;
        r.row.classList.toggle('locked', !known);
        if (!known) revealNext = false;

        let k = buyAmount === 'max' ? Math.max(1, game.maxAffordable(g)) : buyAmount;
        const cost = game.bulkCost(g, k);
        r.owned.textContent = owned;
        r.cost.textContent = fmt(cost) + (k > 1 ? ' (x' + k + ')' : '');
        r.rate.textContent = fmt(game.genRate(g));
        r.total.textContent = fmt(game.genRate(g) * owned);
        r.row.classList.toggle('off', s.light < cost);
      });

      const pg = game.prestigeGain();
      R.pgain.textContent = fmt(pg);
      R.cores.textContent = fmt(s.cores);
      R.gmult.textContent = game.globalMult().toFixed(1);
      root.querySelector('.idd-btn-prestige').disabled = pg < 1;
    }

    function refreshStats() {
      const s = game.state;
      R.light.textContent = fmt(s.light);
      R.lps.textContent = fmt(game.lps());
      R.click.textContent = fmt(game.clickPower());
      R.alltime.textContent = fmt(s.allTime);
      R.clicks.textContent = s.clicks.toLocaleString('ko-KR');
    }

    // ---------- 루프 ----------
    // requestAnimationFrame은 백그라운드 탭에서 멈추지만, 경과 시간(dt)을 그대로 반영하므로 손실 없음.
    let last = performance.now(), shopAcc = 0, saveAcc = 0;
    function frame(now) {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      game.tick(dt);
      refreshStats();
      shopAcc += dt; saveAcc += dt;
      if (shopAcc > 0.1) { shopAcc = 0; refreshShop(false); }
      if (saveAcc > D.AUTOSAVE_SEC) { saveAcc = 0; game.save(); }
      requestAnimationFrame(frame);
    }
    refreshShop(true);
    requestAnimationFrame(frame);

    window.addEventListener('beforeunload', game.save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) game.save(); });

    if (offline && offline.earned > 0) {
      showModal('🌙 자리를 비운 ' + fmtTime(offline.seconds) + ' 동안<br>별가루 <b>' + fmt(offline.earned) + '</b> 개를 모았습니다.<br><small>(오프라인 효율 ' + D.OFFLINE_RATE * 100 + '%)</small>');
    }

    return game; // 디버깅/외부 연동용
  };
})();
