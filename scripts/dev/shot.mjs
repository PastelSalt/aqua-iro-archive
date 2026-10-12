// Dev helper: node scripts/dev/shot.mjs <url> <out.png> [width] [height] [fullPage] [prefs-json]
import { chromium } from '@playwright/test';
const [, , url, out, w = '1600', h = '900', full = '0', prefs = '{"splash":true}'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.addInitScript((p) => localStorage.setItem('aia:prefs', p), prefs);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full === '1' });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
