/**
 * The dock (docs/DOCK-PLAN.md §7): one size that never changes, every button clickable at every width,
 * the same height in both languages, one current-chapter style, library icons, and the narrow layout's
 * MORE sheet with everything in it.
 */
import { test, expect, hydrated } from './fixtures';
import type { Page } from '@playwright/test';

const WIDE = [
  { width: 1920, height: 953 },
  { width: 1366, height: 649 },
  { width: 1024, height: 700 },
];
const NARROW = [
  { width: 768, height: 1024 },
  { width: 390, height: 664 },
];
const ICONS: Record<string, string> = {
  '/': 'house',
  '/about': 'identification-card',
  '/clips': 'scissors',
  '/discography': 'vinyl-record',
  '/streaming': 'broadcast',
  '/events': 'sailboat',
  '/arts': 'palette',
  '/messages': 'push-pin',
};

const box = (page: Page) =>
  page.locator('nav.dock').evaluate((d) => {
    const r = d.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  });

for (const size of WIDE) {
  test(`dock at ${size.width}: all 14 buttons show and can be clicked`, async ({ page, errors }) => {
    await page.setViewportSize(size);
    await page.goto('/events');
    await hydrated(page);
    const btns = page.locator('nav.dock .dbtn:visible');
    await expect(btns).toHaveCount(14);
    for (const b of await btns.all()) await b.click({ trial: true, timeout: 2000 });
    void errors;
  });
}

for (const size of NARROW) {
  test(`dock at ${size.width}: 5 chapters + MORE, and MORE holds every chapter and system button`, async ({
    page,
    errors,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/arts'); // not one of the five: it takes Clips' place so the current chapter shows
    await hydrated(page);
    const btns = page.locator('nav.dock .dbtn:visible');
    await expect(btns).toHaveCount(6);
    await expect(page.locator('nav.dock .dbtn[aria-current="page"]')).toBeVisible();
    for (const b of await btns.all()) await b.click({ trial: true, timeout: 2000 });
    await page.locator('.dock__more .dbtn').click();
    const sheet = page.locator('.dock-sheet');
    await expect(sheet.locator('.dock-sheet__grid .dbtn')).toHaveCount(8);
    await expect(sheet.locator('.dock-sheet__sys .dbtn')).toHaveCount(6);
    for (const b of await sheet.locator('.dbtn').all()) await b.click({ trial: true, timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    void errors;
  });
}

test('the dock never changes size: top, scrolled down, scrolled up, hovered', async ({ page, errors }) => {
  await page.setViewportSize({ width: 1366, height: 649 });
  await page.goto('/clips');
  await hydrated(page);
  const at = await box(page);
  await page.mouse.move(683, 200);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(500);
  expect(await box(page)).toEqual(at);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(500);
  expect(await box(page)).toEqual(at);
  await page.locator('nav.dock [data-sys="time"]').hover();
  await page.waitForTimeout(300);
  expect(await box(page)).toEqual(at);
  void errors;
});

test('the dock is the same size in Japanese and English', async ({ page, errors }) => {
  await page.setViewportSize({ width: 1366, height: 649 });
  await page.goto('/streaming');
  await hydrated(page);
  const ja = await box(page);
  await page.locator('nav.dock [data-sys="lang"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-lang', 'en');
  expect(await box(page)).toEqual(ja);
  void errors;
});

test('every chapter shows its library icon, and the pill sits behind the current chapter', async ({
  page,
  errors,
}) => {
  test.slow(); // eight pages
  await page.setViewportSize({ width: 1366, height: 649 });
  for (const [path, icon] of Object.entries(ICONS)) {
    await page.goto(path);
    await hydrated(page);
    const cur = page.locator('nav.dock .dbtn[aria-current="page"]');
    await expect(cur.locator('use')).toHaveAttribute('href', `#ph-${icon}`);
    expect(await page.locator(`#ph-${icon}`).count(), path).toBe(1);
    await expect(page.locator('nav.dock')).toHaveClass(/has-pill/);
    const [b, p] = await Promise.all([cur.boundingBox(), page.locator('.dock__pill').boundingBox()]);
    expect(Math.abs(b!.x - p!.x), path).toBeLessThan(1.5);
    expect(Math.abs(b!.width - p!.width), path).toBeLessThan(1.5);
  }
  void errors;
});

test('the pill slides to the new chapter on a page change (and not with Motion OFF)', async ({
  page,
  errors,
}) => {
  await page.setViewportSize({ width: 1366, height: 649 });
  await page.goto('/about');
  await hydrated(page);
  const pill = page.locator('.dock__pill');
  expect(await pill.evaluate((e) => getComputedStyle(e).transitionDuration)).not.toBe('0s');
  await page.locator('nav.dock a[href="/clips"]').click();
  await expect(page).toHaveURL(/\/clips$/, { timeout: 15_000 });
  await expect
    .poll(async () => {
      const [b, p] = await Promise.all([
        page.locator('nav.dock .dbtn[aria-current="page"]').boundingBox(),
        pill.boundingBox(),
      ]);
      return Math.round(Math.abs(b!.x - p!.x));
    })
    .toBe(0);
  await page.keyboard.press('Alt+KeyM');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(await pill.evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
  void errors;
});
