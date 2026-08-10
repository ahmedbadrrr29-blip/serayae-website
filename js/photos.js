/* ═══ The photographic layer ═══
   Instant photos, dropped on the table by hand: tilted, draggable, captioned
   in mono ink. Same physics as the hero field, applied to the scattered
   photo fields inside the later chapters. */

(function () {
  const zones = Array.prototype.slice.call(document.querySelectorAll('.photo-field[data-drag-zone]'));
  if (!zones.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 860px)');
  let z = 8;

  function placeAll() {
    const compact = mobile.matches;
    zones.forEach(function (zone) {
      zone.querySelectorAll('.draggable').forEach(function (el) {
        const rot = el.dataset.rot || '0';
        if (compact) {
          el.style.left = '';
          el.style.top = '';
        } else if (!el.dataset.dragged) {
          el.style.left = el.dataset.x + '%';
          el.style.top = el.dataset.y + '%';
        }
        el.style.transform = 'rotate(' + rot + 'deg)';
      });
    });
  }
  placeAll();

  let t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(placeAll, 180);
  });

  zones.forEach(function (zone) {
    zone.querySelectorAll('.draggable').forEach(function (el) {
      let dragging = false, id = null;
      let sx = 0, sy = 0, ox = 0, oy = 0;

      el.addEventListener('pointerdown', function (ev) {
        if (reduced || mobile.matches) return;
        if (ev.button !== undefined && ev.button !== 0) return;
        dragging = true; id = ev.pointerId;
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
        const host = el.offsetParent || zone;
        const maxX = host.clientWidth - el.offsetWidth;
        const maxY = host.clientHeight - el.offsetHeight;
        el.style.left = Math.max(-24, Math.min(maxX + 24, ox + (ev.clientX - sx))) + 'px';
        el.style.top = Math.max(0, Math.min(maxY, oy + (ev.clientY - sy))) + 'px';
        ev.preventDefault();
      });

      function end() {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('dragging');
        try { el.releasePointerCapture(id); } catch (e) { /* ignore */ }
      }
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
    });
  });
})();
