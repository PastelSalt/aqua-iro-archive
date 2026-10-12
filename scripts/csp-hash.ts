/**
 * CSP script hashes (EXECUTIONPLAN §5.3). Collects every executable inline <script> in the built HTML — the
 * pre-paint prefs script plus Astro's island-hydration runtime — and writes their sha256 hashes into
 * vercel.json's Content-Security-Policy, replacing any previous hashes. Run after `astro build`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = existsSync('dist/client') ? 'dist/client' : 'dist';
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) =>
    statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.html') ? [join(d, f)] : [],
  );

const hashes = new Set<string>();
for (const file of walk(ROOT)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (/\ssrc=/.test(attrs) || !body.trim()) continue;
    const type = /type="([^"]+)"/.exec(attrs)?.[1];
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue; // JSON/ld+json are not executed
    hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
}
if (!hashes.size) throw new Error('no inline scripts found — did the build run?');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
let n = 0;
for (const h of vercel.headers)
  for (const kv of h.headers) {
    if (kv.key !== 'Content-Security-Policy') continue;
    kv.value = kv.value.replace(/script-src [^;]*/, (src: string) => {
      const kept = src.split(' ').filter((t: string) => !t.startsWith("'sha256-"));
      return [kept[0], kept[1], ...hashes, ...kept.slice(2)].join(' ');
    });
    n++;
  }
writeFileSync('vercel.json', JSON.stringify(vercel, null, 2) + '\n');
console.log(`csp-hash: ${hashes.size} inline script hash(es) written to ${n} CSP header(s)`);
