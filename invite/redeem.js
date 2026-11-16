/**
 * Serayae — accepting a guardian invitation from the browser, with no account.
 *
 * ADR-0016 (16 Nov 2026). The guardian proves they hold the invited number:
 *
 *   1. POST /api/referrals/invite/code    { token }        → Akedly sends a code
 *      to the number the invite was MADE FOR. Nothing typed here can redirect
 *      it, and the response never contains the number.
 *   2. POST /api/referrals/invite/confirm { token, code }  → CONFIRMED; the
 *      person who invited them is notified.
 *
 * The old flow signed the guardian in (send-otp / verify-otp) and redeemed with
 * a bearer token, which created an account as a side effect. That is gone.
 *
 * Rules this file holds to:
 *   - Never report success unless response.ok AND body.success === true. The
 *     default branch of every status switch is a failure.
 *   - One request at a time (`inFlight`): each "send" is a real message and costs
 *     money; double taps must not double-send.
 *   - Once confirmed, nothing may contradict it (`confirmed` latch).
 *   - The API origin is fixed: a query-param override would turn this link into
 *     an exfiltration primitive.
 *   - The token is never logged or stored.
 *   - Arabic copy is gender-neutral.
 */
(function () {
  'use strict';

  var API_BASE = 'https://serayae-api-01118af29270.herokuapp.com/api';
  var TOKEN_RE = /^[a-z0-9]{16,64}$/i;
  var CODE_RE = /^[0-9]{4,8}$/;

  var el = {
    form: document.getElementById('acceptForm'),
    startStep: document.getElementById('startStep'),
    codeStep: document.getElementById('codeStep'),
    code: document.getElementById('codeInput'),
    sendBtn: document.getElementById('sendCodeBtn'),
    acceptBtn: document.getElementById('acceptBtn'),
    resendBtn: document.getElementById('resendCodeBtn'),
    statusEn: document.getElementById('acceptStatusEn'),
    statusAr: document.getElementById('acceptStatusAr'),
    statusBox: document.getElementById('acceptStatus')
  };
  if (!el.form) return;

  function inviteToken() {
    var shared = window.SERAYAE_INVITE && window.SERAYAE_INVITE.token;
    if (shared && TOKEN_RE.test(shared)) return shared;
    var q = new URLSearchParams(window.location.search).get('t');
    if (q && TOKEN_RE.test(q)) return q;
    var seg = window.location.pathname.split('/').filter(Boolean);
    var last = seg[seg.length - 1];
    if (last && last !== 'invite' && TOKEN_RE.test(last)) return last;
    return null;
  }

  function say(tone, msg) {
    el.statusEn.textContent = msg.en;
    el.statusAr.textContent = msg.ar;
    el.statusBox.className = 'result result-' + tone;
    el.statusBox.hidden = false;
  }

  function busy(button, label) {
    button.disabled = true;
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = label;
  }
  function idle(button) {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
  }

  function call(path, body) {
    return window
      .fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store'
      })
      .then(
        function (response) {
          return response.text().then(
            function (text) {
              var parsed = null;
              try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = null; }
              return { ok: response.ok, status: response.status, body: parsed };
            },
            function () { return { ok: response.ok, status: response.status, body: null }; }
          );
        },
        function () { return { ok: false, status: 0, body: null }; }
      );
  }

  function succeeded(res) {
    return res.ok && res.body && res.body.success === true && res.body.data;
  }
  function codeOf(res) {
    return (res.body && res.body.code) || '';
  }

  // ── Messages ────────────────────────────────────────────────────────────
  var M = {
    noToken: {
      en: 'This link is incomplete. Open the invitation link exactly as you received it.',
      ar: 'هذا الرابط غير مكتمل. يُرجى فتح رابط الدعوة كما وصل تمامًا.'
    },
    network: {
      en: 'We could not reach Serayae just now, so nothing has changed. Check your connection and try again.',
      ar: 'تعذّر الوصول إلى Serayae الآن، ولم يتغيّر شيء. يُرجى التحقق من الاتصال والمحاولة مرة أخرى.'
    },
    server: {
      en: 'Something went wrong on our side, so nothing has changed. Try again in a minute.',
      ar: 'حدث خطأ من جهتنا، ولم يتغيّر شيء. يُرجى المحاولة بعد دقيقة.'
    },
    notFound: {
      en: 'This invitation link is not valid. Ask the person who invited you to send a new one.',
      ar: 'رابط الدعوة هذا غير صالح. يُرجى طلب دعوة جديدة من صاحبها.'
    },
    gone: {
      en: 'This invitation has expired or was withdrawn. Ask the person who invited you to send a new one.',
      ar: 'انتهت صلاحية هذه الدعوة أو تم سحبها. يُرجى طلب دعوة جديدة من صاحبها.'
    },
    notOpen: {
      en: 'This invitation is no longer open. Ask the person who invited you to send a new one.',
      ar: 'هذه الدعوة لم تعد متاحة. يُرجى طلب دعوة جديدة من صاحبها.'
    },
    unusable: {
      en: "We can't send a code to the number saved in this invitation. Ask them to save your number with the country code (for example +20) and send a new invitation.",
      ar: 'تعذّر إرسال رمز إلى الرقم المحفوظ في هذه الدعوة. يُرجى طلب حفظ الرقم مع رمز الدولة (مثل +20) وإرسال دعوة جديدة.'
    },
    tooMany: {
      en: 'Too many codes were sent to this number. Wait 15 minutes, then try again.',
      ar: 'تم إرسال عدد كبير من الرموز إلى هذا الرقم. يُرجى الانتظار 15 دقيقة ثم المحاولة مرة أخرى.'
    },
    codeDown: {
      en: "We couldn't send the code right now. Try again in a minute.",
      ar: 'تعذّر إرسال الرمز الآن. يُرجى المحاولة بعد دقيقة.'
    },
    sent: {
      en: 'Code sent to the number this invitation was made for. Check WhatsApp first, then your text messages.',
      ar: 'تم إرسال الرمز إلى الرقم المرتبط بهذه الدعوة. يُرجى التحقق من واتساب أولًا، ثم الرسائل النصية.'
    },
    enterCode: {
      en: 'Enter the code you received. It is 4 to 8 digits.',
      ar: 'يُرجى إدخال الرمز المستلَم، وهو من 4 إلى 8 أرقام.'
    },
    wrongCode: {
      en: "That code didn't work, so nothing has changed. Check it, or send a new one.",
      ar: 'الرمز غير صحيح، ولم يتغيّر شيء. يُرجى التحقق منه أو طلب رمز جديد.'
    },
    full: {
      en: 'The person who invited you already has the most guardians their plan allows. They need to remove one first. Your invitation stays open; try again after they do.',
      ar: 'وصل صاحب الدعوة إلى الحد الأقصى لعدد الأوصياء في خطته، ويلزم حذف أحدهم أولًا. تبقى الدعوة مفتوحة، ويمكن المحاولة مجددًا بعد ذلك.'
    },
    done: function (name) {
      var who = name ? name : 'The person who invited you';
      return {
        en: "Invitation accepted. " + who + ' has been told. Nothing is shared with you until they raise an alert.',
        ar: 'تم قبول الدعوة، وتم إبلاغ ' + (name || 'صاحب الدعوة') + '. لا تتم مشاركة أي شيء معك إلا عند إطلاق تنبيه.'
      };
    },
    already: {
      en: 'This invitation is already confirmed. There is nothing more to do.',
      ar: 'تم تأكيد هذه الدعوة مسبقًا، ولا توجد خطوات أخرى.'
    }
  };

  /** Shared refusals from either endpoint. Default is a failure, never success. */
  function refusal(res) {
    if (res.status === 0) return M.network;
    switch (codeOf(res)) {
      case 'INVITE_NOT_FOUND':
      case 'INVITE_TOKEN_REQUIRED':
      case 'INVITE_NOT_REDEEMABLE':
        return M.notFound;
      case 'INVITE_GONE':
        return M.gone;
      case 'INVITE_NOT_PENDING':
        return M.notOpen;
      case 'INVITE_PHONE_UNUSABLE':
        return M.unusable;
      case 'INVITE_CODE_RATE_LIMITED':
        return M.tooMany;
      case 'INVITE_CODE_UNAVAILABLE':
        return M.codeDown;
      case 'INVITE_CODE_INVALID':
        return M.wrongCode;
      case 'GUARDIAN_ALLOWANCE_REACHED':
        return M.full;
    }
    if (res.status === 429) return M.tooMany;
    if (res.status === 404) return M.notFound;
    if (res.status === 410) return M.gone;
    return M.server;
  }

  var inFlight = false;
  var confirmed = false;

  function finish(msg) {
    confirmed = true;
    el.form.hidden = true;
    say('ok', msg);
  }

  function sendCode(button) {
    if (inFlight || confirmed) return;
    var token = inviteToken();
    if (!token) { say('warn', M.noToken); return; }

    inFlight = true;
    busy(button, 'Sending…');
    call('/referrals/invite/code', { token: token }).then(function (res) {
      inFlight = false;
      idle(button);
      if (confirmed) return;
      var data = succeeded(res);
      if (data) {
        if (data.alreadyConfirmed) { finish(M.already); return; }
        el.startStep.hidden = true;
        el.codeStep.hidden = false;
        say('plain', M.sent);
        el.code.focus();
        return;
      }
      say('warn', refusal(res));
    });
  }

  function accept() {
    if (inFlight || confirmed) return;
    var token = inviteToken();
    if (!token) { say('warn', M.noToken); return; }
    var code = String(el.code.value || '').replace(/\s+/g, '');
    if (!CODE_RE.test(code)) { say('warn', M.enterCode); el.code.focus(); return; }

    inFlight = true;
    busy(el.acceptBtn, 'Checking…');
    call('/referrals/invite/confirm', { token: token, code: code }).then(function (res) {
      inFlight = false;
      idle(el.acceptBtn);
      if (confirmed) return;
      var data = succeeded(res);
      if (data && data.confirmed === true) {
        finish(data.alreadyConfirmed ? M.already : M.done(data.inviterName));
        return;
      }
      say('warn', refusal(res));
    });
  }

  el.sendBtn.addEventListener('click', function () { sendCode(el.sendBtn); });
  el.resendBtn.addEventListener('click', function () { el.code.value = ''; sendCode(el.resendBtn); });
  el.acceptBtn.addEventListener('click', accept);
  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!el.codeStep.hidden) accept();
  });
  el.code.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); accept(); }
  });
})();
