// Dev helper: how much of each screen is empty (IMPROVEMENT-PLAN §1.2).
//   node scripts/dev/fill.mjs [outDir] [baseUrl]        (VIEWS=1366,1920,phone  PAGES=/,/about)
// Scrolls every page top to bottom; each screen is cut into 120×120 cells and a cell is "empty" when its
// pixels hardly vary (std dev < 6 across the cell). Prints the share of empty cells per page (worst
// screen and average) and writes heat maps (red = empty cell) to outDir for the worst screens.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';

const [, , out = 'test-results/fill', base = 'http://localhost:4321'] = process.argv;
fs.mkdirSync(out, { recursive: true });
const ALL_VIEWS = {
  1366: { viewport: { width: 1366, height: 649 } },
  1920: { viewport: { width: 1920, height: 953 } },
  phone: { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true },
};
const views = (process.env.VIEWS ?? '1366,1920,phone').split(',');
const PAGES = (process.env.PAGES ?? '/,/about,/clips,/discography,/streaming,/events,/arts,/messages,/credits,/privacy,/nope-404').split(',');
const CELL = 120;
const STD = 6;

export async function emptyCells(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const cells = [];
  for (let cy = 0; cy + CELL <= h; cy += CELL)
    for (let cx = 0; cx + CELL <= w; cx += CELL) {
      let s = 0, s2 = 0, n = 0;
      for (let y = cy; y < cy + CELL; y += 2)
        for (let x = cx; x < cx + CELL; x += 2) {
          const v = data[y * w + x];
          s += v; s2 += v * v; n++;
        }
      const mean = s / n;
      cells.push({ x: cx, y: cy, empty: Math.sqrt(Math.max(0, s2 / n - mean * mean)) < STD });
    }
  return cells;
}

const b = await chromium.launch();
const rows = [];
for (const v of views) {
  const ctx = await b.newContext(ALL_VIEWS[v]);
  await ctx.addInitScript(() => {
    localStorage.setItem('aia:prefs', JSON.stringify({ lang: 'en' }));
    localStorage.setItem('aia:tour.done', 'true');
    localStorage.setItem('aia:hint.dock', 'true');
    sessionStorage.setItem('aia:splash', '1');
  });
  const p = await ctx.newPage();
  for (const path of PAGES) {
    await p.goto(base + path, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const { H, vh } = await p.evaluate(() => ({ H: document.documentElement.scrollHeight, vh: innerHeight }));
    const stops = Math.max(1, Math.ceil((H - vh) / (vh * 0.9)) + 1);
    let worst = { pct: -1 };
    let total = 0;
    for (let i = 0; i < stops; i++) {
      const y = Math.round(stops === 1 ? 0 : (i * (H - vh)) / (stops - 1));
      await p.evaluate((y) => scrollTo(0, y), y);
      await p.waitForTimeout(700);
      const png = await p.screenshot();
      const cells = await emptyCells(png);
      const pct = (cells.filter((c) => c.empty).length / cells.length) * 100;
      total += pct;
      if (pct > worst.pct) worst = { pct, png, cells, y };
    }
    const avg = total / stops;
    rows.push({ v, path, avg, worst: worst.pct, at: worst.y });
    // heat map of the worst screen
    const overlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ALL_VIEWS[v].viewport.width}" height="${ALL_VIEWS[v].viewport.height}">${worst.cells
        .filter((c) => c.empty)
        .map((c) => `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" fill="rgba(255,0,0,.35)" stroke="red"/>`)
        .join('')}</svg>`,
    );
    await sharp(worst.png).composite([{ input: overlay }]).png().toFile(`${out}/${v}${path.replace(/\//g, '_')}.png`);
  }
  await ctx.close();
}
await b.close();
for (const r of rows)
  console.log(`${r.v.padEnd(6)} ${r.path.padEnd(13)} avg ${r.avg.toFixed(1).padStart(5)}%  worst ${r.worst.toFixed(1).padStart(5)}% (at y=${r.at})${r.worst > 8 ? '  ✗' : ''}`);
