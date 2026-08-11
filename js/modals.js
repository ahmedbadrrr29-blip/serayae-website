/* ═══ Easter eggs ═══
   founding-signal.txt — the belief, typed slowly.
   first-response.rec — one complete response, replayed. No screenshots. */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFocus = null;

  const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function focusables(modal) {
    return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE)).filter(function (el) {
      if (el.hasAttribute('aria-hidden')) return false;
      const r = el.getBoundingClientRect();
      return !!(r.width || r.height || el === document.activeElement);
    });
  }

  /* Tab cycles inside the open dialog and nowhere else. */
  function trap(modal, ev) {
    if (ev.key !== 'Tab') return;
    const list = focusables(modal);
    if (!list.length) { ev.preventDefault(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (!modal.contains(active)) {
      ev.preventDefault();
      first.focus();
      return;
    }
    if (ev.shiftKey && active === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function open(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    const close = modal.querySelector('[data-close].close') || modal.querySelector('[data-close]');
    if (close && close.focus) close.focus();
  }

  function close(modal) {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    /* focus returns to whoever opened the artifact */
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('.modal').forEach(function (modal) {
    modal.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { close(modal); });
    });
    modal.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(modal); return; }
      trap(modal, ev);
    });
  });
  document.addEventListener('keydown', function (ev) {
    const openModal = document.querySelector('.modal:not([hidden])');
    if (!openModal) return;
    if (ev.key === 'Escape') { close(openModal); return; }
    /* the trap holds even if focus escaped the dialog subtree */
    if (ev.key === 'Tab' && !openModal.contains(document.activeElement)) trap(openModal, ev);
  });

})();