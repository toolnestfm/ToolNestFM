/**
 * Deterministic Unicode repair for Bengali/Indic text mangled by PDF text
 * layers and OCR. Runs with no AI and no network.
 *
 * Every transform only matches *broken* sequences — already-correct Unicode
 * (matras already attached to their consonant, no stray nuktas, no spaces
 * inside a cluster) passes through unchanged, verified against real samples.
 * It restores Unicode integrity (canonical order, joined matras/conjuncts);
 * it deliberately does NOT remove spaces *between* whole clusters, because
 * that is a word-boundary decision left to the AI repair pass.
 *
 * Fixes: NFC composition · BA+nukta -> RA (EPIC/government-font artifact) ·
 * zero-width junk · space wedged between a consonant and its post-base
 * matra/hasant · pre-base matras (i, e, oi) stranded before their consonant
 * (moved after; NFC then composes e+aa -> o, e+length -> au).
 */

const C = '\\u0995-\\u09B9\\u09DC-\\u09DF\\u09CE';                 // consonants
const POST = '\\u0981-\\u0983\\u09BE\\u09C0-\\u09C4\\u09CB-\\u09CD\\u09D7\\u09E2\\u09E3'; // post-base signs + hasant
const PRE = '\\u09BF\\u09C7\\u09C8';                              // pre-base matras: i, e, oi

const RE_BA_NUKTA = /ব়/g;
const RE_ZERO_WIDTH = /[​‌‍﻿­]/g;
const RE_SPACE_BEFORE_POST = new RegExp(`[ \\t]+([${POST}])`, 'g');
const RE_SPACE_AFTER_HASANT = /্[ \t]+/g;
// Reorder a pre-base matra only when it is NOT already attached to a consonant,
// so already-correct text like "ঠিক" is left alone. Uses a captured boundary
// char instead of lookbehind (older Safari throws on lookbehind in RegExp).
const RE_PREPOSED_MATRA = new RegExp(
  `(^|[^${C}\\u09BC])([${PRE}])[ \\t]*([${C}])((?:\\u09CD[${C}])*)`,
  'g',
);

export function hasIndicText(text: string): boolean {
  return /[ঀ-৿ऀ-ॿ]/.test(text);
}

/** Repair one segment of Bengali text deterministically. Safe on correct text. */
export function normalizeIndicText(input: string): string {
  if (!hasIndicText(input)) return input;

  let s = input.normalize('NFC');
  s = s.replace(RE_ZERO_WIDTH, '');
  s = s.replace(RE_BA_NUKTA, 'র');            // -> RA
  s = s.replace(RE_SPACE_AFTER_HASANT, '্');  // rejoin conjunct
  s = s.replace(RE_SPACE_BEFORE_POST, '$1');       // rejoin post-base matra
  let prev: string;
  do {
    prev = s;
    s = s.replace(RE_PREPOSED_MATRA, '$1$3$4$2');
  } while (s !== prev);
  s = s.normalize('NFC');                           // compose e+aa -> o, etc.
  return s.replace(/[ \t]{2,}/g, ' ');
}

/** Normalize a whole page, line by line (preserves line breaks and layout). */
export function normalizeIndicPage(page: string): string {
  return page
    .split('\n')
    .map((line) => normalizeIndicText(line).replace(/[ \t]+$/g, ''))
    .join('\n');
}
