// Dev helper: rendering cost per page on this machine.
//   node scripts/dev/perf.mjs [baseUrl] [w]x[h] [pages…]
// Default base http://localhost:4321 (npm run build && node scripts/dev/serve-dist.mjs 4321), 1366×649.
// For each page: load metrics (FCP / LCP / CLS / long tasks), then 4 s idle and 4 s of scrolling with
// frames/s, frames slower than 34 ms, and Chrome's own main-thread time split (style / layout / script /
// other) from the DevTools Performance domain. Run it before and after a change and compare.
import { chromium } from '@playwright/test';

const [, , base = 'http://localhost:4321', size = '1366x649', ...pagesArg] = process.argv;
const [w, h] = size.split('x').map(Number);
const pages = pagesArg.length
  ? pagesArg
  : ['/', '/about', '/clips', '/discography', '/streaming', '/events', '/arts', '/messages'];

const b = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: w, height: h } });
await ctx.addInitScript(() => {
  localStorage.setItem('aia:prefs', JSON.stringify({ lang: 'ja' }));
  localStorage.setItem('aia:tour.done', 'true');
  localStorage.setItem('aia:hint.dock', 'true');
  sessionStorage.setItem('aia:splash', '1');
});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
const metrics = async () =>
  Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

const phase = async (ms, scroll) => {
  const a = await metrics();
  const fr = await p.evaluate(
    ([ms, scroll]) =>
      new Promise((r) => {
        let frames = 0,
          slow = 0;
        const t0 = performance.now();
        let last = t0;
        const tick = (t) => {
          frames++;
          if (t - last > 34) slow++;
          last = t;
          if (scroll) window.scrollBy(0, 14);
          if (t - t0 < ms) requestAnimationFrame(tick);
          else r({ fps: Math.round((frames * 1000) / (t - t0)), slow });
        };
        requestAnimationFrame(tick);
      }),
    [ms, scroll],
  );
  const z = await metrics();
  const d = (k) => Math.round((z[k] - a[k]) * 1000);
  const task = d('TaskDuration');
  return {
    ...fr,
    style: d('RecalcStyleDuration'),
    layout: d('LayoutDuration'),
    script: d('ScriptDuration'),
    other: task - d('RecalcStyleDuration') - d('LayoutDuration') - d('ScriptDuration'),
    busy: `${Math.round((task / ms) * 100)}%`,
  };
};

const rows = [];
for (const path of pages) {
  await p.goto(base + path, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const load = await p.evaluate(
    () =>
      new Promise((r) => {
        const get = (type) =>
          new Promise((res) => {
            const out = [];
            const o = new PerformanceObserver((l) => out.push(...l.getEntries()));
            o.observe({ type, buffered: true });
            setTimeout(() => (o.disconnect(), res(out)), 200);
          });
        Promise.all([get('largest-contentful-paint'), get('layout-shift'), get('longtask')]).then(
          ([lcp, ls, lt]) =>
            r({
              fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0),
              lcp: Math.round(lcp.at(-1)?.startTime ?? 0),
              cls: +ls.filter((e) => !e.hadRecentInput).reduce((s, e) => s + e.value, 0).toFixed(3),
              tbt: Math.round(lt.reduce((s, e) => s + Math.max(0, e.duration - 50), 0)),
              dom: document.getElementsByTagName('*').length,
              anims: document.getAnimations().filter((a) => a.playState === 'running').length,
            }),
        );
      }),
  );
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  const idle = await phase(4000, false);
  const scroll = await phase(4000, true);
  rows.push({ path, ...load, idle, scroll });
}
await b.close();

const f = (x) => `${x.fps}fps ${x.slow}slow busy ${x.busy} (st ${x.style} ly ${x.layout} js ${x.script} oth ${x.other})`;
for (const r of rows)
  console.log(
    `${r.path.padEnd(13)} fcp ${r.fcp} lcp ${r.lcp} cls ${r.cls} tbt ${r.tbt} dom ${r.dom} anims ${r.anims}\n` +
      `   idle   ${f(r.idle)}\n   scroll ${f(r.scroll)}`,
  );
