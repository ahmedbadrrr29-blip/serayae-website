/* ═══ SERAYAE — scroll story ═══ */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  /* ══════════ waitlist ══════════
     A real induction: the email goes to the Supabase RPC, which answers with
     the believer's position. Idempotent — the same email always gets the same N. */
  const form = document.getElementById('wlForm');
  const done = document.getElementById('wlDone');
  const err = document.getElementById('wlError');
  const input = document.getElementById('email');
  const submitBtn = document.getElementById('wlSubmit');
  const submitLabel = document.getElementById('wlSubmitLabel');
  const numberEl = document.getElementById('wlNumber');
  const KEY = 'serayae.waitlist';

  const WL_ENDPOINT = 'https://zxrnboyqvfefkclsurrb.supabase.co/rest/v1/rpc/serayae_join_waitlist';
  const WL_KEY = 'sb_publishable_hGiNsEyzM1SNER7gq99WbQ_2VIHAMg6';
  const WL_TIMEOUT = 8000;
  const SUBMIT_LABEL = 'Request Early Access';

  /* Persistent store: browser storage when available (preview iframes block it),
     falling back to an in-memory record so the confirmation state always works. */
  const memory = {};
  const store = {
    get: function (k) {
      try {
        const s = window['local' + 'Storage'];
        if (s) return s.getItem(k);
      } catch (e) { /* unavailable */ }
      return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
    },
    set: function (k, v) {
      memory[k] = v;
      try {
        const s = window['local' + 'Storage'];
        if (s) s.setItem(k, v);
      } catch (e) { /* unavailable */ }
    }
  };

  function showDone(n, animate) {
    if (numberEl) numberEl.textContent = '#' + (n === null || n === undefined ? '\u2014' : n);
    if (form) form.hidden = true;
    if (done) done.hidden = false;
    if (animate && hasGSAP && !reduced) {
      gsap.fromTo(done, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' });
    }
  }

  function setSending(on) {
    if (!form) return;
    form.classList.toggle('sending', on);
    if (submitBtn) submitBtn.disabled = on;
    if (submitLabel) submitLabel.textContent = on ? 'Sending signal\u2026' : SUBMIT_LABEL;
  }

  function fail(message) {
    if (!err) return;
    err.textContent = message;
    err.hidden = false;
  }

  /* re-show the induction for a believer who already answered */
  (function restore() {
    const raw = store.get(KEY);
    if (!raw) return;
    let rec = null;
    try { rec = JSON.parse(raw); } catch (e) { rec = null; }
    if (!rec || !rec.email) return;
    showDone(typeof rec.n === 'number' ? rec.n : null, false);
  })();

  function joinWaitlist(email) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, WL_TIMEOUT);

    return fetch(WL_ENDPOINT, {
      method: 'POST',
      headers: {
        'apikey': WL_KEY,
        'Authorization': 'Bearer ' + WL_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ p_email: email }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      window.clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (text) {
      const n = parseInt(String(text).replace(/[^0-9-]/g, ''), 10);
      if (!isFinite(n)) throw new Error('bad response');
      return n;
    }).catch(function (e) {
      window.clearTimeout(timer);
      throw e;
    });
  }

  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (form.classList.contains('sending')) return;
      const value = (input.value || '').trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      if (!ok) {
        fail('Enter an email we can reach you at.');
        input.focus();
        return;
      }
      if (err) err.hidden = true;
      setSending(true);

      joinWaitlist(value).then(function (n) {
        setSending(false);
        store.set(KEY, JSON.stringify({ email: value, n: n, at: new Date().toISOString() }));
        showDone(n, true);
      }).catch(function () {
        setSending(false);
        fail('The signal didn\u2019t go through. Try again.');
        input.focus();
      });
    });
    input.addEventListener('input', function () { if (err) err.hidden = true; });
  }

  /* ── chapter progress (no motion required) ── */
  const label = document.getElementById('progressLabel');
  const ticks = Array.prototype.slice.call(document.querySelectorAll('.ticks i'));
  const sections = Array.prototype.slice.call(document.querySelectorAll('[data-chapter]'));

  function setChapter(n, text) {
    if (label && text) label.textContent = text;
    ticks.forEach(function (t, i) { t.classList.toggle('on', i < n); });
  }

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > 0.35) {
          setChapter(parseInt(e.target.dataset.chapter, 10), e.target.dataset.label);
        }
      });
    }, { threshold: [0.35, 0.6] });
    sections.forEach(function (s) { spy.observe(s); });
  }
  setChapter(1);

  /* ── CTA arrival: the light-dot lands when the button is pressed ── */
  if (!reduced) {
    Array.prototype.slice.call(document.querySelectorAll('.btn-ember')).forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.remove('arrived');
        /* force reflow so a repeat click restarts the arrival pulse */
        void b.offsetWidth;
        b.classList.add('arrived');
        window.setTimeout(function () { b.classList.remove('arrived'); }, 700);
      });
    });
  }

  if (!hasGSAP || reduced) return;

  gsap.registerPlugin(ScrollTrigger);

  /* ── warmth arc: after the daylight document (ch4), the night itself
     warms imperceptibly as arrival approaches — light felt, never seen ── */
  gsap.to('body', {
    backgroundColor: '#17100a',
    ease: 'none',
    scrollTrigger: {
      trigger: '#ch5',
      start: 'top bottom',
      endTrigger: '#waitlist',
      end: 'bottom bottom',
      scrub: 1.2
    }
  });

  /* ── nav inverts while the ivory document is under it ── */
  ScrollTrigger.create({
    trigger: '#ch4',
    start: 'top 60px',
    end: 'bottom 60px',
    onToggle: function (self) {
      document.getElementById('nav').classList.toggle('daylight', self.isActive);
    }
  });

  /* ── generic reveals ── */
  const groups = [
    ['#ch1 .reveal', 0.16],
    ['#ch2 .reveal', 0.14],
    ['#ch3 .reveal', 0.14],
    ['#ch4 .reveal', 0.1],
    ['#ch5 .reveal', 0.08],
    ['#ch6 .reveal', 0.07],
    ['#voices .reveal', 0.09],
    ['#ch7 .reveal', 0.16],
    ['#waitlist .display, #waitlist .wl-form, #waitlist .wl-privacy', 0.12]
  ];

  groups.forEach(function (g) {
    const els = gsap.utils.toArray(g[0]);
    if (!els.length) return;
    gsap.fromTo(els,
      { opacity: 0, y: 34 },
      {
        opacity: 1, y: 0,
        duration: 1.5,
        ease: 'power3.out',
        stagger: g[1],
        scrollTrigger: { trigger: els[0].closest('section'), start: 'top 72%' }
      }
    );
  });

  /* hero opens slowly out of the dark */
  gsap.timeline({ delay: 0.25 })
    .fromTo('#ch1 .chapter-no', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' })
    .fromTo('#ch1 .hero-h', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 2, ease: 'power3.out' }, '-=0.9')
    .fromTo('#ch1 .lede', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out' }, '-=1.4')
    .fromTo('#ch1 .actions', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out' }, '-=1.1')
    .fromTo('#ch1 .scroll-hint', { opacity: 0 }, { opacity: 1, duration: 1.4 }, '-=0.8');

  /* ── the persistent ember light ── */
  const ember = document.getElementById('emberLight');
  const marks = [
    { sel: '#ch1', x: 0.3, y: -0.1, s: 0.34, o: 0.95 },
    { sel: '#ch2', x: -0.16, y: 0.14, s: 0.6, o: 0.8 },
    { sel: '#ch3', x: 0.02, y: -0.04, s: 0.42, o: 0.6 },
    { sel: '#ch4', x: 0.32, y: 0.1, s: 0.5, o: 0.5 },
    { sel: '#ch5', x: -0.04, y: 0.0, s: 1.05, o: 0.7 },
    { sel: '#ch6', x: -0.3, y: 0.12, s: 0.55, o: 0.55 },
    { sel: '#voices', x: 0.34, y: 0.06, s: 0.6, o: 0.4 },
    { sel: '#ch7', x: 0, y: -0.02, s: 1.9, o: 1 },
    { sel: '#waitlist', x: 0, y: -0.22, s: 2.3, o: 0.75 }
  ];

  gsap.set(ember, {
    x: function () { return window.innerWidth * marks[0].x; },
    y: function () { return window.innerHeight * marks[0].y; },
    scale: marks[0].s,
    opacity: marks[0].o
  });

  /* the finale owns the only ember moment on screen: the light stays as ambient
     warmth but its hard core dot steps aside so it can't read as part of the mark */
  ScrollTrigger.create({
    trigger: '#ch7',
    start: 'top 88%',
    onEnter: function () { if (ember) ember.classList.add('no-core'); },
    onLeaveBack: function () { if (ember) ember.classList.remove('no-core'); }
  });

  marks.forEach(function (m, i) {
    if (i === 0) return;
    gsap.to(ember, {
      x: function () { return window.innerWidth * m.x; },
      y: function () { return window.innerHeight * m.y; },
      scale: m.s,
      opacity: m.o,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        trigger: m.sel,
        start: 'top bottom',
        end: 'center center',
        scrub: 1.1,
        invalidateOnRefresh: true
      }
    });
  });

  /* ── 02 · roads emerging out of the darkness ── */
  const roads = gsap.utils.toArray('#roads .road-lines path');
  gsap.to(roads, {
    strokeDashoffset: 0,
    ease: 'none',
    stagger: 0.12,
    scrollTrigger: { trigger: '#ch2', start: 'top 85%', end: 'bottom 60%', scrub: 1 }
  });
  gsap.fromTo('#roads .road-nodes circle',
    { opacity: 0, scale: 0 },
    {
      opacity: 1, scale: 1, transformOrigin: '50% 50%', stagger: 0.09, ease: 'power2.out', duration: 1.2,
      scrollTrigger: { trigger: '#ch2', start: 'top 60%' }
    }
  );

  /* ── 03 · the dispatch transcript types with the scroll, then stops mid-word ── */
  const beats = gsap.utils.toArray('#beats .beat');
  const caret = document.getElementById('beatCaret');
  const dispatchMeta = document.getElementById('dispatchMeta');
  const freezeLine = document.getElementById('freezeLine');
  const freezeLines = gsap.utils.toArray('#freezeCopy p');
  const nobody = document.getElementById('nobody');

  const fulls = beats.map(function (b) { return b.dataset.full || b.textContent; });
  const totalChars = fulls.reduce(function (a, s) { return a + s.length; }, 0);
  const TYPE_START = 0.03;
  const TYPE_END = 0.25; /* typing completes just before the freeze */

  const reducedType = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderTranscript(p) {
    /* no motion preference: the log is simply already written */
    const t = reducedType ? 1 : Math.max(0, Math.min(1, (p - TYPE_START) / (TYPE_END - TYPE_START)));
    let remaining = Math.round(t * totalChars);
    beats.forEach(function (el, i) {
      const full = fulls[i];
      const n = Math.max(0, Math.min(full.length, remaining));
      remaining -= full.length;
      const txt = el.querySelector('.beat-txt');
      if (txt) txt.textContent = full.slice(0, n);
      el.style.opacity = n > 0 ? '1' : '0';
      if (i === beats.length - 1 && caret) caret.style.opacity = n > 0 ? '1' : '0';
    });
  }

  /* start empty — the transcript is written by the reader's own scroll */
  renderTranscript(0);

  ScrollTrigger.create({
    trigger: '#ch3',
    start: 'top top',
    end: 'bottom 92%',
    scrub: true,
    onUpdate: function (self) { renderTranscript(self.progress); },
    onRefresh: function (self) { renderTranscript(self.progress); }
  });

  const gapTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#ch3',
      start: 'top top',
      end: 'bottom 92%',
      scrub: 0.8,
      onLeaveBack: function () { document.body.classList.remove('frozen'); },
      onLeave: function () { document.body.classList.remove('frozen'); }
    }
  });

  /* the time it takes to type — nothing moves but the text */
  gapTl.to({}, { duration: 1.8 });

  gapTl.add(function () {
    document.body.classList.add('frozen');
    if (dispatchMeta) dispatchMeta.textContent = 'no signal';
  });
  gapTl.to({}, { duration: 0.35 });
  gapTl.fromTo(freezeLine, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.9, ease: 'power2.inOut' });
  gapTl.fromTo(nobody, { opacity: 0 }, { opacity: 1, duration: 0.5 }, '-=0.3');
  gapTl.to(freezeLine, { opacity: 0.8, duration: 0.6 });
  freezeLines.forEach(function (p) {
    gapTl.fromTo(p, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' });
  });
  gapTl.add(function () {
    document.body.classList.remove('frozen');
    if (dispatchMeta) dispatchMeta.textContent = 'held';
  });
  gapTl.to(freezeLine, { opacity: 0.25, duration: 0.6 });

  gapTl.eventCallback('onReverseComplete', function () {
    if (dispatchMeta) dispatchMeta.textContent = 'live';
  });

  /* ── 04 · the void row weighs more ── */
  gsap.fromTo('.ledger-row--void dt',
    { opacity: 0.25, letterSpacing: '0.02em' },
    {
      opacity: 1, letterSpacing: '-0.01em', duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: '.ledger-row--void', start: 'top 78%' }
    }
  );

  /* ── 07 · the official mark states ──
     idle (piece at baseline, monochrome) → response (piece ignites)
     → en route (piece travels toward the seam) → arrived (letter whole, ember seam)
     → resolved (cools to ivory, piece returns to baseline).
     Inner group is translate(0,1080) scale(0.1,-0.1): x is 10× and y is 10× AND flipped,
     so travelling the piece up-left = negative x, positive y in inner units.
     Measured seam slot: dx -194, dy -94 in viewBox units → -1940 / +940 inner. */
  const seam = document.getElementById('seamPiece');
  const markLarge = document.getElementById('markLarge');
  const markWrap = document.getElementById('markWrap');
  const SEAM_X = -1940;
  const SEAM_Y = 940;
  const IVORY = '#F5F2EC';
  const EMBER = '#BD3103';
  const EMBER_HI = '#FF9257';

  if (seam && markLarge && !reduced) {
    gsap.set(seam, { x: 0, y: 0, fill: IVORY });

    const markTl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.6 });

    /* the mark itself settles in first */
    markTl.fromTo(markLarge,
      { opacity: 0.35, scale: 0.965, transformOrigin: '10% 50%' },
      { opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' }
    );

    /* RESPONSE — the piece ignites: two soft breaths, fast */
    markTl.add(function () { markLarge.classList.add('lit'); }, '-=0.35');
    markTl.to(seam, { fill: EMBER, duration: 0.28, ease: 'power2.out' }, '-=0.35');
    markTl.to(seam, { fill: EMBER_HI, duration: 0.22, ease: 'sine.inOut' });
    markTl.to(seam, { fill: EMBER, duration: 0.26, ease: 'sine.inOut' });
    markTl.to(seam, { fill: EMBER_HI, duration: 0.22, ease: 'sine.inOut' });

    /* EN ROUTE — the distance closes. eased, no bounce */
    markTl.add(function () { if (markWrap) markWrap.classList.add('glow'); });
    markTl.to(seam, { x: SEAM_X, y: SEAM_Y, duration: 1.5, ease: 'power2.inOut' });

    /* ARRIVED — the seam closes; the letter is whole with an ember seam */
    markTl.add(function () { markLarge.classList.add('whole'); });
    markTl.to(seam, { fill: '#FFC39C', duration: 0.18, ease: 'power2.out' });
    markTl.to({}, { duration: 1.15 });

    /* RESOLVED — ember cools to ivory in place, then the piece returns */
    markTl.add(function () { markLarge.classList.remove('whole'); });
    markTl.to(seam, { fill: IVORY, duration: 2.1, ease: 'power1.inOut' });
    markTl.add(function () {
      markLarge.classList.remove('lit');
      if (markWrap) markWrap.classList.remove('glow');
    });
    markTl.to(seam, { x: 0, y: 0, duration: 1.5, ease: 'power2.inOut' }, '-=0.5');

    ScrollTrigger.create({
      trigger: '#ch7',
      start: 'top 74%',
      once: true,
      onEnter: function () { markTl.play(0); }
    });
  }

  /* nav recedes once the story starts, returns at the finale */
  ScrollTrigger.create({
    trigger: '#ch2',
    start: 'top center',
    onEnter: function () { gsap.to('#nav .nav-cta', { opacity: 1, duration: 0.6 }); }
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
