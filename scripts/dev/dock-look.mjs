// Dev helper: the dock at every width, in both languages, at the top and scrolled, plus the MORE sheet.
//   node scripts/dev/dock-look.mjs out-dir [base-url]
import { chromium } from '@playwright/test';
const [, , dir, base = 'http://localhost:4321'] = process.argv;
const sizes = [[1920, 953], [1366, 649], [1024, 700], [768, 1024], [390, 664]];
const b = await chromium.launch();
const report = [];
for (const lang of ['ja', 'en'])
  for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    await ctx.addInitScript((l) => { localStorage.setItem('aia:prefs', JSON.stringify({ lang: l })); localStorage.setItem('aia:tour.done', 'true'); sessionStorage.setItem('aia:splash', '1'); }, lang);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/events', { waitUntil: 'load' }); await p.waitForTimeout(1500);
    const box = async () => p.locator('.dock').evaluate((d) => { const r = d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
    const top = await box();
    const clip = { x: 0, y: h - 110, width: w, height: 110 };
    await p.screenshot({ path: `${dir}/${lang}-${w}-top.png`, clip });
    await p.mouse.wheel(0, 900); await p.waitForTimeout(900);
    const scrolled = await box();
    await p.screenshot({ path: `${dir}/${lang}-${w}-scrolled.png`, clip });
    let sheet = '';
    if (await p.locator('.dock__more').isVisible()) {
      await p.locator('.dock__more .dbtn').click(); await p.waitForTimeout(500);
      await p.screenshot({ path: `${dir}/${lang}-${w}-sheet.png` });
      sheet = 'sheet ' + (await p.locator('.dock-sheet .dbtn').count()) + ' buttons';
      await p.keyboard.press('Escape');
    }
    report.push(`${lang} ${w}: top ${top} scrolled ${scrolled} ${sheet} ${errs.join('|')}`);
    await ctx.close();
  }
console.log(report.join('\n'));
await b.close();
