/* ═══ Footer word ═══
   "serayae" traced from a real bold letterform and rebuilt as a pile of
   lit-window icons — dense strokes, overlapping objects, hand-placed
   jitter. One-time build after fonts load; zero per-frame work. */

(function () {
  var host = document.getElementById('mosaic');
  if (!host) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    var W = 840, H = 150;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';
    var WORD = 'serayae';
    function setFont(px) { ctx.font = '700 ' + px + 'px Satoshi, "Satoshi Fallback", ui-sans-serif, sans-serif'; }
    /* size the word to fill ~96% of the canvas, with breathing room between letters */
    var fs = 100;
    setFont(fs);
    function wordWidth(gap) {
      var w = 0;
      for (var k = 0; k < WORD.length; k++) w += ctx.measureText(WORD[k]).width + (k < WORD.length - 1 ? gap : 0);
      return w;
    }
    var gap0 = fs * 0.1;
    fs = Math.floor(fs * (W * 0.96) / wordWidth(gap0));
    setFont(fs);
    var gap = fs * 0.1;
    var x0 = (W - wordWidth(gap)) / 2;
    for (var k2 = 0; k2 < WORD.length; k2++) {
      ctx.fillText(WORD[k2], x0 + ctx.measureText(WORD[k2]).width / 2, H / 2 + fs * 0.04);
      x0 += ctx.measureText(WORD[k2]).width + gap;
    }

    var data;
    try {
      data = ctx.getImageData(0, 0, W, H).data;
    } catch (e) { return; }

    var step = 9;
    var pts = [];
    for (var py = 3; py < H; py += step) {
      for (var px = 3; px < W; px += step) {
        var a = data[(py * W + px) * 4 + 3];
        if (a > 120) pts.push([px / W, py / H]);
      }
    }
    if (!pts.length) return;

    /* shuffle so overlaps layer organically, not in scan order */
    for (var i = pts.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pts[i]; pts[i] = pts[j]; pts[j] = t;
    }

    var frag = document.createDocumentFragment();
    pts.forEach(function (p) {
      var el = document.createElement('i');
      el.style.left = (p[0] * 100 + (Math.random() - 0.5) * 0.7).toFixed(2) + '%';
      el.style.top = (p[1] * 100 + (Math.random() - 0.5) * 4).toFixed(2) + '%';
      el.style.setProperty('--rot', (Math.random() * 16 - 8).toFixed(1) + 'deg');
      el.style.setProperty('--sc', (0.88 + Math.random() * 0.3).toFixed(2));
      if (!reduced) {
        /* the word lights left to right, each window on its own beat */
        el.style.animationDelay = (p[0] * 1.1 + Math.random() * 0.3).toFixed(2) + 's';
      }
      frag.appendChild(el);
    });
    host.appendChild(frag);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          host.classList.add('go');
          io.disconnect();
        }
      }, { threshold: 0.3 });
      io.observe(host);
    } else {
      host.classList.add('go');
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(build);
  } else {
    build();
  }
})();
