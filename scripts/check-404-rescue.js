/**
 * Simulates the 404.html rescue script against representative paths, using the
 * regexes extracted from the live file so this check cannot drift from it.
 * Run: node scripts/check-404-rescue.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8');

const trackMatch = html.match(/pathname\.match\((\/\^\\\/track\\\/.+?\/i)\)/);
const invMatch = html.match(/pathname\.match\((\/\^\\\/invite\\\/.+?\/i)\)/);
if (!trackMatch || !invMatch) {
  console.error('FAIL: could not extract rescue regexes from 404.html');
  process.exit(1);
}
// eslint-disable-next-line no-eval
const TRACK_RE = eval(trackMatch[1]);
// eslint-disable-next-line no-eval
const INV_RE = eval(invMatch[1]);

function rescue(pathname, hash) {
  const t = pathname.match(TRACK_RE);
  if (t) return '/track/?t=' + t[1] + (hash || '');
  const i = pathname.match(INV_RE);
  if (i) return '/invite/?t=' + i[1] + (hash || '');
  return null; // falls through to the 404 copy
}

const cases = [
  // Ambassador referral code (8-char cuid prefix) — the bug this file fixes.
  ['/invite/cade2493', '', '/invite/?t=cade2493'],
  ['/invite/cade2493/', '', '/invite/?t=cade2493'],
  ['/invite/cade2493', '#x', '/invite/?t=cade2493#x'],
  // Guardian invite cuid token — must keep working.
  ['/invite/clzq8xw1v0000abcd1234efgh', '', '/invite/?t=clzq8xw1v0000abcd1234efgh'],
  // Too short / bad alphabet — must still 404.
  ['/invite/abc12', '', null],
  ['/invite/cade-2493', '', null],
  ['/invite/', '', null],
  // /track/ rescue untouched.
  ['/track/123e4567-e89b-42d3-a456-426614174000', '', '/track/?t=123e4567-e89b-42d3-a456-426614174000'],
  ['/track/cade2493', '', null],
];

let failed = 0;
for (const [p, h, want] of cases) {
  const got = rescue(p, h);
  const ok = got === want;
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + p + (h || '') + ' -> ' + got + (ok ? '' : ' (want ' + want + ')'));
}
process.exit(failed ? 1 : 0);
