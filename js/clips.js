/* ═══ THE LIVING FOLD — six film windows ═══
   Six muted 4s loops play in the hero's console windows: real footage of
   people, the way Clicky's dock plays real footage. One IntersectionObserver
   for all of them — a clip nobody can see is a clip that is paused.
   Nothing here runs per frame, and nothing here listens to scroll. */

(function () {
  var clips = Array.prototype.slice.call(document.querySelectorAll('.filmwin .clip'));
  if (!clips.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  clips.forEach(function (v) {
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.removeAttribute('controls');
    /* the observer decides who plays; the attribute is only a no-JS fallback */
    v.removeAttribute('autoplay');
    v.pause();
    var src = v.dataset.clip;
    if (src && !v.getAttribute('src')) v.setAttribute('src', src);
  });

  function play(v) {
    if (reduced) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* the first frame stands in */ });
  }

  if (reduced) {
    /* stillness respected: load the first frame and hold it, like a poster */
    clips.forEach(function (v) {
      v.removeAttribute('autoplay');
      v.preload = 'metadata';
      v.addEventListener('loadeddata', function () {
        try { v.currentTime = 0.04; } catch (e) { /* ignore */ }
      }, { once: true });
      v.pause();
    });
    return;
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) play(v);
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: '160px 0px', threshold: 0.01 });
    clips.forEach(function (v) { io.observe(v); });
  } else {
    clips.forEach(play);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clips.forEach(function (v) { v.pause(); });
    } else {
      clips.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.bottom > -160 && r.top < window.innerHeight + 160) play(v);
      });
    }
  });
})();
