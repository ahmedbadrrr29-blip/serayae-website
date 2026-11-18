/**
 * Serayae — guardian tracking view.
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

  // The API origin is FIXED and assigned exactly once. #7 removed a `?api=`
  // query-param override that turned every tracking link into a token-
  // exfiltration primitive: ?api=https://attacker.example handed the bearer
  // token to the attacker in the request path, with no script execution
  // required — just a crafted link sent to a guardian. Never reintroduce an
  // origin override here; verify staging backends with a local build instead.
  //
  // This is a `var` assigned once and never reassigned, and
  // .github/scripts/check-api-origin.js enforces exactly that. The mutable
  // `apiBase` copy that used to live below is gone: #7 deleted the only thing
  // that ever wrote to it, so it survived as a re-entry point for precisely
  // the bug that was removed, sitting outside the reach of any check.
  var API_BASE = 'https://serayae-api-01118af29270.herokuapp.com/api';

  var POLL_MS = 15000;          // how often to re-check while the page is open
  var POLL_CEILING_MS = 120000; // backoff ceiling after repeated failures

  var view = document.getElementById('view');
  var token = null;
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

  /**
   * Arabic beside English, never instead of it: the person holding this link
   * may read either, and a guardian in Egypt is likelier to read Arabic. Arabic
   * copy is gender-neutral and names the person in the third person.
   */
  function bi(tag, className, en, ar) {
    var frag = document.createDocumentFragment();
    frag.appendChild(el(tag, className, en));
    var arNode = el(tag === 'h1' ? 'p' : tag, (className ? className + ' ' : '') + 'ar' + (tag === 'h1' ? ' ar-h' : ''), ar);
    arNode.setAttribute('lang', 'ar');
    arNode.setAttribute('dir', 'rtl');
    frag.appendChild(arNode);
    return frag;
  }

  /** "11:42" in the viewer's own clock, or null. */
  function clockTime(iso, locale) {
    if (typeof iso !== 'string') return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    try {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return d.toTimeString().slice(0, 5);
    }
  }

  /** Emergency types, named the way a parent would say them. */
  var TYPE_LABEL = {
    FALL: ['Possible fall', 'احتمال سقوط'],
    MEDICAL: ['Medical', 'حالة طبية'],
    CHRONIC: ['Health episode', 'نوبة صحية'],
    HARASSMENT: ['Harassment', 'تحرّش'],
    SEXUAL_ABUSE: ['Harassment', 'تحرّش'],
    FOLLOWING: ['Being followed', 'تعرّض للملاحقة'],
    SOS: ['SOS', 'نداء استغاثة']
  };

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
        ? pill('Emergency in progress · طوارئ جارية', 'is-alarm')
        : pill('Safe Walk in progress · مشوار آمن جارٍ', 'is-live')
    );

    view.appendChild(
      isEmergency
        ? bi('h1', null, name + ' needs help.', name + ' بحاجة إلى مساعدة.')
        : bi('h1', null, 'Walking with ' + name + '.', 'مشوار آمن مع ' + name + '.')
    );

    var sentEn = isEmergency ? clockTime(data.startedAt, undefined) : null;
    var sentAr = isEmergency ? clockTime(data.startedAt, 'ar-EG') : null;

    // Location-less SOS: the first thing a guardian reads says what to do.
    var noLocationLede = isEmergency && data.locationUnavailable === true;
    view.appendChild(
      isEmergency
        ? bi(
            'p',
            'lede',
            name + ' pressed SOS' + (sentEn ? ' at ' + sentEn : '') + ' and shared this link with you. ' +
              (noLocationLede ? 'Their location is not available yet, so call them now. ' : '') +
              'If you think they are in danger now, call 123 for an ambulance or 122 for the police.',
            'تم إطلاق نداء استغاثة من ' + name + (sentAr ? ' الساعة ' + sentAr : '') + '، وتمت مشاركة هذا الرابط معك. ' +
              (noLocationLede ? 'الموقع غير متاح بعد، لذا يُرجى الاتصال الآن. ' : '') +
              'عند الشك في وجود خطر الآن، يُرجى الاتصال بـ 123 للإسعاف أو 122 للشرطة.'
          )
        : bi(
            'p',
            'lede',
            name + ' is on a Safe Walk and shared this link with you. It updates while this page is open.',
            'مشوار آمن جارٍ لـ ' + name + '، وتمت مشاركة هذا الرابط معك. يتم التحديث ما دامت الصفحة مفتوحة.'
          )
    );

    var facts = [];
    if (isEmergency) {
      var typeLabel = TYPE_LABEL[data.emergencyType];
      if (typeLabel) facts.push(['Type · النوع', typeLabel[0] + ' · ' + typeLabel[1]]);
      else if (typeof data.emergencyType === 'string') facts.push(['Type · النوع', titleCase(data.emergencyType)]);
      if (sentEn) facts.push(['Sent at · وقت الإرسال', sentEn]);
      // Location-less SOS (basement, metro, GPS off): the server alerted
      // guardians only. Nearby helpers are asked when the phone gets a fix, so
      // "none on the way" would hide the reason; say it.
      var noLocation = data.locationUnavailable === true;
      if (noLocation) {
        facts.push(['Location · الموقع', 'Not available yet · غير متاح بعد']);
      }
      if (noLocation && data.responderCount === 0) {
        facts.push([
          'Helpers · المساعدون',
          'Not asked yet: no location · لم يتم طلب المساعدة بعد: الموقع غير متاح'
        ]);
      } else if (typeof data.responderCount === 'number') {
        // Only helpers who said "I'm going" are counted (the API stopped
        // counting paged and declined ones). Zero is said plainly: an empty
        // row lets someone assume help is already moving.
        var n = data.responderCount;
        facts.push([
          'Helpers · المساعدون',
          n === 0
            ? 'None on the way yet · لا يوجد مساعد في الطريق بعد'
            : n === 1
            ? '1 verified helper on the way · مساعد موثّق في الطريق'
            : n + ' verified helpers on the way · ' + n + ' مساعدين موثّقين في الطريق'
        ]);
      }
    } else {
      facts.push(['Status · الحالة', titleCase(data.status) || 'Active']);
      var remaining = humanDuration(data.timeRemaining);
      if (remaining) facts.push(['Expected back in · العودة المتوقعة خلال', remaining]);
      if (data.escalated === true) facts.push(['Check-in · التأكيد', 'Missed — escalated · لم يتم — تم التصعيد']);
    }
    view.appendChild(factList(facts));

    var actions = el('div', 'actions');

    var loc = data.lastLocation;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      var maps = el('a', 'btn btn-primary', 'Directions · الاتجاهات');
      maps.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(loc.lat + ',' + loc.lng);
      maps.target = '_blank';
      // noreferrer is the one that matters: without it the token travels to
      // Google in the Referer header.
      maps.rel = 'noopener noreferrer';
      actions.appendChild(maps);
    }

    if (isEmergency) {
      var amb = el('a', 'btn btn-ghost', 'Call 123 · Ambulance · الإسعاف');
      amb.href = 'tel:123';
      actions.appendChild(amb);
      var pol = el('a', 'btn btn-ghost', 'Call 122 · Police · الشرطة');
      pol.href = 'tel:122';
      actions.appendChild(pol);
    }

    var refresh = el('button', 'btn btn-ghost', 'Refresh now · تحديث');
    refresh.type = 'button';
    refresh.addEventListener('click', function () { load(true); });
    actions.appendChild(refresh);
    view.appendChild(actions);

    var first = name.split(' ')[0];
    if (isEmergency && data.locationUnavailable === true) {
      view.appendChild(bi(
        'p',
        'note',
        'Their phone could not get a location when the SOS was sent. A position appears here, and nearby helpers are asked, as soon as their phone finds one. This page updates while it is open.',
        'تعذّر على الهاتف تحديد الموقع عند إطلاق النداء. سيظهر الموقع هنا، وسيتم طلب المساعدة من المتطوعين القريبين، فور تحديد الموقع. يتم التحديث ما دامت الصفحة مفتوحة.'
      ));
    } else if (loc && typeof loc.lat === 'number') {
      view.appendChild(bi(
        'p',
        'note',
        'This is a last known position, not a live trail. It updates while this page is open. The link stops working when ' + first + ' turns it off, or 24 hours after the SOS ends.',
        'هذا آخر موقع معروف، وليس تتبّعًا مباشرًا. يتم التحديث ما دامت الصفحة مفتوحة. يتوقف الرابط عند إيقافه، أو بعد 24 ساعة من انتهاء النداء.'
      ));
    } else {
      view.appendChild(bi(
        'p',
        'note',
        'No location available yet. Serayae has not received a position for this session. The status above still updates while this page is open.',
        'لا يتوفر موقع بعد. لم يصل إلى Serayae أي موقع لهذه الجلسة، وتستمر الحالة أعلاه في التحديث ما دامت الصفحة مفتوحة.'
      ));
    }
  }

  function renderOver(message) {
    stop();
    clear();
    view.setAttribute('aria-busy', 'false');
    view.appendChild(pill('No longer active · لم يعد نشطًا', 'is-over'));
    view.appendChild(bi('h1', null, 'This link has been turned off.', 'تم إيقاف هذا الرابط.'));
    view.appendChild(bi(
      'p',
      'lede',
      message ||
        'The person who shared it has stopped sharing their location, or the link reached its 24-hour limit. Nothing is wrong on your end.',
      'تم إيقاف مشاركة الموقع، أو انتهت مدة الـ 24 ساعة. لا توجد مشكلة من جهتك.'
    ));
    view.appendChild(bi(
      'p',
      'lede',
      'If you are worried about them, contact them directly, or call 123 (ambulance) or 122 (police) if you think they are in danger.',
      'عند القلق، يُرجى التواصل مباشرة، أو الاتصال بـ 123 للإسعاف أو 122 للشرطة عند الشك في وجود خطر.'
    ));
  }

  function renderUnknown() {
    stop();
    clear();
    view.setAttribute('aria-busy', 'false');
    view.appendChild(pill('Link not recognised · رابط غير معروف', 'is-over'));
    view.appendChild(bi('h1', null, 'We can\u2019t find this link.', 'تعذّر العثور على هذا الرابط.'));
    view.appendChild(bi(
      'p',
      'lede',
      'It may have been copied incompletely, or it was never a Serayae tracking link. Ask the person to share it again.',
      'ربما تم نسخ الرابط بشكل ناقص، أو أنه ليس رابط تتبّع من Serayae. يُرجى طلب مشاركته مرة أخرى.'
    ));
    var actions = el('div', 'actions');
    var home = el('a', 'btn btn-ghost', 'Go to serayae.me');
    home.href = '/';
    actions.appendChild(home);
    view.appendChild(actions);
  }

  function renderError() {
    clear();
    view.setAttribute('aria-busy', 'false');
    view.appendChild(pill('Status unavailable · الحالة غير متاحة', 'is-over'));
    view.appendChild(bi('h1', null, 'We can\u2019t reach Serayae right now.', 'تعذّر الوصول إلى Serayae الآن.'));
    view.appendChild(bi(
      'p',
      'lede',
      'This does not mean the person is safe, and it does not mean they are not. We simply cannot confirm their status from here.',
      'هذا لا يعني أن الشخص بأمان، ولا يعني العكس. لا يمكن تأكيد الحالة من هنا فقط.'
    ));
    view.appendChild(bi(
      'p',
      'lede',
      'If you are worried, contact them directly, or call 123 (ambulance) or 122 (police).',
      'عند القلق، يُرجى التواصل مباشرة، أو الاتصال بـ 123 للإسعاف أو 122 للشرطة.'
    ));
    var actions = el('div', 'actions');
    var retry = el('button', 'btn btn-primary', 'Try again · إعادة المحاولة');
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

    var url = API_BASE + '/guardian/track/' + encodeURIComponent(token);

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
          // page exists to avoid. Seen for real: while the site still pointed at
          // the decommissioned Railway host, every path returned that platform's
          // {"status":"error","code":404,"message":"Application not found"} —
          // indistinguishable from a missing link unless the body shape is
          // checked. The host has moved, but any dead or misconfigured origin
          // fails the same way, so the check stays.
          if (body && body.success === false && typeof body.error === 'string') {
            renderUnknown();
            return;
          }
          throw new Error('404 from something that is not the Serayae api');
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
