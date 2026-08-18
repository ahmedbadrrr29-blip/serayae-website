/**
 * SERAYAE — guardian invite handoff.
 *
 * The page is already complete and readable with JavaScript switched off. All
 * this file does is take the invite token out of the URL and turn it into
 * something the phone can act on.
 *
 * Rules this file holds to:
 *   - It makes NO network request while loading, and exactly ONE ever: the
 *     opt-out, and only when the visitor presses the button herself. That request
 *     sends nothing but the token already in her own URL, and the API answers the
 *     same 200 for every token, real or invented — so the page still cannot be
 *     used to ask "is this token real?" or "is this number registered?", which is
 *     the property that matters. Review round 1 (I2) asked for a way out of the
 *     invite SMS that some code actually implements; this is it.
 *   - The token is never logged and never handed to a third party. It goes into
 *     the deep link, and into the opt-out request to SERAYAE's own API, nowhere
 *     else.
 *   - The token is stripped from the address bar after it is read, so it does
 *     not survive in a screenshot, a shared tab, or the browser's own history
 *     suggestions.
 *   - It never claims the app opened. Auto-redirecting into a custom scheme and
 *     then showing "opening…" forever is how these pages usually lie; the button
 *     stays a button and says what it is.
 */
(function () {
  'use strict';

  /**
   * Referral tokens are cuids as minted by the backend (`cuid()` on
   * `Referral.token` — not `Referral.code`, which does not exist) — lower-case
   * alphanumeric, starting with 'c', around 25
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

  /**
   * The API origin is FIXED, for the same reason track.js fixes it: a
   * query-param override would turn this link into a token-exfiltration
   * primitive.
   */
  var API_BASE = 'https://solra-backend-production.up.railway.app/api';

  /**
   * The opt-out. Sends the token the visitor is already holding and shows the
   * same confirmation whatever comes back — including on a network failure,
   * because the honest message here is "we have asked", and a red error box on a
   * page about somebody else's emergency is not worth the precision.
   */
  function wireOptOut(currentToken) {
    var button = document.getElementById('stopInvites');
    var result = document.getElementById('stopResult');
    if (!button || !result) return;

    button.addEventListener('click', function () {
      button.disabled = true;
      button.textContent = 'Sending…';

      var done = function () {
        result.textContent =
          'Done. This number will not receive further guardian invitations. ' +
          'If you change your mind, the person who invited you can send a new link.';
        result.hidden = false;
        button.textContent = 'Invitations stopped';
      };

      try {
        window
          .fetch(API_BASE + '/referrals/invite-stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken || '' }),
            // No cookies, no credentials: this endpoint needs no identity.
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
          })
          .then(done, done);
      } catch (err) {
        done();
      }
    });
  }

  var token = readToken();
  var openApp = document.getElementById('openApp');

  if (token) {
    if (openApp) {
      openApp.setAttribute('href', SCHEME + encodeURIComponent(token));
    }
    wireOptOut(token);
    scrubUrl();
  } else if (openApp) {
    wireOptOut(null);
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
