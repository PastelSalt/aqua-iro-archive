// Dev helper: screenshots of pages at one size and scroll positions, as a contact sheet.
//   node scripts/dev/look.mjs out.png 1920x953 /about@0 /about@1500 /clips@end
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const [, , out, size = '1920x953', ...specs] = process.argv; // specs: /path@y
const [w, h] = size.split('x').map(Number);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addInitScript(() => { localStorage.setItem('aia:prefs', JSON.stringify({ lang: 'en' })); localStorage.setItem('aia:tour.done', 'true'); sessionStorage.setItem('aia:splash', '1'); });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)));
const shots = [];
for (const spec of specs) {
  const [path, y = '0'] = spec.split('@');
  if (p.url() !== 'http://localhost:4321' + path) { await p.goto('http://localhost:4321' + path, { waitUntil: 'load' }); await p.waitForTimeout(1500); }
  await p.evaluate((y) => scrollTo(0, y === 'end' ? document.documentElement.scrollHeight : +y), y); await p.waitForTimeout(1100);
  shots.push(await p.screenshot());
}
const tw = w < 600 ? 300 : 760;
const tiles = await Promise.all(shots.map((s) => sharp(s).resize({ width: tw }).png().toBuffer()));
const th = (await sharp(tiles[0]).metadata()).height; const cols = w < 600 ? Math.min(5, tiles.length) : Math.min(2, tiles.length); const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * (tw + 6), height: rows * (th + 6), channels: 3, background: '#333' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) }))).png().toFile(out);
console.log('errors', errs);
await b.close();
