/**
 * Text rules shared by the composer (instant feedback) and the server (enforcement) — EXECUTIONPLAN §13.
 * One implementation, so client and server never disagree.
 */
import { kataToHira } from './kana';

export const LIMITS = { maxLen: 300, maxLines: 6, maxEmoji: 20 } as const;

const ZERO_WIDTH = /[​-‏⁠﻿]/g;
const BIDI = /[‪-‮⁦-⁩]/g;
// control chars except \n (and \t, which becomes a space)
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
const COMBINING = /\p{M}/u;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}
export function graphemeCount(s: string): number {
  return graphemes(s).length;
}

/** Step 4: CRLF→LF, NFC, strip zero-width/bidi/control, cap combining marks (anti-zalgo), trim, collapse blank lines, cap lines. */
export function clean(input: string, maxLines: number = LIMITS.maxLines): string {
  let s = input.replace(/\r\n?/g, '\n').normalize('NFC');
  s = s.replace(ZERO_WIDTH, '').replace(BIDI, '').replace(/\t/g, ' ').replace(CONTROL, '');
  // anti-zalgo: at most 2 combining marks per grapheme
  s = graphemes(s)
    .map((g) => {
      const cps = Array.from(g);
      let marks = 0;
      return cps.filter((c) => (COMBINING.test(c) ? ++marks <= 2 : true)).join('');
    })
    .join('');
  s = s
    .split('\n')
    .map((l) => l.replace(/[ 　]+$/u, ''))
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
  const lines = s.split('\n');
  if (lines.length > maxLines)
    s = lines.slice(0, maxLines - 1).join('\n') + '\n' + lines.slice(maxLines - 1).join(' ');
  return s;
}

/** Comparison form for duplicates and the word filter: NFKC, lowercase, kata→hira, no spaces or punctuation. */
export function compareForm(s: string): string {
  return kataToHira(s.normalize('NFKC').toLowerCase()).replace(/[\s\p{P}\p{S}]/gu, '');
}

const EMOJI = /\p{Extended_Pictographic}/u;
export function emojiCount(s: string): number {
  return graphemes(s).filter((g) => EMOJI.test(g)).length;
}

/** True when nothing but whitespace and punctuation is left (an emoji-only note like "⚓❤️" is fine). */
export function isEffectivelyEmpty(s: string): boolean {
  return s.replace(/[\s\p{P}\u200D\uFE0F]/gu, '').length === 0;
}

const TLD = 'com|net|org|jp|io|gg|ly|me|tv|xyz|link|app|dev|co|info|ru|cn';
const LINK_PATTERNS = [
  /https?:\/\//,
  /h\s*t\s*t\s*p\s*s?\s*:/,
  /www\.[a-z0-9-]+\./, // bare "www" is laughter in Japanese, so a domain must follow
  new RegExp(`[a-z0-9-]+\\.(${TLD})\\b`),
  /discord\.gg/,
  /t\.me\//,
];
const LINK_SPACED = [
  /https?:\/\//,
  /www\.[a-z0-9-]+\./,
  new RegExp(`[a-z0-9-]{2,}\\.(${TLD})(\\b|$)`),
  /discord\.gg/,
];

/** Step 6: links (including fullwidth and spaced-out variants). Returns the matched fragment or null. */
export function findLink(s: string): string | null {
  const n = s.normalize('NFKC').toLowerCase();
  for (const re of LINK_PATTERNS) {
    const m = re.exec(n);
    if (m) return m[0];
  }
  // "h t t p" / "w w w . x . c o m" — only when the text is spelled out letter by letter
  if (!/(?:^|\s)[a-z0-9](?:\s+[a-z0-9.:/]){3,}/.test(n)) return null;
  const squashed = n.replace(/[\s　]+/g, '').replace(/[。．]/g, '.');
  for (const re of LINK_SPACED) {
    const m = re.exec(squashed);
    if (m) return m[0];
  }
  return null;
}

/** Step 6: personal info — handles, emails, phone-like digit runs. */
export function findPersonal(s: string): string | null {
  const n = s.normalize('NFKC').toLowerCase();
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.exec(n);
  if (email) return email[0];
  const handle = /(^|[^a-z0-9_])@[a-z0-9_]{3,}/.exec(n);
  if (handle) return handle[0].trim();
  const digits = n.replace(/[\s\-‐−ー().]/g, '');
  const phone = /\d{10,}/.exec(digits);
  if (phone) return phone[0];
  return null;
}

export type TextError = 'EMPTY' | 'LENGTH' | 'EMOJI' | 'LINK' | 'PERSONAL';

/** Steps 4–6 in order. Returns the cleaned text or the first error code. */
export function checkText(
  raw: string,
  limits: { maxLen?: number; maxLines?: number } = {},
): { ok: true; text: string } | { ok: false; code: TextError; detail?: string } {
  const maxLen = limits.maxLen ?? LIMITS.maxLen;
  const text = clean(raw, limits.maxLines ?? LIMITS.maxLines);
  if (!text || isEffectivelyEmpty(text)) return { ok: false, code: 'EMPTY' };
  if (graphemeCount(text) > maxLen) return { ok: false, code: 'LENGTH' };
  if (emojiCount(text) > LIMITS.maxEmoji) return { ok: false, code: 'EMOJI' };
  const link = findLink(text);
  if (link) return { ok: false, code: 'LINK', detail: link };
  const personal = findPersonal(text);
  if (personal) return { ok: false, code: 'PERSONAL', detail: personal };
  return { ok: true, text };
}
