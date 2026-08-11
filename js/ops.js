/* ═══ Operations bar ═══
   A real clock, real flyouts, and a lantern that means something:
   light = someone is there. */

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── live clock · CAIRO ── */
  const clock = document.getElementById('opsClock');
  if (clock) {
    let fmt = null;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    } catch (e) { fmt = null; }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function tick() {
      /* the Chapter 03 freeze is a genuine full stop — even the clock holds */
      if (document.body.classList.contains('frozen')) return;
      const now = new Date();
      let text;
      if (fmt) {
        text = fmt.format(now);
      } else {
        text = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      }
      clock.textContent = text;
      clock.setAttribute('datetime', now.toISOString());
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── lantern: click warms the whole page for ~2s ── */
  const lantern = document.getElementById('lanternBtn');
  const ripple = document.getElementById('lanternRipple');
  let warmTimer = null;

  if (lantern && ripple) {
    lantern.addEventListener('click', function () {
      const r = lantern.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      document.body.classList.remove('warmed');
      // force restart of the warm settle animation
      void document.body.offsetWidth;
      document.body.classList.add('warmed');

      if (!reduced) {
        const span = Math.max(window.innerWidth, window.innerHeight) * 2.4;
        ripple.style.transition = 'none';
        ripple.style.transform = 'translate(' + cx + 'px,' + cy + 'px) scale(1)';
        ripple.style.opacity = '0.9';
        void ripple.offsetWidth;
        ripple.style.transition = 'transform 2s cubic-bezier(0.22,0.61,0.24,1), opacity 2s cubic-bezier(0.22,0.61,0.24,1)';
        ripple.style.transform = 'translate(' + cx + 'px,' + cy + 'px) scale(' + (span / 10) + ')';
        ripple.style.opacity = '0';
      }

      clearTimeout(warmTimer);
      warmTimer = setTimeout(function () {
        document.body.classList.remove('warmed');
      }, 2200);
    });
  }

  /* ── signal icon: toggles the ambient listening rhythm (visual only) ── */
  const signalBtn = document.getElementById('signalBtn');
  if (signalBtn) {
    signalBtn.addEventListener('click', function () {
      const on = document.body.classList.toggle('signalOn');
      signalBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
})();

/* ── night radio: embedded YouTube player (دايماً مع بعض) ── */
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
  var timeEl = document.getElementById('radioTime');
  var player = null;
  var apiLoading = false;
  var wantPlay = false;

  function fmt(s) {
    s = Math.floor(s || 0);
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function setPlaying(playing) {
    widget.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (icoPlay) icoPlay.hidden = playing;
    if (icoPause) icoPause.hidden = !playing;
  }

  var ticker = null;
  function tick() {
    if (player && player.getCurrentTime && timeEl) {
      try {
        timeEl.textContent = fmt(player.getCurrentTime()) + ' / ' + fmt(player.getDuration()) + ' · via YouTube';
      } catch (e) { /* player not ready */ }
    }
  }

  function createPlayer() {
    if (screenWrap) screenWrap.hidden = false;
    player = new YT.Player('radioScreen', {
      host: 'https://www.youtube-nocookie.com',
      videoId: VIDEO_ID,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        loop: 1,
        playlist: VIDEO_ID,
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onReady: function () { if (wantPlay) player.playVideo(); },
        onStateChange: function (e) {
          var playing = e.data === YT.PlayerState.PLAYING;
          setPlaying(playing);
          if (playing && !ticker) ticker = window.setInterval(tick, 1000);
          if (!playing && ticker) { window.clearInterval(ticker); ticker = null; }
        }
      }
    });
  }

  function ensureAPI() {
    if (window.YT && window.YT.Player) { createPlayer(); return; }
    if (apiLoading) return;
    apiLoading = true;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (prev) prev();
      createPlayer();
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  btn.addEventListener('click', function () {
    var open = widget.hidden;
    widget.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && !player) { wantPlay = false; ensureAPI(); }
  });

  play.addEventListener('click', function () {
    if (!player || !player.playVideo) { wantPlay = true; ensureAPI(); return; }
    var state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !widget.hidden) {
      if (player && player.pauseVideo) { try { player.pauseVideo(); } catch (err) {} }
      widget.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
  document.addEventListener('click', function (e) {
    if (!widget.hidden && !widget.contains(e.target) && !btn.contains(e.target)) {
      widget.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      /* music keeps playing when tucked away — it is a radio */
      if (widget.classList.contains('playing')) btn.setAttribute('aria-pressed', 'true');
    }
  });
})();
