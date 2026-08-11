/* ═══ Ember cursor trail ═══
   The brand object follows the visitor: small embers spawn along the
   cursor path and drift out. Event-driven only — no rAF loop, no scroll
   work. Elements remove themselves on animationend. */

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.innerWidth < 900) return;

  var lastX = -100, lastY = -100;
  var live = 0;
  var MIN_DIST = 88;     /* px of cursor travel between embers */
  var MAX_LIVE = 18;     /* hard cap on simultaneous sparks */

  document.addEventListener('mousemove', function (e) {
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return;
    if (live >= MAX_LIVE) return;
    lastX = e.clientX;
    lastY = e.clientY;

    var s = document.createElement('i');
    s.className = 'trail-ember';
    /* small random offset so a straight swipe doesn't read as a ruler */
    var jx = (Math.random() - 0.5) * 14;
    var jy = (Math.random() - 0.5) * 14;
    s.style.transform = 'translate(' + (e.clientX + jx) + 'px,' + (e.clientY + jy) + 'px)';
    s.style.left = (e.clientX + jx) + 'px';
    s.style.top = (e.clientY + jy) + 'px';
    s.style.transform = '';
    live++;
    s.addEventListener('animationend', function () {
      live--;
      if (s.parentNode) s.parentNode.removeChild(s);
    });
    document.body.appendChild(s);
  }, { passive: true });
})();
