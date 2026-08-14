/* ═══ THE FILM ═══
   The hero holds one window that is already alive: the launch film, muted and
   looping, the way a lit window looks from the street. Clicking it opens the
   film full-bleed — and only then, on that deliberate human action, does the
   sound arrive. Audio never starts on its own. */

(function () {
  const film = document.getElementById('film');
  const preview = document.getElementById('filmPreview');
  const playBtn = document.getElementById('filmPlay');
  const cta = document.getElementById('filmCta');
  const modal = document.getElementById('filmModal');
  const full = document.getElementById('filmFull');
  if (!modal || !full) return;

  const SRC = 'media/launch-video.mp4';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the looping preview: silent, cheap, and paused when out of sight ── */
  if (preview) {
    preview.muted = true;
    preview.defaultMuted = true;
    preview.removeAttribute('controls');

    /* on phones (or Save-Data), the 2.2MB loop is a luxury the visitor pays for:
       the poster stands in, and the film streams only when they choose to watch */
    var saveData = navigator.connection && navigator.connection.saveData;
    var phone = window.matchMedia('(max-width: 700px)').matches;
    if (reduced || saveData || phone) {
      /* stillness (or data) respected: the poster frame stands in for the loop */
      preview.removeAttribute('autoplay');
      preview.preload = 'none';
      preview.pause();
      var srcEl = preview.querySelector('source');
      if (srcEl) { srcEl.removeAttribute('src'); try { preview.load(); } catch (e) {} }
    } else {
      /* desktop: upgrade the cheap default and let the loop live */
      preview.preload = 'metadata';
      const tryPlay = function () {
        const p = preview.play();
        if (p && p.catch) p.catch(function () { /* poster stands in */ });
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) tryPlay(); else preview.pause();
          });
        }, { rootMargin: '80px' });
        io.observe(preview);
      } else {
        tryPlay();
      }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) preview.pause();
      });
    }
  }

  /* ── the lightbox ── */
  let lastFocus = null;

  function openFilm() {
    lastFocus = document.activeElement;
    if (!full.getAttribute('src')) full.setAttribute('src', SRC);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    if (film) film.classList.add('playing');
    if (preview) preview.pause();
    full.currentTime = 0;
    full.muted = false;      /* sound only ever arrives on a click */
    full.volume = 1;
    const p = full.play();
    if (p && p.catch) p.catch(function () { /* the controls are right there */ });
    const closeBtn = modal.querySelector('.film-close');
    if (closeBtn) closeBtn.focus();
  }

  function afterClose() {
    full.pause();
    full.muted = true;
    try { full.currentTime = 0; } catch (e) { /* ignore */ }
    document.body.classList.remove('modal-open');
    if (film) film.classList.remove('playing');
    if (preview && !reduced) {
      const p = preview.play();
      if (p && p.catch) p.catch(function () { /* ignore */ });
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* whoever closes it — scrim, Close, or Escape via modals.js — the sound stops */
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(function () {
      if (modal.hidden) afterClose();
    });
    mo.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  }
  modal.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { modal.hidden = true; });
  });
  modal.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') modal.hidden = true;
  });

  if (playBtn) playBtn.addEventListener('click', openFilm);
  if (cta) cta.addEventListener('click', openFilm);
})();
