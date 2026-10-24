import AxeBuilder from '@axe-core/playwright';
import { test, expect, hydrated } from './fixtures';

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
  '/privacy',
];

for (const path of PAGES) {
  test(`${path} renders, one h1, no CSP errors, axe clean`, async ({ page, errors }) => {
    test.setTimeout(path === '/streaming' || path === '/arts' ? 120_000 : 30_000); // 639 rows / 190 tiles
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('nav.dock')).toBeVisible();
    await expect(page.locator('footer')).toContainText(/COVER/);
    // axe reads colours as painted: let the islands hydrate and the running fade-ins end first
    // (paused ones, e.g. off-screen, never finish; 3 s caps the wait)
    await hydrated(page);
    await page.evaluate(() =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity)
            .map((a) => a.finished.catch(() => undefined)),
        ),
        new Promise((r) => setTimeout(r, 3000)),
      ]),
    );
    const axe = await new AxeBuilder({ page }).disableRules(['color-contrast-enhanced']).analyze();
    const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join(' | ')}`,
      ),
    ).toEqual([]);
    void errors;
  });
}

test('404 is a real 404 with the lost-at-sea page', async ({ page, errors }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('迷子');
  void errors;
});
