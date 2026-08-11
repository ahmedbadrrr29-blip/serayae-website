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
})();
