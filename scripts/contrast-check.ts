/** Asserts the token pairs in EXECUTIONPLAN §6.1 meet WCAG AA (4.5:1 text, 3:1 large/UI). */
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1]!;
};
const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const PAIRS: [string, string, number, string][] = [
  ['navy', 'paper', 4.5, 'body and heading text'],
  ['ink-soft', 'paper', 4.5, 'secondary text'],
  ['pink-ink', 'paper', 4.5, 'small pink labels'],
  ['link-blue', 'paper', 4.5, 'inline links'],
  ['placeholder', 'paper', 4.5, 'placeholder text'],
  ['navy', 'aqua-pink', 4.5, 'navy on pink buttons'],
  ['navy', 'mint-row', 4.5, 'zebra rows'],
  ['navy', 'pink-wash', 4.5, 'pressed buttons'],
  ['note-ink', 'note-lav', 4.5, 'note text on lavender paper'],
  ['ink-soft', 'mint-row', 4.5, 'secondary text on mint rows'],
  ['pink-wash', 'navy', 4.5, 'JP subtitles on the deep band'],
  ['on-deep', 'navy', 4.5, 'body text on the deep band'],
];
let bad = 0;
for (const [fg, bg, min, use] of PAIRS) {
  const r = ratio(token(fg), token(bg));
  const ok = r >= min;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${fg} on ${bg}: ${r.toFixed(2)} (min ${min}) — ${use}`);
}
// white on navy (active chapter pill)
const wn = ratio('#ffffff', token('navy'));
console.log(`${wn >= 4.5 ? '✓' : '✗'} white on navy: ${wn.toFixed(2)}`);
if (wn < 4.5) bad++;
if (bad) process.exit(1);
