/* ═══ الزينة — the lantern string ═══
   Fanous lanterns hung along a dipping street wire, like every Egyptian
   alley at night. Placement is computed once from the wire path; sway
   and glow are pure CSS. Zero per-frame JS. */

(function () {
  var svg = document.getElementById('zeena');
  var wire = document.getElementById('zeenaWire');
  if (!svg || !wire || !wire.getPointAtLength) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  var total = wire.getTotalLength();
  /* 14 lanterns: varied size, drop, and phase — two start unlit */
  var slots = [
    { t: 0.035, drop: 26, s: 1.35 }, { t: 0.105, drop: 44, s: 1.05 },
    { t: 0.175, drop: 20, s: 1.6 },  { t: 0.25, drop: 52, s: 1.15, off: true },
    { t: 0.32, drop: 30, s: 1.45 },  { t: 0.395, drop: 46, s: 1.0 },
    { t: 0.465, drop: 24, s: 1.7 },  { t: 0.54, drop: 50, s: 1.1 },
    { t: 0.615, drop: 32, s: 1.5 },  { t: 0.69, drop: 46, s: 1.05, off: true },
    { t: 0.765, drop: 22, s: 1.65 }, { t: 0.84, drop: 48, s: 1.1 },
    { t: 0.91, drop: 30, s: 1.4 },   { t: 0.972, drop: 44, s: 1.2 }
  ];

  slots.forEach(function (slot, idx) {
    var p = wire.getPointAtLength(slot.t * total);

    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'fl' + (slot.off ? ' fl-off' : ''));
    g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');

    /* the short string from wire to lantern handle */
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'fl-string');
    line.setAttribute('x1', 0); line.setAttribute('y1', 0);
    line.setAttribute('x2', 0); line.setAttribute('y2', slot.drop);
    g.appendChild(line);

    /* the lantern itself, hung at the string's end */
    var sway = document.createElementNS(NS, 'g');
    sway.setAttribute('class', 'fl-sway');
    var use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#fanous');
    var w = 20 * slot.s;
    use.setAttribute('transform',
      'translate(' + (-w / 2).toFixed(1) + ' ' + slot.drop + ') scale(' + slot.s + ')');
    sway.appendChild(use);
    g.appendChild(sway);

    if (!reduced) {
      sway.style.animationDelay = (-(idx * 0.7) % 5).toFixed(2) + 's';
      sway.style.animationDuration = (4.6 + (idx % 5) * 0.5).toFixed(1) + 's';
    }
    svg.appendChild(g);
  });

  /* the whole string fades up when it enters view */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        svg.classList.add('go');
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(svg);
  } else {
    svg.classList.add('go');
  }
})();
