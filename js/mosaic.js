/* ═══ Footer mosaic ═══
   SERAYAE spelled from the same dot the network is made of. A slow wave
   travels through it, left to right, like a light passing down a road. */

(function () {
  const host = document.getElementById('mosaic');
  if (!host) return;

  const G = {
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100']
  };
  const WORD = 'SERAYAE';
  const ROWS = 7;

  // build a single column-major grid: each letter, then one blank column
  const cols = [];
  WORD.split('').forEach(function (ch, li) {
    const g = G[ch];
    for (let c = 0; c < 5; c++) {
      const col = [];
      for (let r = 0; r < ROWS; r++) col.push(g[r][c] === '1');
      cols.push(col);
    }
    if (li < WORD.length - 1) cols.push(null); // letter gap
  });

  const frag = document.createDocumentFragment();
  cols.forEach(function (col, ci) {
    for (let r = 0; r < ROWS; r++) {
      const dot = document.createElement('i');
      if (col && col[r]) {
        dot.className = 'on';
        dot.style.animationDelay = (ci * 0.032 + Math.random() * 0.14).toFixed(3) + 's';
        /* hand-placed feel: each window sits slightly off-true */
        var jr = (Math.random() * 7 - 3.5).toFixed(2);
        var js_ = (0.94 + Math.random() * 0.16).toFixed(3);
        var jx = (Math.random() * 2.4 - 1.2).toFixed(2);
        var jy = (Math.random() * 2.4 - 1.2).toFixed(2);
        dot.dataset.jx = jx; dot.dataset.jy = jy;
        dot.dataset.jr = jr; dot.dataset.js = js_;
        dot.style.transform = 'translate(' + jx + 'px,' + jy + 'px) rotate(' + jr + 'deg) scale(' + js_ + ')';
      }
      frag.appendChild(dot);
    }
  });
  host.style.gridTemplateRows = 'repeat(' + ROWS + ', auto)';
  host.appendChild(frag);

  /* light the building only when it scrolls into view */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        host.classList.add('go');
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(host);
  } else {
    host.classList.add('go');
  }

  /* ── clicky-style drag: pick a lantern up, put it anywhere ──
     1:1 follow, jumps to front, settles with a fresh tilt. */
  var zTop = 10;
  host.addEventListener('pointerdown', function (ev) {
    var el = ev.target;
    if (!el || el.tagName !== 'I' || !el.classList.contains('on')) return;
    ev.preventDefault();
    var startX = ev.clientX, startY = ev.clientY;
    var baseX = parseFloat(el.dataset.dx || 0) + parseFloat(el.dataset.jx || 0);
    var baseY = parseFloat(el.dataset.dy || 0) + parseFloat(el.dataset.jy || 0);
    var rot = parseFloat(el.dataset.jr || 0);
    var sc = parseFloat(el.dataset.js || 1);
    el.classList.add('lift');
    el.style.zIndex = ++zTop;
    el.setPointerCapture(ev.pointerId);

    function move(e) {
      var nx = baseX + (e.clientX - startX);
      var ny = baseY + (e.clientY - startY);
      el.style.transform = 'translate(' + nx + 'px,' + ny + 'px) rotate(' + rot + 'deg) scale(' + (sc * 1.12) + ')';
      el.dataset.curX = nx; el.dataset.curY = ny;
    }
    function up(e) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('lift');
      /* settle where dropped, with a fresh tilt — like a real object set down */
      var fx = parseFloat(el.dataset.curX || baseX);
      var fy = parseFloat(el.dataset.curY || baseY);
      var newRot = (Math.random() * 14 - 7);
      el.dataset.dx = fx - parseFloat(el.dataset.jx || 0);
      el.dataset.dy = fy - parseFloat(el.dataset.jy || 0);
      el.dataset.jr = newRot.toFixed(2);
      el.style.transform = 'translate(' + fx + 'px,' + fy + 'px) rotate(' + newRot.toFixed(2) + 'deg) scale(' + sc + ')';
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
})();
