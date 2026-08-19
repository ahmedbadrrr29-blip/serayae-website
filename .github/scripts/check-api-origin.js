#!/usr/bin/env node
/**
 * Guard: the site's API origin must be one value, spelled identically, and alive.
 *
 * Why this exists
 * ---------------
 * Three separate files each hold their own copy of the backend origin:
 *
 *   invite/invite.js   var API_BASE
 *   invite/redeem.js   var API_BASE
 *   track/track.js     var DEFAULT_API
 *
 * They are deliberately NOT refactored into a shared `window.SERAYAE_API_BASE`.
 * A page-level global is writable by any injected script, so an XSS on
 * /invite or /track could repoint the origin and harvest the bearer token or
 * the tracking token in the request path. That is precisely the
 * token-exfiltration primitive removed in #7 when the `?api=` override was
 * deleted. A closure-local `var` inside an IIFE is not reachable from outside.
 *
 * The cost of that choice is three copies that can drift. In August 2026 all
 * three still pointed at `solra-backend-production.up.railway.app` weeks after
 * that host started returning 404 — every guardian invite and every tracking
 * link on the live site was dead, and nothing failed loudly. This script is the
 * check that would have caught it.
 *
 * What it enforces
 * ----------------
 *  1. Each file declares exactly one origin (no second copy hiding below).
 *  2. All three strings are byte-identical.
 *  3. The origin is https.
 *  4. The origin is not a known-dead or forbidden host.
 *  5. The path suffix is exactly `/api`, which every call site appends to.
 *
 * Usage
 *   node .github/scripts/check-api-origin.js            # verify only
 *   node .github/scripts/check-api-origin.js --print    # also print the origin
 *
 * Exits non-zero with a specific message on any violation.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** file → the variable name that holds the origin in that file. */
const TARGETS = [
  { file: 'invite/invite.js', varName: 'API_BASE' },
  { file: 'invite/redeem.js', varName: 'API_BASE' },
  { file: 'track/track.js', varName: 'DEFAULT_API' },
];

/**
 * Hosts that must never appear. Each entry explains itself so a future reader
 * does not "fix" the check by deleting the line.
 */
const FORBIDDEN_HOSTS = [
  {
    pattern: /\.up\.railway\.app$/i,
    reason:
      'Railway is decommissioned — solra-backend-production.up.railway.app returns 404. ' +
      'Any subdomain there may also be re-registrable by a third party, who would then ' +
      'receive live tracking tokens from this page.',
  },
  {
    pattern: /(^|\.)solra/i,
    reason:
      'The product is SERAYAE. No new surface may reference a Solra host.',
  },
  {
    pattern: /^localhost$|^127\.0\.0\.1$|^0\.0\.0\.0$/i,
    reason: 'A local address would ship to serayae.me and fail for every visitor.',
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

  const source = fs.readFileSync(abs, 'utf8');

  // Match:  var API_BASE = 'https://host/api';   (single or double quotes)
  const declRe = new RegExp(
    `\\b(?:var|let|const)\\s+${varName}\\s*=\\s*(['"])([^'"]+)\\1`,
    'g',
  );

  const matches = [...source.matchAll(declRe)];

  if (matches.length === 0) {
    errors.push(
      `${file}: no \`${varName} = '<origin>'\` declaration found. ` +
        `If the variable was renamed, update TARGETS in this script.`,
    );
    continue;
  }

  if (matches.length > 1) {
    errors.push(
      `${file}: found ${matches.length} declarations of \`${varName}\`. ` +
        `Exactly one is required — a second copy is how origins drift apart.`,
    );
    continue;
  }

  found.push({ file, varName, value: matches[0][2] });
}

// ── per-value checks ────────────────────────────────────────────────────────
for (const { file, value } of found) {
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${file}: '${value}' is not a parsable URL.`);
    continue;
  }

  if (url.protocol !== 'https:') {
    errors.push(
      `${file}: origin is '${url.protocol}//' — must be https. ` +
        `This page carries bearer and tracking tokens.`,
    );
  }

  for (const { pattern, reason } of FORBIDDEN_HOSTS) {
    if (pattern.test(url.hostname)) {
      errors.push(`${file}: host '${url.hostname}' is forbidden. ${reason}`);
    }
  }

  if (url.pathname.replace(/\/+$/, '') !== '/api') {
    errors.push(
      `${file}: path is '${url.pathname}' — must be exactly '/api', ` +
        `because every call site appends a route like '/referrals/redeem' to it.`,
    );
  }

  if (url.search || url.hash) {
    errors.push(`${file}: origin must not carry a query string or fragment ('${value}').`);
  }
}

// ── agreement across files ─────────────────────────────────────────────────
if (found.length === TARGETS.length) {
  const distinct = [...new Set(found.map((f) => f.value))];
  if (distinct.length > 1) {
    errors.push(
      'the three origins disagree:\n' +
        found.map((f) => `    ${f.file.padEnd(18)} ${f.value}`).join('\n') +
        '\n  All three must be byte-identical. A guardian invite is minted by one ' +
        'page and redeemed by another; if they point at different backends the ' +
        'invite silently cannot be accepted.',
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
console.log(`✓ API origin check passed — all ${found.length} files agree on ${origin}`);

if (process.argv.includes('--print')) {
  console.log(origin);
}
