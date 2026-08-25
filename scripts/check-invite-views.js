/**
 * Simulates invite.js against both token shapes with a minimal DOM stub.
 * Run: node scripts/check-invite-views.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'invite', 'invite.js'), 'utf8');

function makeEl(id) {
  return {
    id, hidden: false, textContent: '', style: {}, attrs: {}, parentNode: { insertBefore() {} },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener() {},
  };
}

function run(url) {
  const u = new URL(url);
  const els = {};
  ['view', 'referralView', 'refCodeEcho', 'getSerayae', 'openApp', 'stopInvites', 'stopResult'].forEach((id) => { els[id] = makeEl(id); });
  els.referralView.hidden = true;
  const storage = {};
  const sandbox = {
    window: null,
    document: {
      title: '',
      getElementById: (id) => els[id] || null,
      createElement: () => makeEl('new'),
    },
    URLSearchParams,
    console,
  };
  sandbox.window = {
    location: { pathname: u.pathname, search: u.search, hash: u.hash },
    history: { replaceState() {} },
    localStorage: { setItem: (k, v) => { storage[k] = v; } },
    fetch: () => Promise.resolve({ ok: true }),
    SERAYAE_INVITE: undefined,
  };
  vm.runInNewContext(src, sandbox);
  return { els, storage, published: sandbox.window.SERAYAE_INVITE, title: sandbox.document.title };
}

let failed = 0;
function check(name, cond) {
  console.log((cond ? 'ok   ' : 'FAIL ') + name);
  if (!cond) failed++;
}

// Ambassador referral code — after the 404 rescue: /invite/?t=cade2493
let r = run('https://serayae.me/invite/?t=cade2493');
check('referral: guardian view hidden', r.els.view.hidden === true);
check('referral: referral view shown', r.els.referralView.hidden === false);
check('referral: code echoed', r.els.refCodeEcho.textContent === 'cade2493');
check('referral: CTA carries ?ref=', r.els.getSerayae.attrs.href === '/?ref=cade2493#waitlist');
check('referral: code persisted', r.storage['serayae.ref'] === 'cade2493');
check('referral: no guardian token published', r.published.token === null && r.published.referralCode === 'cade2493');
check('referral: title recased', r.title === 'You were invited \u2014 Serayae');

// Guardian cuid token — existing flow untouched.
r = run('https://serayae.me/invite/?t=clzq8xw1v0000abcd1234efgh');
check('guardian: guardian view visible', r.els.view.hidden === false);
check('guardian: referral view stays hidden', r.els.referralView.hidden === true);
check('guardian: deep link set', r.els.openApp.attrs.href === 'serayae://invite/clzq8xw1v0000abcd1234efgh');
check('guardian: token published for redeem.js', r.published.token === 'clzq8xw1v0000abcd1234efgh');
check('guardian: nothing persisted', !('serayae.ref' in r.storage));

// Path-segment form still works for both.
r = run('https://serayae.me/invite/cade2493');
check('path referral: referral view shown', r.els.referralView.hidden === false);

// No/invalid token.
r = run('https://serayae.me/invite/');
check('no token: incomplete-link state', r.els.openApp.textContent === 'This invite link is incomplete');
check('no token: referral view hidden', r.els.referralView.hidden === true);

process.exit(failed ? 1 : 0);
