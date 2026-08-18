/**
 * SERAYAE — guardian invite handoff.
 *
 * The page is already complete and readable with JavaScript switched off. All
 * this file does is take the invite token out of the URL and turn it into
 * something the phone can act on.
 *
 * Rules this file holds to:
 *   - It makes NO network request. There is no unauthenticated endpoint that
 *     would tell it anything about a token, and there must not be: a page that
 *     could ask "is this token real?" would also answer "is this number
 *     registered?" for anyone holding a list of numbers.
 *   - The token is never logged and never handed to a third party. It goes into
 *     the deep link and into the visible fallback code, nowhere else.
 *   - The token is stripped from the address bar after it is read, so it does
 *     not survive in a screenshot, a shared tab, or the browser's own history
 *     suggestions.
 *   - It never claims the app opened. Auto-redirecting into a custom scheme and
 *     then showing "opening…" forever is how these pages usually lie; the button
 *     stays a button, and the store and the plain-text code stay visible.
 */
(function () {
  'use strict';

  /**
   * Referral tokens are cuids as minted by the backend (`cuid()` on
   * Referral.code) — lower-case alphanumeric, starting with 'c', around 25
   * characters. The bound is deliberately loose on length and strict on
   * alphabet, so a token format change does not silently break the page while
   * still refusing anything with a slash, a dot, a colon or a space in it that
   * could escape the deep link or the href.
   */
  var TOKEN_RE = /^[a-z0-9]{16,64}$/i;

  var SCHEME = 'serayae://invite/';

  /** Accepts /invite/?t=<token> and /invite/<token>. */
  function readToken() {
    var fromQuery = new URLSearchParams(window.location.search).get('t');
    if (fromQuery && TOKEN_RE.test(fromQuery)) return fromQuery;

    var segments = window.location.pathname.split('/').filter(Boolean);
    var last = segments[segments.length - 1];
    if (last && last !== 'invite' && TOKEN_RE.test(last)) return last;

    return null;
  }

  /**
   * Take the token out of the visible URL. `replaceState` leaves no history
   * entry, so Back still works the way the visitor expects.
   */
  function scrubUrl() {
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', '/invite/');
      }
    } catch (err) {
      // A sandboxed or file:// context refuses replaceState. Nothing here is
      // worth breaking the page over.
    }
  }

  var token = readToken();
  var openApp = document.getElementById('openApp');
  var codeBlock = document.getElementById('codeBlock');
  var codeValue = document.getElementById('codeValue');

  if (token) {
    if (openApp) {
      openApp.setAttribute('href', SCHEME + encodeURIComponent(token));
    }
    if (codeBlock && codeValue) {
      // textContent, never innerHTML: the token is untrusted input from the URL.
      codeValue.textContent = token;
      codeBlock.hidden = false;
    }
    scrubUrl();
  } else if (openApp) {
    /*
     * No usable token — someone opened /invite/ directly, or the link was
     * truncated by a messaging app. Say that, rather than offering a button
     * that opens the app to nothing.
     */
    openApp.setAttribute('href', '/#waitlist');
    openApp.textContent = 'This invite link is incomplete';
    openApp.setAttribute('aria-disabled', 'true');
    openApp.style.background = 'transparent';
    openApp.style.borderColor = 'rgba(245, 242, 236, 0.16)';
    openApp.style.color = 'rgba(245, 242, 236, 0.7)';

    var note = document.createElement('p');
    note.className = 'note';
    note.textContent =
      'Open the full link from the message you received — some apps cut long links short. ' +
      'The invite itself is still valid.';
    openApp.parentNode.insertBefore(note, openApp.nextSibling);
  }
})();
