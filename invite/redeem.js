/**
 * SERAYAE — accepting a guardian invitation from the browser.
 *
 * Why this file exists
 * -------------------
 * `POST /api/referrals/redeem` is the only transition into `CONFIRMED`, and
 * `CONFIRMED` is the only status any dispatch path contacts. It was built,
 * reviewed and merged — and no client called it. The mobile app is not published
 * in any store, so until it is, this page is the ONLY route a real invited
 * guardian has. Without it the "0 guardians can be reached" warning the app now
 * shows honestly is a warning the user cannot act on.
 *
 * The path, derived from the backend source (not from prose)
 * --------------------------------------------------------
 *   1. POST /api/auth/send-otp     { phone }              unauthenticated
 *   2. POST /api/auth/verify-otp   { phone, code, name? } unauthenticated → Bearer token
 *   3. POST /api/referrals/redeem  { token }              Authorization: Bearer
 *
 * Step 2 is what makes step 3 possible at all: `redeemGuardianInvite` compares
 * the CALLER'S OWN account phone against the number the invite was issued to
 * (`src/lib/guardianInvite.ts:657` — `phonesMatch(caller.phone, referral.invitedPhone)`).
 * The only way a browser can hold such an account phone is to prove the number
 * by OTP, which `POST /api/auth/verify-otp` does — and which creates the account
 * if she does not have one (`src/routes/auth.ts:105-114`). That side effect is
 * stated on the page in both languages; it is not hidden.
 *
 * Rules this file holds to
 * -----------------------
 *   - **Never report success on a non-2xx.** A previous round of this page
 *     shipped a button that claimed success on any outcome. Every branch here
 *     starts from `response.ok` AND `body.success === true`; everything else
 *     falls into a named failure. The `default:` case of the status switch is a
 *     failure, so an undocumented status cannot become a success by omission.
 *   - **Never claim more than happened.** Accepting means an SOS will reach her
 *     at this number. It does not mean she is tracking anybody, and she sees
 *     nothing at all until an emergency.
 *   - No token is written to localStorage, sessionStorage, a cookie or the URL.
 *     The access token lives in a local variable for the length of one redeem
 *     call and is dropped. The refresh token from `verify-otp` is discarded
 *     unread — this page has no business holding a 90-day credential.
 *   - `POST /api/auth/logout` is deliberately NOT called afterwards: it calls
 *     `revokeAllUserTokens` (`src/routes/auth.ts:311`), which would sign her out
 *     of the app on her phone as a side effect of tidying up a web page.
 *   - The API origin is fixed, as in invite.js and track.js: a query-param
 *     override would turn this link into a credential-exfiltration primitive.
 */
(function () {
  'use strict';

  var API_BASE = 'https://solra-backend-production.up.railway.app/api';

  /** Same alphabet/length bound as invite.js. Referral tokens are cuids. */
  var TOKEN_RE = /^[a-z0-9]{16,64}$/i;

  /**
   * `verifyOtpSchema` (src/validators/schemas.ts:15) requires
   * `^\+[0-9]+$`, min 10 max 15 characters INCLUDING the plus. Anything else is
   * a 400 from the server, so it is caught here where a useful sentence can be
   * shown instead.
   */
  var E164_RE = /^\+[0-9]{9,14}$/;

  /** Matches the backend's DEFAULT_COUNTRY_CALLING_CODE = '20' (src/lib/phone.ts). */
  var DEFAULT_CC = '20';

  // ── DOM ────────────────────────────────────────────────────────────────────
  var el = {
    form: document.getElementById('acceptForm'),
    phoneStep: document.getElementById('phoneStep'),
    codeStep: document.getElementById('codeStep'),
    phone: document.getElementById('phoneInput'),
    phoneEcho: document.getElementById('phoneEcho'),
    name: document.getElementById('nameInput'),
    code: document.getElementById('codeInput'),
    sendBtn: document.getElementById('sendCodeBtn'),
    acceptBtn: document.getElementById('acceptBtn'),
    changeBtn: document.getElementById('changeNumberBtn'),
    resendBtn: document.getElementById('resendCodeBtn'),
    statusEn: document.getElementById('acceptStatusEn'),
    statusAr: document.getElementById('acceptStatusAr'),
    statusBox: document.getElementById('acceptStatus')
  };

  if (!el.form) return;

  var provenPhone = null; // the E.164 string she is proving, once accepted by step 1

  function inviteToken() {
    var shared = window.SERAYAE_INVITE && window.SERAYAE_INVITE.token;
    if (shared && TOKEN_RE.test(shared)) return shared;

    // Fallback for the case where this script runs before invite.js has scrubbed
    // the URL, or invite.js failed to load at all.
    var q = new URLSearchParams(window.location.search).get('t');
    if (q && TOKEN_RE.test(q)) return q;
    var seg = window.location.pathname.split('/').filter(Boolean);
    var last = seg[seg.length - 1];
    if (last && last !== 'invite' && TOKEN_RE.test(last)) return last;
    return null;
  }

  /**
   * Says something, in both languages, and says what state it leaves things in.
   * `tone` is 'ok' | 'warn' | 'plain'. Ember (#BD3103) marks a warning; Red
   * (#DC2626) is emergency-only and appears nowhere on this page.
   */
  function say(tone, en, ar) {
    el.statusEn.textContent = en;
    el.statusAr.textContent = ar;
    el.statusBox.className = 'result result-' + tone;
    el.statusBox.hidden = false;
  }

  function clearStatus() {
    el.statusBox.hidden = true;
    el.statusEn.textContent = '';
    el.statusAr.textContent = '';
  }

  function busy(button, label) {
    button.disabled = true;
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = label;
  }

  function idle(button, label) {
    button.disabled = false;
    button.textContent = label || button.dataset.label || button.textContent;
  }

  /**
   * Turns what a woman in Egypt actually types into E.164, and refuses to guess
   * when it cannot. Returns `{ phone }` or `{ error: {en, ar} }`.
   *
   * The normalisation mirrors the server's: a bare national number is promoted
   * with the default country code, `00` is an international prefix. Anything
   * that does not resolve is REFUSED with an explanation rather than silently
   * prefixed — a wrong country code would spend her one OTP and then fail the
   * phone match with a confusing 403.
   */
  function toE164(raw) {
    var trimmed = String(raw || '').trim();
    var hadPlus = trimmed.charAt(0) === '+';
    var digits = trimmed.replace(/[^0-9]/g, '');

    if (!digits) {
      return {
        error: {
          en: 'Enter the phone number the invitation was sent to.',
          ar: 'اكتبي الرقم الذي وصلتك عليه الدعوة.'
        }
      };
    }

    var phone;
    if (hadPlus) phone = '+' + digits;
    else if (digits.slice(0, 2) === '00') phone = '+' + digits.slice(2);
    else if (digits.charAt(0) === '0') phone = '+' + DEFAULT_CC + digits.slice(1);
    else if (digits.slice(0, 2) === DEFAULT_CC) phone = '+' + digits;
    else {
      return {
        error: {
          en:
            'Add the country code, starting with a plus — for example ' +
            '+20 for Egypt. We will not guess which country your number is in.',
          ar:
            'أضيفي رمز الدولة مع علامة الزائد — مثلًا +20 لمصر. لن نُخمّن دولة ' +
            'رقمك.'
        }
      };
    }

    if (!E164_RE.test(phone)) {
      return {
        error: {
          en:
            'That does not look like a complete phone number. SERAYAE needs it ' +
            'in full international form, like +201234567890.',
          ar:
            'لا يبدو هذا رقمًا كاملًا. اكتبيه بالصيغة الدولية الكاملة، مثل ' +
            '+201234567890.'
        }
      };
    }

    return { phone: phone };
  }

  /**
   * One place where a fetch becomes a plain object, so no caller can mistake a
   * network failure for a status code. `ok` is `response.ok`, `status` is 0 when
   * the request never completed.
   */
  function call(path, body, bearer) {
    var headers = { 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = 'Bearer ' + bearer;

    return window
      .fetch(API_BASE + path, {
        method: 'POST',
        headers: headers,
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
              try {
                parsed = text ? JSON.parse(text) : null;
              } catch (err) {
                parsed = null;
              }
              return { ok: response.ok, status: response.status, body: parsed };
            },
            function () {
              return { ok: response.ok, status: response.status, body: null };
            }
          );
        },
        function () {
          // DNS failure, offline, CORS refusal, TLS error: no status exists.
          return { ok: false, status: 0, body: null };
        }
      );
  }

  var NETWORK_FAILURE = {
    en:
      'We could not reach SERAYAE just now, so nothing has been changed. ' +
      'Check your connection and try again.',
    ar:
      'لم نتمكّن من الوصول إلى سراي الآن، ولم يتغيّر شيء. تحقّقي من اتصالك ' +
      'وأعيدي المحاولة.'
  };

  /*
   * Review I1. Two module-level latches, both of which exist because of a real
   * failure mode, not for tidiness.
   *
   * `inFlight` — one request at a time. Without it, two Enter presses on the code
   * step fire two verify-otp calls, and the LATER one's 401 overwrites the
   * earlier one's success, telling a woman who is now a CONFIRMED guardian that
   * nothing has been changed. On the phone step it is worse than confusing: each
   * press sends a real SMS, which is her money.
   *
   * `confirmed` — once redemption has succeeded, nothing may contradict it. Any
   * response that arrives afterwards is ignored rather than rendered, because a
   * late refusal on a page that has already truthfully said "you are now a
   * confirmed guardian" would be the false claim, not the correction.
   */
  var inFlight = false;
  var confirmed = false;

  function serverFault(status) {
    return {
      en:
        'Something went wrong at SERAYAE\u2019s end (status ' +
        status +
        '). Nothing has been changed. Please try again shortly.',
      ar:
        'حدث خطأ من جهة سراي (الحالة ' +
        status +
        '). لم يتغيّر شيء. أعيدي المحاولة بعد قليل.'
    };
  }

  // ── Step 1: prove the number ───────────────────────────────────────────────

  function requestCode(isResend) {
    if (confirmed || inFlight) return;

    var parsed = toE164(el.phone.value);
    if (parsed.error) {
      say('warn', parsed.error.en, parsed.error.ar);
      el.phone.focus();
      return;
    }

    var button = isResend ? el.resendBtn : el.sendBtn;
    clearStatus();
    inFlight = true;
    busy(button, isResend ? 'Sending…' : 'Sending…');

    call('/auth/send-otp', { phone: parsed.phone }).then(function (res) {
      inFlight = false;
      idle(button);
      if (confirmed) return;

      if (res.status === 0) {
        say('warn', NETWORK_FAILURE.en, NETWORK_FAILURE.ar);
        return;
      }

      // Success is a 2xx AND the envelope the API actually returns. Nothing else.
      if (res.ok && res.body && res.body.success === true) {
        provenPhone = parsed.phone;
        el.phoneEcho.textContent = parsed.phone;
        el.phoneStep.hidden = true;
        el.codeStep.hidden = false;
        el.code.focus();
        say(
          'plain',
          'We sent a 6-digit code by SMS to ' +
            parsed.phone +
            '. Enter it below to accept. The code proves the number is yours — ' +
            'it is the only thing that can.',
          'أرسلنا رمزًا من ٦ أرقام برسالة نصية إلى ' +
            parsed.phone +
            '. اكتبيه بالأسفل للقبول. الرمز يُثبت أن الرقم رقمك — وهو الشيء ' +
            'الوحيد الذي يُثبت ذلك.'
        );
        return;
      }

      if (res.status === 400) {
        say(
          'warn',
          'SERAYAE did not accept that number. Check it and try again — it ' +
            'needs the full international form, like +201234567890.',
          'لم تقبل سراي هذا الرقم. تحقّقي منه وأعيدي المحاولة بالصيغة الدولية ' +
            'الكاملة، مثل +201234567890.'
        );
        return;
      }

      if (res.status === 429) {
        say(
          'warn',
          'Too many attempts from this connection. Wait about fifteen minutes ' +
            'and try again. Nothing has been changed.',
          'محاولات كثيرة من هذا الاتصال. انتظري نحو خمس عشرة دقيقة ثم أعيدي ' +
            'المحاولة. لم يتغيّر شيء.'
        );
        return;
      }

      if (res.status === 503) {
        say(
          'warn',
          'SERAYAE could not send the SMS just now. No code is on its way. ' +
            'Try again in a moment.',
          'لم تستطع سراي إرسال الرسالة الآن، ولا يوجد رمز في الطريق إليك. ' +
            'أعيدي المحاولة بعد لحظات.'
        );
        return;
      }

      var fault = serverFault(res.status);
      say('warn', fault.en, fault.ar);
    });
  }

  // ── Steps 2 and 3: sign in with the proven number, then redeem ─────────────

  function acceptInvite() {
    if (confirmed || inFlight) return;

    var token = inviteToken();
    if (!token) {
      say(
        'warn',
        'This link is incomplete, so there is no invitation to accept. Open ' +
          'the full link from the message you received — some apps cut long ' +
          'links short.',
        'هذا الرابط غير مكتمل، فلا توجد دعوة لقبولها. افتحي الرابط كاملًا من ' +
          'الرسالة التي وصلتك — بعض التطبيقات تقطع الروابط الطويلة.'
      );
      return;
    }

    var code = String(el.code.value || '').replace(/[^0-9]/g, '');
    if (code.length !== 6) {
      say(
        'warn',
        'Enter the 6-digit code from the SMS.',
        'اكتبي الرمز المكوّن من ٦ أرقام الذي وصلك في الرسالة.'
      );
      el.code.focus();
      return;
    }

    if (!provenPhone) {
      say(
        'warn',
        'Start by asking for a code for your number.',
        'ابدئي بطلب رمز لرقمك.'
      );
      return;
    }

    clearStatus();
    inFlight = true;
    busy(el.acceptBtn, 'Accepting…');

    var payload = { phone: provenPhone, code: code };
    var typedName = String((el.name && el.name.value) || '').trim();
    if (typedName) payload.name = typedName.slice(0, 100);

    call('/auth/verify-otp', payload).then(function (res) {
      // The latch is NOT released here on the way through to redeem: sign-in and
      // redemption are one action from her side, and a second press between them
      // would sign in twice and redeem twice.
      if (res.status === 0) {
        inFlight = false;
        idle(el.acceptBtn);
        say('warn', NETWORK_FAILURE.en, NETWORK_FAILURE.ar);
        return;
      }

      if (!res.ok || !res.body || res.body.success !== true) {
        inFlight = false;
        idle(el.acceptBtn);

        if (res.status === 401) {
          say(
            'warn',
            'That code is wrong or has expired, so nothing has been changed. ' +
              'Ask for a new code and try again.',
            'الرمز غير صحيح أو انتهت صلاحيته، ولم يتغيّر شيء. اطلبي رمزًا ' +
              'جديدًا وأعيدي المحاولة.'
          );
          return;
        }
        if (res.status === 403) {
          say(
            'warn',
            'This number cannot sign in to SERAYAE. Nothing has been changed. ' +
              'Tell the person who invited you, so they know their alert will ' +
              'not reach you here.',
            'هذا الرقم لا يستطيع تسجيل الدخول إلى سراي، ولم يتغيّر شيء. ' +
              'أخبري من دعاكِ حتى يعرف أن نداءه لن يصلك على هذا الرقم.'
          );
          return;
        }
        if (res.status === 429) {
          say(
            'warn',
            'Too many sign-in attempts from this connection. Wait about ' +
              'fifteen minutes and try again. Nothing has been changed.',
            'محاولات دخول كثيرة من هذا الاتصال. انتظري نحو خمس عشرة دقيقة ثم ' +
              'أعيدي المحاولة. لم يتغيّر شيء.'
          );
          return;
        }
        if (res.status === 400) {
          say(
            'warn',
            'SERAYAE did not accept that number or code. Check both and try ' +
              'again.',
            'لم تقبل سراي الرقم أو الرمز. تحقّقي منهما وأعيدي المحاولة.'
          );
          return;
        }

        var fault = serverFault(res.status);
        say('warn', fault.en, fault.ar);
        return;
      }

      var access = res.body.data && res.body.data.token;
      // The 90-day refreshToken in the same response is deliberately not read,
      // not stored, and not used. This page needs one call's worth of identity.
      if (!access) {
        inFlight = false;
        idle(el.acceptBtn);
        var noToken = serverFault(res.status);
        say('warn', noToken.en, noToken.ar);
        return;
      }

      redeem(token, access);
    });
  }

  /**
   * The whole point. Every documented outcome of
   * `POST /api/referrals/redeem` gets its own honest sentence, and only a 2xx
   * with `success: true` is reported as acceptance.
   */
  function redeem(inviteTok, access) {
    call('/referrals/redeem', { token: inviteTok }, access).then(function (res) {
      access = null; // dropped as soon as the one call it exists for is done
      inFlight = false;
      idle(el.acceptBtn);
      if (confirmed) return; // an already-earned confirmation is never overwritten

      if (res.status === 0) {
        say(
          'warn',
          'You are signed in, but we could not reach SERAYAE to accept the ' +
            'invitation, so you are NOT a confirmed guardian yet. Press ' +
            '“Accept the invitation” again in a moment.',
          'تم تسجيل دخولك، لكننا لم نتمكّن من الوصول إلى سراي لقبول الدعوة، ' +
            'فأنتِ لستِ وليّة أمان مؤكَّدة بعد. اضغطي «اقبلي الدعوة» مرة أخرى ' +
            'بعد قليل.'
        );
        return;
      }

      var body = res.body || {};
      var data = body.data || {};

      if (res.ok && body.success === true) {
        var who = data.inviterName ? String(data.inviterName).slice(0, 60) : null;

        if (data.alreadyConfirmed) {
          say(
            'ok',
            'This invitation had already been accepted with this number' +
              (who ? ', for ' + who : '') +
              '. Nothing more to do: if an SOS is sent, SERAYAE will contact ' +
              'you at this number.',
            'سبق قبول هذه الدعوة بهذا الرقم' +
              (who ? ' لـ ' + who : '') +
              '. لا شيء آخر مطلوب: عند إرسال نداء استغاثة، ستتصل بك سراي على ' +
              'هذا الرقم.'
          );
        } else {
          say(
            'ok',
            'Accepted' +
              (who ? ' — you are now a confirmed guardian for ' + who : ' — you are now a confirmed guardian') +
              '. If an SOS is sent, SERAYAE will contact you at this number. ' +
              'That is the whole change: you are not following anyone, and you ' +
              'will see nothing until there is an emergency.',
            'تم القبول' +
              (who ? ' — أنتِ الآن وليّة أمان مؤكَّدة لـ ' + who : ' — أنتِ الآن وليّة أمان مؤكَّدة') +
              '. عند إرسال نداء استغاثة، ستتصل بك سراي على هذا الرقم. هذا كل ' +
              'ما تغيّر: لا تتابعين موقع أحد، ولن ترَي شيئًا حتى تحدث حالة ' +
              'طوارئ.'
          );
        }

        /*
         * Review C1. This used to be `el.form.hidden = true`, and #acceptStatus
         * was a CHILD of that form — so the woman who had just become a
         * CONFIRMED guardian was shown a blank space, on a page whose remaining
         * copy still said an SOS would not reach her. The single moment this
         * whole week exists to produce rendered nothing.
         *
         * Now: the status box lives outside the form (index.html), the form
         * itself is never hidden, and only its two step containers are retired.
         * The controls are also disabled so that a stray Enter cannot re-fire.
         */
        confirmed = true;
        el.codeStep.hidden = true;
        el.phoneStep.hidden = true;
        el.sendBtn.disabled = true;
        el.acceptBtn.disabled = true;
        el.resendBtn.disabled = true;
        el.changeBtn.disabled = true;
        el.phone.disabled = true;
        el.code.disabled = true;
        if (el.name) el.name.disabled = true;
        return;
      }

      // ── Everything below is a refusal. Nothing was confirmed. ──────────────
      var code = body.code || '';
      var serverText = typeof body.error === 'string' ? body.error : '';

      switch (res.status) {
        case 400:
          say(
            'warn',
            'The invitation link was incomplete, so there was nothing to ' +
              'accept. Open the full link from your message.',
            'كان رابط الدعوة غير مكتمل، فلا شيء لقبوله. افتحي الرابط كاملًا من ' +
              'رسالتك.'
          );
          return;

        case 403:
          if (code === 'GUARDIAN_ALLOWANCE_REACHED') {
            say(
              'warn',
              (serverText ||
                'The person who invited you has no free guardian place left.') +
                ' Your invitation is still valid — try again once they remove ' +
                'someone or upgrade. You are not a confirmed guardian yet.',
              'لا يوجد مكان متاح لوليّ أمان جديد عند من دعاكِ. دعوتك ما زالت ' +
                'صالحة — أعيدي المحاولة بعد أن يُخلي مكانًا أو يرفع خطته. ' +
                'أنتِ لستِ وليّة أمان مؤكَّدة بعد.'
            );
            return;
          }
          // INVITE_PHONE_MISMATCH — one message for every "not your token" case,
          // matching the backend, which refuses to say which guess was closest.
          say(
            'warn',
            'This invitation was sent to a different phone number, so it was ' +
              'not accepted and nothing has been changed. Use the number the ' +
              'message arrived on.',
            'أُرسلت هذه الدعوة إلى رقم آخر، فلم يتم قبولها ولم يتغيّر شيء. ' +
              'استخدمي الرقم الذي وصلتك عليه الرسالة.'
          );
          return;

        case 404:
          say(
            'warn',
            'This invitation is not valid any more — the link may be wrong, or ' +
              'the person who sent it has since removed this number. Ask them ' +
              'to send a new invitation.',
            'هذه الدعوة لم تعد صالحة — قد يكون الرابط خطأً، أو حُذف هذا الرقم ' +
              'من قائمته. اطلبي منه إرسال دعوة جديدة.'
          );
          return;

        case 409:
          /*
           * Review I2. Two different states share this status and they are not
           * the same thing. INVITE_NOT_REDEEMABLE means the link was never a
           * guardian invitation (guardianInvite.ts:641). INVITE_NOT_PENDING
           * means it was, and the place it was for is no longer waiting for an
           * answer — declined, or changed by the person who invited her
           * (guardianConsent.ts:152-158). Telling her the second is the first
           * would send her looking for a problem with the link that does not
           * exist, when what she needs is a fresh invitation.
           */
          if (code === 'INVITE_NOT_PENDING') {
            say(
              'warn',
              'This invitation is no longer waiting for an answer' +
                (serverText ? ' — SERAYAE says: ' + serverText : '') +
                '. It was a guardian invitation, but its place has since been ' +
                'declined or changed by the person who sent it. Nothing has ' +
                'been changed, and you are not a confirmed guardian. Ask them ' +
                'to invite this number again.',
              'هذه الدعوة لم تعد تنتظر ردًّا. كانت دعوة وليّ أمان بالفعل، لكن ' +
                'مكانها رُفض أو غيّره من أرسلها. لم يتغيّر شيء، وأنتِ لستِ ' +
                'وليّة أمان مؤكَّدة. اطلبي منه دعوة هذا الرقم من جديد.'
            );
            return;
          }
          say(
            'warn',
            'This link is a general invitation to SERAYAE, not a guardian ' +
              'invitation, so there is nothing to accept here.',
            'هذا الرابط دعوة عامة إلى سراي وليس دعوة وليّ أمان، فلا شيء لقبوله ' +
              'هنا.'
          );
          return;

        case 410:
          say(
            'warn',
            (serverText || 'This invitation has expired or was withdrawn.') +
              ' Nothing has been changed, and you are not a confirmed guardian.',
            'انتهت صلاحية هذه الدعوة أو تم سحبها. لم يتغيّر شيء، وأنتِ لستِ ' +
              'وليّة أمان مؤكَّدة.'
          );
          return;

        case 429:
          say(
            'warn',
            'Too many attempts. Wait about fifteen minutes and try again — the ' +
              'invitation is still valid. Nothing has been changed.',
            'محاولات كثيرة. انتظري نحو خمس عشرة دقيقة ثم أعيدي المحاولة — ' +
              'الدعوة ما زالت صالحة. لم يتغيّر شيء.'
          );
          return;

        case 401:
          say(
            'warn',
            'Your sign-in expired before the invitation was accepted. Ask for ' +
              'a new code and try again. Nothing has been changed.',
            'انتهت صلاحية تسجيل دخولك قبل قبول الدعوة. اطلبي رمزًا جديدًا ' +
              'وأعيدي المحاولة. لم يتغيّر شيء.'
          );
          return;

        default:
          // An undocumented status can never fall through into success.
          var fault = serverFault(res.status);
          say('warn', fault.en, fault.ar);
          return;
      }
    });
  }

  // ── Wiring ────────────────────────────────────────────────────────────────

  /*
   * The two primary controls are `type="button"`, not submit buttons, so a press
   * takes exactly ONE path. The form's submit handler exists only for the
   * keyboard: pressing Enter in an input still does the obvious thing, and it
   * cannot double-fire alongside a click.
   */
  el.form.addEventListener('submit', function (event) {
    event.preventDefault();
    // Review I1: Enter is the easiest way to double-fire, so the guard is stated
    // here too rather than relying only on the callees.
    if (confirmed || inFlight) return;
    if (!el.codeStep.hidden) acceptInvite();
    else requestCode(false);
  });

  el.sendBtn.addEventListener('click', function (event) {
    event.preventDefault();
    requestCode(false);
  });

  el.acceptBtn.addEventListener('click', function (event) {
    event.preventDefault();
    acceptInvite();
  });

  el.resendBtn.addEventListener('click', function (event) {
    event.preventDefault();
    requestCode(true);
  });

  el.changeBtn.addEventListener('click', function (event) {
    event.preventDefault();
    // Nothing may un-retire the form once she is confirmed, and nothing may
    // change the number out from under a request that is already in the air.
    if (confirmed || inFlight) return;
    provenPhone = null;
    el.code.value = '';
    el.codeStep.hidden = true;
    el.phoneStep.hidden = false;
    clearStatus();
    el.phone.focus();
  });

  /*
   * If the link carries no usable token there is nothing to accept, and a form
   * that cannot succeed must not pretend otherwise. The form is left visible but
   * disabled with the reason stated, rather than hidden — a hidden control is a
   * promise waiting to be re-enabled by accident.
   */
  if (!inviteToken()) {
    el.sendBtn.disabled = true;
    el.acceptBtn.disabled = true;
    el.phone.disabled = true;
    say(
      'warn',
      'This link does not contain an invitation, so there is nothing to accept ' +
        'here. Open the full link from the message you received.',
      'هذا الرابط لا يحتوي على دعوة، فلا شيء لقبوله هنا. افتحي الرابط كاملًا ' +
        'من الرسالة التي وصلتك.'
    );
  }
})();
