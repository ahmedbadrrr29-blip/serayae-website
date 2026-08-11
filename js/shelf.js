/* ═══ THE SHELF ═══
   Five objects on a warm strip at the hero's bottom edge. Each one is a real
   action, not an icon: the lantern warms the page, the ledger and the signal
   open their records, the cassette wakes the night radio, the envelope walks
   you to the waitlist. The cassette sticker in the field does the same thing. */

(function () {
  function click(id) {
    var el = document.getElementById(id);
    if (el) el.click();
  }

  var lantern = document.getElementById('shelfLantern');
  if (lantern) lantern.addEventListener('click', function () { click('lanternBtn'); });

  /* the radio closes itself on any outside click, and our own click is still
     bubbling toward document — so open it on the next tick, after that pass */
  function openRadioDeferred() {
    window.setTimeout(openRadio, 0);
  }

  function openRadio() {
    var widget = document.getElementById('radioWidget');
    var btn = document.getElementById('radioBtn');
    if (!btn) return;
    /* the radio button toggles; from the shelf it should only ever open */
    if (widget && !widget.hidden) {
      var play = document.getElementById('radioPlay');
      if (play) play.click();
      return;
    }
    btn.click();
  }

  var radio = document.getElementById('shelfRadio');
  if (radio) radio.addEventListener('click', openRadioDeferred);

  var cassette = document.getElementById('cassetteSticker');
  if (cassette) {
    cassette.addEventListener('click', function (ev) {
      /* a drag is not a click — artifacts.js flags the difference */
      if (cassette.dataset.suppressClick) return;
      ev.preventDefault();
      openRadioDeferred();
    });
  }

  var envelope = document.getElementById('shelfEnvelope');
  if (envelope) {
    envelope.addEventListener('click', function () {
      var wl = document.getElementById('waitlist');
      if (!wl) return;
      wl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var input = wl.querySelector('input');
      if (input) window.setTimeout(function () { input.focus({ preventScroll: true }); }, 700);
    });
  }
})();

/* release focus after mouse clicks so tooltips never stick open */
document.querySelectorAll('.shelf-item').forEach(function (el) {
  el.addEventListener('click', function () {
    window.setTimeout(function () { el.blur(); }, 80);
  });
});
