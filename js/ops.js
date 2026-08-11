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

/* ── night radio: the film's score, played on request ── */
(function () {
  var btn = document.getElementById('radioBtn');
  var widget = document.getElementById('radioWidget');
  var play = document.getElementById('radioPlay');
  var audio = document.getElementById('radioAudio');
  if (!btn || !widget || !play || !audio) return;
  var icoPlay = play.querySelector('.radio-ico-play');
  var icoPause = play.querySelector('.radio-ico-pause');
  var timeEl = document.getElementById('radioTime');
  audio.volume = 0.65;

  function syncUI() {
    var playing = !audio.paused;
    widget.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (icoPlay) icoPlay.hidden = playing;
    if (icoPause) icoPause.hidden = !playing;
  }

  btn.addEventListener('click', function () {
    var open = widget.hidden;
    widget.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  play.addEventListener('click', function () {
    if (audio.paused) { audio.play().catch(function () {}); }
    else { audio.pause(); }
  });

  audio.addEventListener('play', syncUI);
  audio.addEventListener('pause', syncUI);
  audio.addEventListener('timeupdate', function () {
    if (!timeEl || audio.paused) return;
    var t = Math.floor(audio.currentTime);
    timeEl.textContent = '0:' + (t < 10 ? '0' : '') + t + ' / 1:00 · loops';
  });

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
