// Dev helper: paint / raster / composite work while scrolling a page, with optional CSS variants to
// find what costs what.   node scripts/dev/paint.mjs /clips base pauseAll bodyBgScroll …
import { chromium } from '@playwright/test';
const [, , path, ...names] = process.argv;
const V = {
  base: '',
  bodyBgScroll: 'body{background-attachment:scroll!important}',
  noWaves: '.waves{display:none!important}',
  noMotifs: '.motifs{display:none!important}',
  noOdo: '.odo__d{display:none!important}',
  noRails: '.rails{display:none!important}',
  pauseAll: '*,*::before,*::after{animation-play-state:paused!important}',
  noKV: '.page-head__kv{display:none!important}',
  pRails: '.rail__strip,.rail__roll{animation-play-state:paused!important}',
  pKV: '.page-head__kv img{animation-play-state:paused!important}',
  pMotifs: '.motif{animation-play-state:paused!important}',
  pSeams: '.seam *,.ending__track{animation-play-state:paused!important}',
  pDock: '.dock *,.dock-host *{animation-play-state:paused!important}',
  pMarquee: '.marquee__track{animation-play-state:paused!important}',
  pStamp: '.stamp__ring,.stamp *{animation-play-state:paused!important}',
  pGhost: '.sec-ghost,.page-head__ghost{animation:none!important}',
  pClips: '.clip *,.clip,.postcard *,.postcard{animation-play-state:paused!important}',
  pOdo: '.odo__strip{animation:none!important}',
  pSticker: '.clip__rank{animation:none!important}',
  pPlay: '.clip__play{animation:none!important}',
  allFixed: 'body{background-attachment:scroll!important}.waves,.motifs{display:none!important}',
};
const b = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
for (const n of names) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 649 } });
  await ctx.addInitScript(() => { localStorage.setItem('aia:prefs', JSON.stringify({ lang: 'ja' })); localStorage.setItem('aia:tour.done', 'true'); sessionStorage.setItem('aia:splash', '1'); sessionStorage.setItem('aia:onthisday', '1'); });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:4321' + path, { waitUntil: 'load' });
  if (V[n]) await p.addStyleTag({ content: V[n] });
  await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(2500);
  const ev = []; cdp.on('Tracing.dataCollected', (e) => ev.push(...e.value));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,cc,gpu,blink', transferMode: 'ReportEvents' });
  await p.evaluate(() => new Promise((res) => { const t0 = performance.now(); const tick = (t) => { scrollBy(0, 12); if (scrollY > 4200) scrollTo(0, 600); if (t - t0 < 3000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); }));
  await cdp.send('Tracing.end'); await done;
  const sum = (name) => Math.round(ev.filter((e) => e.name === name && e.ph === 'X').reduce((a, e) => a + (e.dur || 0), 0) / 1000);
  const cnt = (name) => ev.filter((e) => e.name === name).length;
  console.log(n.padEnd(13), `Paint ${sum('Paint')}ms(${cnt('Paint')}) Raster ${sum('RasterTask')}ms Composite ${sum('CompositeLayers') + sum('Layerize')}ms Style ${sum('UpdateLayoutTree')}ms Layout ${sum('Layout')}ms PrePaint ${sum('PrePaint')}ms Frames ${cnt('DrawFrame')}`);
  await ctx.close();
}
await b.close();
