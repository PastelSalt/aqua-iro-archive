// Dev helper: prove a change is invisible. Full-page screenshots (Motion OFF, same board data) of every
// page from two builds, at 1366×649 and 390×800, then a per-pixel diff.
//   node scripts/dev/visual-diff.mjs <outDir> [oldBase] [newBase]   (PAGES=/,/about to limit)
// Default old = the live site, new = http://localhost:4321 (npm run build && node scripts/dev/serve-dist.mjs 4321).
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const [, , out = 'test-results/visual-diff', OLD = 'https://aqua-iro-archive.vercel.app', NEW = 'http://localhost:4321'] = process.argv;
await import('node:fs').then((fs) => fs.mkdirSync(out, { recursive: true }));
const pages = process.env.PAGES ? process.env.PAGES.split(',') : ['/', '/about', '/clips', '/discography', '/streaming', '/events', '/arts', '/messages', '/credits'];
const b = await chromium.launch();
const shoot = async (base, tag, w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    localStorage.setItem('aia:prefs', JSON.stringify({ lang: 'ja', motion: 'off' }));
    localStorage.setItem('aia:tour.done', 'true'); localStorage.setItem('aia:hint.dock', 'true');
    localStorage.setItem('aia:hero.outfit', '0');
    sessionStorage.setItem('aia:splash', '1');
  });
  const p = await ctx.newPage();
  // same board state on both sides: the live API has data, the local static server has none
  await p.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notes: [], total: 0, count: 0, items: [] }) }));
  for (const path of pages) {
    await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    await p.evaluate(async () => { await document.fonts.ready; for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}/${tag}-${w}${path.replace(/\//g, '_') || '_'}.png`, fullPage: true, animations: 'disabled', caret: 'hide' });
  }
  await ctx.close();
};
for (const [w, h] of [[1366, 649], [390, 800]]) {
  await shoot(OLD, 'old', w, h);
  await shoot(NEW, 'new', w, h);
  for (const path of pages) {
    const n = `${w}${path.replace(/\//g, '_') || '_'}`;
    const [a, c] = await Promise.all([sharp(`${out}/old-${n}.png`).raw().toBuffer({ resolveWithObject: true }), sharp(`${out}/new-${n}.png`).raw().toBuffer({ resolveWithObject: true })]);
    if (a.info.width !== c.info.width || a.info.height !== c.info.height) { console.log(`${n.padEnd(18)} SIZE ${a.info.width}x${a.info.height} vs ${c.info.width}x${c.info.height}`); continue; }
    let diff = 0; const ch = a.info.channels;
    for (let i = 0; i < a.data.length; i += ch) if (Math.abs(a.data[i] - c.data[i]) + Math.abs(a.data[i + 1] - c.data[i + 1]) + Math.abs(a.data[i + 2] - c.data[i + 2]) > 30) diff++;
    console.log(`${n.padEnd(18)} ${a.info.width}x${a.info.height} differing px ${diff} (${((diff / (a.info.width * a.info.height)) * 100).toFixed(3)}%)`);
  }
}
await b.close();
