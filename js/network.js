/* ═══ Chapter 05 — The Network ═══
   Not data. Response. Points of human presence breathe in the dark.
   When one point calls, nearby points warm to ember and move toward it. */

(function () {
  const canvas = document.getElementById('network');
  if (!canvas) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  const IVORY = [245, 242, 236];
  const EMBER = [189, 49, 3];
  const EMBER_HI = [255, 146, 87];
  const EMBER_LIT = [255, 195, 156];

  let w = 0, h = 0, dpr = 1;
  let points = [];
  let call = null;
  let running = false;
  let started = false;
  let raf = null;
  let last = 0;
  let nextCallAt = 2200;
  let elapsed = 0;

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function build() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const density = w < 640 ? 11000 : 9000;
    const n = Math.max(34, Math.min(150, Math.round((w * h) / density)));
    points = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      points.push({
        hx: x, hy: y, x: x, y: y,
        r: 1.3 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.6,
        steady: 0.35 + Math.random() * 0.65, // verification reads as steadiness
        warm: 0,
        responder: false
      });
    }
    call = null;
  }

  function startCall() {
    if (!points.length) return;
    const caller = points[Math.floor(Math.random() * points.length)];
    call = { p: caller, t: 0, life: 9000 };
    const reach = Math.min(w, h) * (w < 640 ? 0.5 : 0.36);
    points.forEach(function (p) {
      p.responder = false;
      if (p === caller) return;
      const d = Math.hypot(p.hx - caller.hx, p.hy - caller.hy);
      if (d < reach && Math.random() < 0.5) p.responder = true; // proximity as gravity
    });
  }

  function step(ts) {
    if (!running) return;
    const dt = Math.min(48, ts - (last || ts));
    last = ts; elapsed += dt;

    if (!call && elapsed > nextCallAt) startCall();
    if (call) {
      call.t += dt;
      if (call.t > call.life) { call = null; nextCallAt = elapsed + 2600 + Math.random() * 2600; }
    }

    ctx.clearRect(0, 0, w, h);

    // presence links — quiet structure
    ctx.lineWidth = 1.2;
    const linkDist = w < 640 ? 132 : 158;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > linkDist * linkDist) continue;
        const d = Math.sqrt(d2);
        const fade = 1 - d / linkDist;
        const warm = Math.max(a.warm, b.warm);
        ctx.strokeStyle = warm > 0.05
          ? rgba(EMBER_HI, 0.18 + fade * 0.6 * warm)
          : 'rgba(245,242,236,' + (0.14 + fade * 0.3) + ')';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // the call itself — expanding ember request
    if (call) {
      const prog = Math.min(1, call.t / 2600);
      const maxR = Math.min(w, h) * 0.42;
      ctx.strokeStyle = rgba(EMBER_HI, 0.7 * (1 - prog));
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(call.p.x, call.p.y, maxR * prog, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.phase += (dt / 1000) * p.speed * 0.9;

      let tx = p.hx, ty = p.hy;
      const target = call && (p.responder || p === call.p) ? 1 : 0;
      p.warm += (target - p.warm) * (dt / (target ? 700 : 1600));

      if (call && p.responder) {
        // movement toward the one who called — distance closing is the message
        const dx = call.p.hx - p.hx, dy = call.p.hy - p.hy;
        const d = Math.hypot(dx, dy) || 1;
        const closed = Math.min(0.42, (call.t / call.life) * 0.7) * p.warm;
        tx = p.hx + (dx / d) * d * closed;
        ty = p.hy + (dy / d) * d * closed;
      }

      const drift = Math.sin(p.phase) * (2.6 * (1 - p.steady * 0.7));
      p.x += (tx + drift - p.x) * 0.045;
      p.y += (ty + Math.cos(p.phase * 0.8) * (2.2 * (1 - p.steady * 0.7)) - p.y) * 0.045;

      const breathe = 0.82 + Math.sin(p.phase) * 0.18 * (1 - p.steady * 0.5);
      const base = 0.5 + 0.34 * p.steady;
      const alpha = Math.min(1, base * breathe + p.warm * 0.4);
      const rad = p.r * (1.25 + p.warm * 0.75);

      if (p.warm > 0.03) {
        const gr = rad * 8;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
        g.addColorStop(0, rgba(EMBER_HI, 0.55 * p.warm));
        g.addColorStop(0.45, rgba(EMBER, 0.22 * p.warm));
        g.addColorStop(1, rgba(EMBER, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
        ctx.fill();
      }

      const col = p.warm > 0.03
        ? [
            Math.round(IVORY[0] + (EMBER_LIT[0] - IVORY[0]) * p.warm),
            Math.round(IVORY[1] + (EMBER_LIT[1] - IVORY[1]) * p.warm),
            Math.round(IVORY[2] + (EMBER_LIT[2] - IVORY[2]) * p.warm)
          ]
        : IVORY;
      ctx.fillStyle = rgba(col, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(step);
  }

  function staticFrame() {
    ctx.clearRect(0, 0, w, h);
    running = false;
    // one calm composition for reduced motion
    const linkDist = w < 640 ? 132 : 158;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > linkDist) continue;
        ctx.strokeStyle = 'rgba(245,242,236,' + (0.14 + (1 - d / linkDist) * 0.24) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    points.forEach(function (p, i) {
      const warm = i % 9 === 0;
      ctx.fillStyle = warm ? rgba(EMBER_HI, 1) : rgba(IVORY, 0.62);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (warm ? 2 : 1.3), 0, Math.PI * 2); ctx.fill();
    });
  }

  function start() {
    if (started) return;
    started = true;
    build();
    if (reduced) { staticFrame(); return; }
    running = true; last = 0;
    raf = requestAnimationFrame(step);
  }

  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function resume() {
    if (!started || reduced || running) return;
    running = true; last = 0;
    raf = requestAnimationFrame(step);
  }

  // lazy-init when the chapter approaches
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { start(); resume(); }
      else pause();
    });
  }, { rootMargin: '200px' });
  io.observe(canvas);

  let rt = null;
  window.addEventListener('resize', function () {
    if (!started) return;
    clearTimeout(rt);
    rt = setTimeout(function () {
      build();
      if (reduced) staticFrame();
    }, 200);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause(); else resume();
  });

  window.SERAYAE_NETWORK = { pause: pause, resume: resume };
})();
