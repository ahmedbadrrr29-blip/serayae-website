/* ═══ Easter eggs ═══
   founding-signal.txt — the belief, typed slowly.
   first-response.rec — one complete response, replayed. No screenshots. */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFocus = null;

  function open(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    const close = modal.querySelector('[data-close].close') || modal.querySelector('[data-close]');
    if (close && close.focus) close.focus();
  }

  function close(modal) {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('.modal').forEach(function (modal) {
    modal.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { close(modal); });
    });
    modal.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') close(modal);
    });
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    document.querySelectorAll('.modal').forEach(function (m) { if (!m.hidden) close(m); });
  });

  /* ══════════ founding-signal.txt ══════════ */
  const FOUNDING = [
    'For thousands of years, one thing meant safety.',
    '',
    'A light in the distance.',
    '',
    'Not because of the light.',
    'Because of what it meant.',
    '',
    'Someone was there.',
    '',
    'The roads changed. The promise didn’t.',
    '',
    'The internet solved communication.',
    'It never solved response.',
    '',
    'SERAYAE exists to make human response inevitable.'
  ].join('\n');

  const foundingModal = document.getElementById('modalFounding');
  const foundingType = document.getElementById('foundingType');
  const foundingBtn = document.getElementById('foundingBtn');
  let typeRaf = null;

  function typeOut() {
    if (!foundingType) return;
    if (typeRaf) cancelAnimationFrame(typeRaf);
    if (reduced) {
      foundingType.textContent = FOUNDING;
      return;
    }
    foundingType.textContent = '';
    const cur = document.createElement('span');
    cur.className = 'cur';
    const text = document.createTextNode('');
    foundingType.appendChild(text);
    foundingType.appendChild(cur);

    let i = 0, acc = 0, last = 0;
    function step(ts) {
      const dt = Math.min(64, ts - (last || ts));
      last = ts;
      acc += dt;
      const per = 17;
      while (acc >= per && i < FOUNDING.length) {
        acc -= per;
        i++;
        // hold a beat at line ends
        if (FOUNDING[i - 1] === '\n') acc -= 90;
      }
      text.nodeValue = FOUNDING.slice(0, i);
      if (i < FOUNDING.length) typeRaf = requestAnimationFrame(step);
    }
    typeRaf = requestAnimationFrame(step);
  }

  if (foundingBtn && foundingModal) {
    foundingBtn.addEventListener('click', function () {
      open(foundingModal);
      typeOut();
    });
    foundingModal.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { if (typeRaf) cancelAnimationFrame(typeRaf); });
    });
  }

  /* ══════════ first-response.rec ══════════ */
  const respModal = document.getElementById('modalResponse');
  const respBtn = document.getElementById('responseBtn');
  const recLog = document.getElementById('recLog');
  const recResult = document.getElementById('recResult');
  const recClock = document.getElementById('recClock');
  const recRoute = document.getElementById('recRoute');
  const recPulse = document.getElementById('recPulse');
  const recResponder = document.getElementById('recResponder');
  const recReplay = document.getElementById('recReplay');
  const recNodes = respModal ? Array.prototype.slice.call(respModal.querySelectorAll('.rec-node')) : [];

  const REC = [
    { at: 0, t: '00:00', txt: 'signal opened', ok: true },
    { at: 900, t: '00:04', txt: '3 guardians notified', ok: true },
    { at: 1800, t: '00:12', txt: 'sarah is watching', ok: false },
    { at: 2700, t: '00:38', txt: 'responder accepted · 420m', ok: true },
    { at: 4200, t: '02:05', txt: 'moving · 210m', ok: false },
    { at: 5400, t: '03:31', txt: 'moving · 80m', ok: false },
    { at: 6300, t: '04:12', txt: 'arrival logged', ok: true }
  ];
  const REC_END = 7000;

  let routeLen = 0;
  if (recRoute && recRoute.getTotalLength) {
    try { routeLen = recRoute.getTotalLength(); } catch (e) { routeLen = 0; }
  }

  function recLine(rec) {
    const li = document.createElement('li');
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = rec.t;
    const s = document.createElement('span');
    s.textContent = rec.txt + (rec.ok ? ' ' : '');
    if (rec.ok) {
      const ok = document.createElement('span');
      ok.className = 'ok';
      ok.textContent = '✓';
      s.appendChild(ok);
    }
    li.appendChild(t);
    li.appendChild(s);
    recLog.appendChild(li);
  }

  function setResponder(p) {
    if (!routeLen || !recResponder) return;
    const pos = recRoute.getPointAtLength(routeLen * p);
    recResponder.setAttribute('cx', pos.x);
    recResponder.setAttribute('cy', pos.y);
  }

  let recRaf = null;
  function recFinal() {
    recLog.textContent = '';
    REC.forEach(recLine);
    recNodes.forEach(function (n) { n.classList.add('warm'); });
    if (recRoute) recRoute.classList.add('on');
    setResponder(1);
    if (recClock) recClock.textContent = '04:12';
    if (recResult) recResult.textContent = 'resolved · 4m 12s · verified ✓';
    if (recPulse) recPulse.setAttribute('opacity', '0');
  }

  function playRec() {
    if (recRaf) cancelAnimationFrame(recRaf);
    if (reduced) { recFinal(); return; }

    recLog.textContent = '';
    recNodes.forEach(function (n) { n.classList.remove('warm'); });
    if (recRoute) recRoute.classList.remove('on');
    if (recResult) recResult.textContent = '';
    setResponder(0);

    let t = 0, last = 0, shown = 0;
    function step(ts) {
      const dt = Math.min(64, ts - (last || ts));
      last = ts;
      t += dt;

      while (shown < REC.length && t >= REC[shown].at) {
        recLine(REC[shown]);
        if (shown === 1) recNodes.forEach(function (n) { n.classList.add('warm'); });
        if (shown === 3 && recRoute) recRoute.classList.add('on');
        shown++;
      }

      // the call ripples out of the caller for the first stretch
      if (recPulse) {
        if (t < 2600) {
          const p = (t % 1300) / 1300;
          recPulse.setAttribute('r', String(6 + p * 70));
          recPulse.setAttribute('opacity', String(0.5 * (1 - p)));
        } else {
          recPulse.setAttribute('opacity', '0');
        }
      }

      // the responder moves; distance closing is the message
      if (t > 2700) {
        setResponder(Math.min(1, (t - 2700) / 3600));
      }

      if (recClock) {
        const secs = Math.min(252, Math.round((t / REC_END) * 252));
        recClock.textContent = ('0' + Math.floor(secs / 60)).slice(-2) + ':' + ('0' + (secs % 60)).slice(-2);
      }

      if (t >= REC_END) {
        if (recResult) recResult.textContent = 'resolved · 4m 12s · verified ✓';
        return;
      }
      recRaf = requestAnimationFrame(step);
    }
    recRaf = requestAnimationFrame(step);
  }

  if (respBtn && respModal) {
    respBtn.addEventListener('click', function () {
      open(respModal);
      playRec();
    });
    respModal.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { if (recRaf) cancelAnimationFrame(recRaf); });
    });
  }
  if (recReplay) recReplay.addEventListener('click', playRec);
})();
