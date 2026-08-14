/* ═══ Operations bar ═══
   A real clock, real flyouts, and a lantern that means something:
   light = someone is there. */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── live clock — the visitor's own time and place ── */
  const clock = document.getElementById('opsClock');
  const clockLabel = document.querySelector('.ops-clock-label');
  if (clock) {
    let fmt = null;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const city = tz.split('/').pop().replace(/_/g, ' ').toUpperCase();
      if (clockLabel && city) clockLabel.textContent = city;
      fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    } catch (e) { if (clockLabel) clockLabel.textContent = 'LOCAL'; }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function tick() {
      /* the Chapter 03 freeze is a genuine full stop — even the clock holds */
      if (document.body.classList.contains('frozen')) return;
      const now = new Date();
      clock.textContent = fmt ? fmt.format(now)
        : pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      clock.setAttribute('datetime', now.toISOString());
    }
    tick();
    setInterval(tick, 1000);
  }

  const signalBtn = document.getElementById('signalBtn');
  if (signalBtn) {
    signalBtn.addEventListener('click', function () {
      const on = document.body.classList.toggle('signalOn');
      signalBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    /* real connectivity: if the visitor drops offline, the signal dims */
    function netState() {
      const off = !navigator.onLine;
      signalBtn.classList.toggle('sigOff', off);
      const k = signalBtn.querySelector('.ops-pop-k');
      const h = signalBtn.querySelector('.ops-pop-hint');
      if (k) k.textContent = off ? 'NETWORK · OFFLINE' : 'NETWORK · LISTENING';
      if (h) h.textContent = off ? 'connection lost — reconnecting' : 'all signals monitored';
    }
    window.addEventListener('online', netState);
    window.addEventListener('offline', netState);
    netState();
  }
})();

/* ── night radio: plain YouTube embed (دايماً مع بعض) — maximum compatibility ── */
(function () {
  var VIDEO_ID = 'G-eWMlgZkJo';
  var btn = document.getElementById('radioBtn');
  var widget = document.getElementById('radioWidget');
  var play = document.getElementById('radioPlay');
  var screen = document.getElementById('radioScreen');
  var screenWrap = document.getElementById('radioScreenWrap');
  if (!btn || !widget || !play || !screen) return;
  var icoPlay = play.querySelector('.radio-ico-play');
  var icoPause = play.querySelector('.radio-ico-pause');
  var loaded = false;

  function loadPlayer() {
    if (loaded) return;
    loaded = true;
    if (screenWrap) screenWrap.hidden = false;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/' + VIDEO_ID +
            '?loop=1&playlist=' + VIDEO_ID + '&rel=0&playsinline=1&enablejsapi=1&origin=' +
            encodeURIComponent(location.origin);
    f.title = 'دايماً مع بعض — Always Together';
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'origin');
    screen.appendChild(f);
    /* subscribe to real player state so the menubar icon can breathe with the music */
    f.addEventListener('load', function () {
      try {
        f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'serayae-radio' }), '*');
      } catch (e) {}
    });
    window.addEventListener('message', function (e) {
      if (e.origin.indexOf('youtube.com') === -1) return;
      var d;
      try { d = JSON.parse(e.data); } catch (err) { return; }
      var st = d && d.info && typeof d.info.playerState === 'number' ? d.info.playerState
             : (d && typeof d.info === 'number' && d.event === 'onStateChange' ? d.info : null);
      if (st === null || st === undefined) return;
      var playing = st === 1;
      btn.classList.toggle('playing', playing);
      widget.classList.toggle('playing', playing);
    });
    /* if the surrounding environment blocks embedded playback, offer the way out */
    window.setTimeout(function () {
      var hint = document.getElementById('radioHint');
      if (hint) hint.hidden = false;
    }, 6000);
    widget.classList.add('playing');
    btn.setAttribute('aria-pressed', 'true');
    if (icoPlay) icoPlay.hidden = true;
    if (icoPause) icoPause.hidden = false;
    play.setAttribute('aria-label', 'Radio loaded — use the player controls');
  }

  btn.addEventListener('click', function () {
    var open = widget.hidden;
    widget.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) loadPlayer();
  });

  play.addEventListener('click', loadPlayer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !widget.hidden) {
      widget.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
  document.addEventListener('click', function (e) {
    if (!widget.hidden && !widget.contains(e.target) && !btn.contains(e.target)) {
      widget.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();
