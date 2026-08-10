/* ═══ Hero signal field ═══
   Draggable console windows, field notes and artifacts — each one a live
   signal, not a decoration. One shared animation loop; paused off-screen. */

(function () {
  const field = document.getElementById('field');
  if (!field) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 860px)');

  const items = Array.prototype.slice.call(field.querySelectorAll('.draggable'));

  /* ── hand-placed layout ── */
  function place() {
    const compact = mobile.matches;
    items.forEach(function (el) {
      const rot = el.dataset.rot || '0';
      if (compact) {
        el.style.left = '';
        el.style.top = '';
        el.style.transform = 'rotate(' + (parseFloat(rot) * 0.5) + 'deg)';
        return;
      }
      if (!el.dataset.dragged) {
        el.style.left = el.dataset.x + '%';
        el.style.top = el.dataset.y + '%';
      }
      el.style.transform = 'rotate(' + rot + 'deg)';
    });
  }
  place();
  let pt = null;
  window.addEventListener('resize', function () {
    clearTimeout(pt);
    pt = setTimeout(place, 180);
  });

  /* ── real pointer drag (no native HTML5 DnD) ── */
  let z = 8;
  items.forEach(function (el) {
    let dragging = false, moved = false, id = null;
    let sx = 0, sy = 0, ox = 0, oy = 0;

    el.addEventListener('pointerdown', function (ev) {
      if (reduced || mobile.matches) return;
      if (ev.button !== undefined && ev.button !== 0) return;
      dragging = true; moved = false; id = ev.pointerId;
      sx = ev.clientX; sy = ev.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      el.classList.add('dragging');
      el.style.zIndex = ++z;
      el.style.left = ox + 'px';
      el.style.top = oy + 'px';
      el.dataset.dragged = '1';
      try { el.setPointerCapture(id); } catch (e) { /* ignore */ }
    });

    el.addEventListener('pointermove', function (ev) {
      if (!dragging || ev.pointerId !== id) return;
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      const maxX = field.clientWidth - el.offsetWidth;
      const maxY = field.clientHeight - el.offsetHeight;
      el.style.left = Math.max(-20, Math.min(maxX + 20, ox + dx)) + 'px';
      el.style.top = Math.max(0, Math.min(maxY, oy + dy)) + 'px';
      ev.preventDefault();
    });

    function end(ev) {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(id); } catch (e) { /* ignore */ }
      if (moved) {
        // a real drag should not also fire the artifact's click
        el.dataset.suppressClick = '1';
        setTimeout(function () { delete el.dataset.suppressClick; }, 60);
      }
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', function (ev) {
      if (el.dataset.suppressClick) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
    el.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  });

  /* ══════════ live signals ══════════ */

  /* responder.trace — distance closing is the message */
  const tracePath = document.getElementById('tracePath');
  const traceDot = document.getElementById('traceDot');
  const traceDist = document.getElementById('traceDist');
  let traceLen = 0, traceT = 0;
  if (tracePath && tracePath.getTotalLength) {
    try { traceLen = tracePath.getTotalLength(); } catch (e) { traceLen = 0; }
  }
  function traceUpdate(dt) {
    if (!traceLen) return;
    traceT += dt / 7000;
    if (traceT > 1.18) traceT = 0;
    const p = Math.min(1, traceT);
    const pos = tracePath.getPointAtLength(traceLen * p);
    traceDot.setAttribute('cx', pos.x);
    traceDot.setAttribute('cy', pos.y);
    const d = Math.round(420 - (420 - 80) * p);
    traceDist.textContent = d + 'm';
  }
  function traceStatic() {
    if (!traceLen) return;
    const pos = tracePath.getPointAtLength(traceLen * 0.55);
    traceDot.setAttribute('cx', pos.x);
    traceDot.setAttribute('cy', pos.y);
    traceDist.textContent = '240m';
  }

  /* guardian-link.log — the people who never stopped watching */
  const logBox = document.getElementById('logLines');
  const LOG = [
    ['03:12', 'guardian notified', true],
    ['03:12', 'sarah is watching', false],
    ['03:13', 'responder confirmed', true],
    ['03:13', 'omar en route', false],
    ['03:14', 'link verified', true],
    ['03:14', 'presence held', false]
  ];
  let logI = 0, logT = 0;
  function logLine(rec, fresh) {
    const s = document.createElement('span');
    s.className = fresh ? 'new' : '';
    s.textContent = rec[0] + '  ' + rec[1] + (rec[2] ? ' ' : '');
    if (rec[2]) {
      const ok = document.createElement('em');
      ok.className = 'ok';
      ok.textContent = '✓';
      ok.style.fontStyle = 'normal';
      s.appendChild(ok);
    }
    logBox.appendChild(s);
    while (logBox.children.length > 5) logBox.removeChild(logBox.firstChild);
  }
  function logUpdate(dt) {
    if (!logBox) return;
    logT += dt;
    if (logT < 1500) return;
    logT = 0;
    logLine(LOG[logI % LOG.length], true);
    logI++;
  }
  function logStatic() {
    if (!logBox) return;
    logBox.textContent = '';
    for (let i = 0; i < 4; i++) logLine(LOG[i], false);
  }

  /* ledger.rec — append-only; every promise auditable */
  const ledgerBody = document.querySelector('#ledgerRows tbody');
  const LEDGER = [
    ['03:12:04', 'signal opened'],
    ['03:12:09', 'guardians reached'],
    ['03:12:41', 'responder accepted'],
    ['03:14:02', 'distance 80m'],
    ['03:16:16', 'arrival logged']
  ];
  let ledI = 0, ledT = 0;
  function ledgerRow(rec) {
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.textContent = rec[0];
    const b = document.createElement('td'); b.textContent = rec[1];
    const c = document.createElement('td'); c.textContent = 'verified ✓';
    tr.appendChild(a); tr.appendChild(b); tr.appendChild(c);
    ledgerBody.appendChild(tr);
    while (ledgerBody.children.length > 4) ledgerBody.removeChild(ledgerBody.firstChild);
  }
  function ledgerUpdate(dt) {
    if (!ledgerBody) return;
    ledT += dt;
    if (ledT < 1900) return;
    ledT = 0;
    ledgerRow(LEDGER[ledI % LEDGER.length]);
    ledI++;
  }
  function ledgerStatic() {
    if (!ledgerBody) return;
    ledgerBody.textContent = '';
    for (let i = 0; i < 3; i++) ledgerRow(LEDGER[i]);
  }

  /* lantern.glow — morse-blinks S E R A Y A E, slowly */
  const glowDot = document.getElementById('glowDot');
  const glowMorse = document.getElementById('glowMorse');
  const MORSE = { S: '···', E: '·', R: '·−·', A: '·−', Y: '−·−−' };
  const WORD = 'SERAYAE';
  const seq = [];
  WORD.split('').forEach(function (ch, li) {
    const code = MORSE[ch];
    code.split('').forEach(function (sym) {
      seq.push({ on: true, ms: sym === '·' ? 260 : 760, letter: ch, li: li });
      seq.push({ on: false, ms: 260, letter: ch, li: li });
    });
    seq.push({ on: false, ms: 700, letter: ch, li: li });
  });
  seq.push({ on: false, ms: 1600, letter: '', li: -1 });
  let seqI = 0, seqT = 0;
  function glowUpdate(dt) {
    if (!glowDot) return;
    seqT += dt;
    const cur = seq[seqI % seq.length];
    glowDot.classList.toggle('on', !!cur.on);
    if (glowMorse && cur.letter) glowMorse.textContent = MORSE[cur.letter] || '';
    if (seqT >= cur.ms) { seqT = 0; seqI++; }
  }

  /* heartbeat.mon — a calm ECG that never flatlines */
  const ecg = document.getElementById('ecg');
  let ectx = null, ew = 0, eh = 0, edpr = 1, ex = 0, ephase = 0;
  const trace = [];
  function ecgSize() {
    if (!ecg) return;
    const r = ecg.getBoundingClientRect();
    if (!r.width) return;
    edpr = Math.min(window.devicePixelRatio || 1, 2);
    ew = r.width; eh = r.height;
    ecg.width = Math.round(ew * edpr);
    ecg.height = Math.round(eh * edpr);
    ectx = ecg.getContext('2d');
    ectx.setTransform(edpr, 0, 0, edpr, 0, 0);
  }
  function beatValue(t) {
    // t in 0..1 across one cardiac cycle
    if (t < 0.12) return Math.sin(t / 0.12 * Math.PI) * 0.16;      // P
    if (t < 0.18) return -0.1;                                      // Q
    if (t < 0.23) return 1;                                         // R
    if (t < 0.29) return -0.34;                                     // S
    if (t < 0.5) return Math.sin((t - 0.29) / 0.21 * Math.PI) * 0.3; // T
    return 0;
  }
  function ecgUpdate(dt) {
    if (!ecg) return;
    if (!ectx || !ew) { ecgSize(); if (!ectx) return; }
    const speed = 0.052; // px per ms
    const cycle = 960;   // ms — about 62 bpm
    const stepPx = speed * dt;
    ephase += dt;
    if (ephase > cycle) ephase -= cycle;
    ex += stepPx;
    trace.push({ x: ex, v: beatValue(ephase / cycle) });
    while (trace.length && trace[0].x < ex - ew) trace.shift();

    ectx.clearRect(0, 0, ew, eh);
    ectx.strokeStyle = 'rgba(189,49,3,0.85)';
    ectx.lineWidth = 1.2;
    ectx.lineJoin = 'round';
    ectx.beginPath();
    const mid = eh * 0.6;
    for (let i = 0; i < trace.length; i++) {
      const p = trace[i];
      const px = ew - (ex - p.x);
      const py = mid - p.v * (eh * 0.42);
      if (i === 0) ectx.moveTo(px, py); else ectx.lineTo(px, py);
    }
    ectx.stroke();
  }
  function ecgStatic() {
    if (!ecg) return;
    ecgSize();
    if (!ectx) return;
    ectx.clearRect(0, 0, ew, eh);
    ectx.strokeStyle = 'rgba(189,49,3,0.7)';
    ectx.lineWidth = 1.2;
    ectx.beginPath();
    const mid = eh * 0.6;
    for (let px = 0; px <= ew; px++) {
      const t = ((px / 52) % 1);
      const py = mid - beatValue(t) * (eh * 0.42);
      if (px === 0) ectx.moveTo(px, py); else ectx.lineTo(px, py);
    }
    ectx.stroke();
  }

  /* ── shared loop, gated by visibility ── */
  let running = false, raf = null, last = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(64, ts - (last || ts));
    last = ts;
    traceUpdate(dt);
    logUpdate(dt);
    ledgerUpdate(dt);
    glowUpdate(dt);
    ecgUpdate(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function staticFrame() {
    traceStatic();
    logStatic();
    ledgerStatic();
    if (glowDot) glowDot.classList.add('on');
    ecgStatic();
  }

  if (reduced) {
    staticFrame();
  } else {
    logStatic();
    ledgerStatic();
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }, { rootMargin: '120px' });
      io.observe(field);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    window.addEventListener('resize', function () {
      clearTimeout(pt);
      setTimeout(ecgSize, 200);
    });
  }

  window.SERAYAE_FIELD = { start: start, stop: stop };
})();
