import { test, expect } from './fixtures';

/**
 * Screenshot record of each chapter's first screen and its deep band (FULL-UPDATE-PLAN §A3), Motion OFF.
 * Local only: `npm run test:visual` (the `visual` project); CI runs the chromium / webkit / mobile projects.
 * Refresh after a reviewed change with `npm run test:visual -- --update-snapshots`.
 */
const PAGES = [
  '/',
  '/about',
  '/clips',
  '/discography',
  '/streaming',
  '/events',
  '/arts',
  '/messages',
  '/credits',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('aia:prefs', JSON.stringify({ splash: true, lang: 'ja', motion: 'off' }));
    localStorage.setItem('aia:hint.dock', 'true');
    localStorage.setItem('aia:tour.done', 'true');
    sessionStorage.setItem('aia:splash', '1');
    localStorage.setItem('aia:hero.outfit', JSON.stringify('0')); // the Home outfit is random otherwise
  });
});

for (const path of PAGES) {
  const name = path === '/' ? 'home' : path.slice(1);
  test(`${name}: first screen`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}-first.png`, {
      // the date-driven "On this day" toast and Talk's typed line change from visit to visit
      mask: [page.locator('.otd'), page.locator('.dialog-box')],
      maxDiffPixelRatio: 0.02,
    });
  });

  test(`${name}: deep band`, async ({ page }) => {
    await page.goto(path);
    const band = page.locator('.band').first();
    test.skip((await band.count()) === 0, 'no band on this page');
    await band.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect(band).toHaveScreenshot(`${name}-band.png`, { maxDiffPixelRatio: 0.02 });
  });
}
