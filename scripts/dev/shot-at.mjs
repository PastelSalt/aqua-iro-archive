// Dev helper: node scripts/dev/shot-at.mjs <url> <selector> <out.png> [w] [h] [prefs]
import { chromium } from '@playwright/test';
const [, , url, sel, out, w = '1440', h = '900', prefs = '{"splash":true,"lang":"ja"}'] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.addInitScript((x) => localStorage.setItem('aia:prefs', x), prefs);
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' });
await p.locator(sel).first().scrollIntoViewIfNeeded();
await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start' }), sel);
await p.waitForTimeout(1200);
await p.screenshot({ path: out });
if (errors.length) console.log('ERRORS', errors);
await b.close();
