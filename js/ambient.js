/* ═══ Ambient layer ═══
   1. THE CURSOR IS A LIGHT — the visitor carries a warm glow through the
      night sections. Meaning: you are the light in someone's distance.
      Off on touch, off under reduced motion, off in Chapter 04's daylight.
   2. THE SOS EGG — type S-O-S anywhere and the page performs one complete
      response: a single red beat (the emergency), the network warming toward
      it, the log writing, and a calm resolve. Red appears only for that beat.
   3. Small ambient instruments: the distance ticker (06) and the signal
      strength meter that dies at the Chapter 03 freeze. */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(hover: none)').matches || !window.matchMedia('(pointer: fine)').matches;
  const body = document.body;

  /* ══════════ 1 · THE CURSOR IS A LIGHT ══════════ */
  const light = document.getElementById('cursorLight');
  if (light && !reduced && !touch) {
    let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    let cx = tx, cy = ty;
    let raf = null, idle = 0;

    /* one element, one transform, one loop — nothing per-element */
    function frame() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      light.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      const settled = Math.abs(tx - cx) < 0.3 && Math.abs(ty - cy) < 0.3;
      if (settled && ++idle > 30) { raf = null; return; }
      if (!settled) idle = 0;
      raf = requestAnimationFrame(frame);
    }
    function wake() {
      idle = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    }

    window.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      tx = ev.clientX; ty = ev.clientY;
      if (!body.classList.contains('cursor-lit')) body.classList.add('cursor-lit');
      wake();
    }, { passive: true });

    window.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('mouseleave', function () { body.classList.remove('cursor-lit'); });
    document.addEventListener('mouseenter', function () { body.classList.add('cursor-lit'); });

    /* light means nothing in daylight: Chapter 04 puts it out */
    const ch4 = document.getElementById('ch4');
    if (ch4 && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          body.classList.toggle('in-daylight', e.isIntersecting);
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      io.observe(ch4);
    }
  }

  /* ══════════ 3 · SIGNAL STRENGTH · the meter that dies ══════════ */
  const meterV = document.getElementById('meterV');
  if (meterV && 'MutationObserver' in window) {
    const mo = new MutationObserver(function () {
      meterV.textContent = body.classList.contains('frozen') ? 'lost' : 'strong';
    });
    mo.observe(body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ══════════ 3 · DISTANCE TICKER · closing is the message ══════════ */
  const tickerV = document.getElementById('tickerV');
  if (tickerV) {
    if (reduced) {
      tickerV.textContent = '80m';
    } else {
      let d = 420, timer = null;
      function step() {
        d -= 12 + Math.round(Math.random() * 10);
        if (d <= 80) d = 420;
        tickerV.textContent = d + 'm';
      }
      function run(on) {
        if (on && !timer) timer = setInterval(step, 420);
        if (!on && timer) { clearInterval(timer); timer = null; }
      }
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { run(e.isIntersecting); });
        });
        io.observe(tickerV);
      } else {
        run(true);
      }
      document.addEventListener('visibilitychange', function () { run(!document.hidden); });
    }
  }

  /* ══════════ 2 · HIDDEN SOS · one complete response ══════════ */
  const beat = document.getElementById('sosBeat');
  const toast = document.getElementById('sosToast');
  const live = document.getElementById('sosLive');
  const logBox = document.getElementById('logLines');
  const presenceK = document.querySelector('.ops-presence .ops-pop-k');
  const presence = document.querySelector('.ops-presence');
  let running = false;
  let px = 0, py = 0, tracked = false;

  window.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'touch') return;
    px = ev.clientX; py = ev.clientY; tracked = true;
  }, { passive: true });

  function say(msg) {
    if (live) live.textContent = msg;
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.hidden = true; }, 600);
    }, 3600);
  }

  function writeLog(text, ok) {
    if (!logBox) return;
    const s = document.createElement('span');
    s.className = 'new';
    s.textContent = text + (ok ? ' ' : '');
    if (ok) {
      const em = document.createElement('em');
      em.className = 'ok';
      em.style.fontStyle = 'normal';
      em.textContent = '✓';
      s.appendChild(em);
    }
    logBox.appendChild(s);
    while (logBox.children.length > 5) logBox.removeChild(logBox.firstChild);
  }

  function respond() {
    if (running) return;
    running = true;

    if (reduced) {
      say('Signal received. Responders moving. Resolved.');
      showToast('resolved · this is what inevitable feels like');
      setTimeout(function () { running = false; }, 4200);
      return;
    }

    /* the single emergency beat — the only red outside Chapter 03 */
    if (beat) {
      const x = tracked ? px : window.innerWidth / 2;
      const y = tracked ? py : window.innerHeight / 2;
      beat.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      beat.classList.remove('fire');
      void beat.offsetWidth;
      beat.classList.add('fire');
    }

    /* then the whole night leans toward it */
    body.classList.add('sos-live');
    say('Signal received. Responders moving.');
    writeLog('03:47  signal received', true);
    setTimeout(function () { writeLog('03:47  responders moving', false); }, 900);
    setTimeout(function () { writeLog('03:48  presence held', true); }, 1900);

    if (presenceK) {
      presenceK.textContent = '4 guardians linked ';
      const b = document.createElement('b');
      b.className = 'ok';
      b.textContent = '✓';
      presenceK.appendChild(b);
    }
    if (presence) presence.setAttribute('aria-label', 'Presence: 4 guardians linked');

    setTimeout(function () {
      body.classList.remove('sos-live');
      if (beat) beat.classList.remove('fire');
      showToast('resolved · this is what inevitable feels like');
      say('Resolved. This is what inevitable feels like.');
      running = false;
    }, 4000);
  }

  /* the keyboard listener: never inside a field where someone is typing */
  let buf = '';
  let fired = false;
  document.addEventListener('keydown', function (ev) {
    const t = ev.target;
    if (t) {
      const tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (!/^[a-zA-Z]$/.test(ev.key)) { buf = ''; return; }
    buf = (buf + ev.key.toLowerCase()).slice(-3);
    if (buf === 'sos') {
      buf = '';
      /* once per session — unless someone deliberately types it again */
      if (fired && running) return;
      fired = true;
      respond();
    }
  });
})();
