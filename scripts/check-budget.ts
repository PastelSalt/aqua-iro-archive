/**
 * JS budget (EXECUTIONPLAN §1.3 / §19): sums the gzip size of every script a page loads (module graph from
 * <script src> + modulepreload + island component-url/renderer-url) and fails at > 110% of the budget.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = existsSync('dist/client') ? 'dist/client' : 'dist';
const BUDGET_KB: Record<string, number> = { '/': 120, '/streaming': 80 };
const DEFAULT_KB = 70;
const SKIP = ['/keeper', '/404'];

const gz = new Map<string, number>();
const size = (p: string) => {
  if (!gz.has(p)) gz.set(p, gzipSync(readFileSync(p)).length);
  return gz.get(p)!;
};
function imports(file: string, seen: Set<string>) {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(
    /(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+\.js|\/_astro\/[^"']+\.js)["']/g,
  )) {
    const ref = m[1]!;
    const next = ref.startsWith('/') ? join(DIST, ref) : join(file, '..', ref);
    // dynamic import()s load later on demand; only count static imports
    if (src.slice(Math.max(0, m.index! - 7), m.index!).includes('import(') || m[0].includes('import('))
      continue;
    imports(next, seen);
  }
}
function pages(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (f.endsWith('.html')) out.push(p);
  }
  return out;
}
let fail = 0;
for (const html of pages(DIST)) {
  const route =
    '/' +
    html
      .slice(DIST.length + 1)
      .replace(/(index)?\.html$/, '')
      .replace(/\/$/, '');
  if (SKIP.some((s) => route.startsWith(s))) continue;
  const doc = readFileSync(html, 'utf8');
  const seen = new Set<string>();
  for (const m of doc.matchAll(/(?:src|href|component-url|renderer-url)="(\/_astro\/[^"]+\.js)"/g))
    imports(join(DIST, m[1]!), seen);
  const kb = [...seen].reduce((a, f) => a + size(f), 0) / 1024;
  const budget = BUDGET_KB[route] ?? DEFAULT_KB;
  const ok = kb <= budget * 1.1;
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} ${route.padEnd(14)} ${kb.toFixed(1).padStart(6)} KB gz (budget ${budget})`);
}
if (fail) process.exit(1);
