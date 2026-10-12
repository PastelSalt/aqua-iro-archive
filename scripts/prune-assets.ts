/**
 * Post-build: delete image files in _astro/ that no HTML/CSS/JS/JSON file references.
 * Astro emits the original of every content-collection image even when only resized variants are used;
 * removing them keeps the deploy inside the 80 MB budget (EXECUTIONPLAN §4). Runs on dist/ and the
 * Vercel output copy.
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const IMG = /\.(jpe?g|png|webp|avif|gif)$/i;
const TEXT = /\.(html|css|js|mjs|json|xml|txt|webmanifest)$/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

for (const root of [existsSync('dist/client') ? 'dist/client' : 'dist', '.vercel/output/static']) {
  if (!existsSync(root)) continue;
  const files = walk(root);
  // only static output counts: the server bundle lists every original in Astro's content manifest, but no
  // on-demand route (/api, /keeper) renders content images
  const corpus = files
    .filter((f) => TEXT.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  let removed = 0;
  let bytes = 0;
  for (const f of files) {
    if (!f.includes('/_astro/') || !IMG.test(f)) continue;
    const name = f.split('/').pop()!;
    if (corpus.includes(name)) continue;
    bytes += statSync(f).size;
    unlinkSync(f);
    removed++;
  }
  const total = walk(root).reduce((a, f) => a + statSync(f).size, 0);
  console.log(
    `prune-assets: ${root}: removed ${removed} unreferenced images (${(bytes / 1048576).toFixed(1)} MB) → ${(total / 1048576).toFixed(1)} MB`,
  );
}
