/**
 * Layout and chrome regressions from the 13 Oct 2026 audit (docs/AUDIT-2026-10-13.md):
 * filter bars undock at the end of their section,
 * no page is wider than a phone, and no chapter's first section starts under the dock.
 */
import { test, expect, hydrated } from './fixtures';

const CHAPTERS = ['/about', '/clips', '/discography', '/streaming', '/events', '/arts', '/messages'];

for (const path of ['/discography', '/streaming', '/arts']) {
  test(`${path}: the filter bar docks in its section and undocks at the end (#2)`, async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width: 1366, height: 649 });
    await page.goto(path);
    await hydrated(page);
    const bar = page.locator('[data-topbar]');
    const slotTop = await page
      .locator('.topbar-slot')
      .evaluate((e) => e.getBoundingClientRect().top + scrollY);
    await page.evaluate((y) => scrollTo(0, y + 300), slotTop);
    await expect(bar).toHaveClass(/is-docked/);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).not.toHaveClass(/is-docked/);
    void errors;
  });
}

test.describe('phone', () => {
  // iPhone 13 size and touch (the device preset's browser type can't be set per group)
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  for (const path of ['/', ...CHAPTERS, '/credits', '/privacy']) {
    test(`${path}: no sideways scrolling at 390px (#8)`, async ({ page, errors }) => {
      await page.goto(path);
      await page.waitForTimeout(600);
      const [sw, cw] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(sw).toBeLessThanOrEqual(cw);
      void errors;
    });
  }
});

for (const size of [
  { width: 1366, height: 649 },
  { width: 1920, height: 953 },
]) {
  test(`chapters at ${size.width}: the first section starts below the dock (#9)`, async ({
    page,
    errors,
  }) => {
    test.slow(); // seven full pages in a row
    await page.setViewportSize(size);
    for (const path of CHAPTERS) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const { first, dock } = await page.evaluate(() => ({
        first: document.querySelector('.page-head')!.getBoundingClientRect().bottom,
        dock: document.querySelector('.dock')!.getBoundingClientRect().top,
      }));
      expect(first, path).toBeGreaterThanOrEqual(dock - 1);
    }
    void errors;
  });
}
