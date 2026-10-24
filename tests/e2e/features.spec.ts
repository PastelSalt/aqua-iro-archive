import { test, expect, hydrated } from './fixtures';

test('Talk with Aqua: shows text without JS, then open → choose → reply', async ({ page, errors }) => {
  const talk = page.waitForResponse((r) => r.url().endsWith('/talk.json'));
  await page.goto('/');
  await expect(page.locator('.dialog-box__text')).toContainText('こんあくあ');
  await talk;
  await hydrated(page);
  await page.locator('[data-advance]').click();
  // advance through opening lines until choices appear
  for (let i = 0; i < 6 && !(await page.locator('.choice').first().isVisible()); i++)
    await page.locator('[data-advance]').click();
  await expect(page.locator('.choice')).not.toHaveCount(0);
  const n = await page.locator('.choice').count();
  expect(n).toBeLessThanOrEqual(3);
  await page.keyboard.press('1');
  await expect(page.locator('.choice')).toHaveCount(0);
  void errors;
});

test('Streaming: year filter, tag filter, search and URL state', async ({ page, errors }) => {
  test.slow(); // the 639-row page is heavy when the suite runs in parallel
  await page.goto('/streaming');
  await expect(page.locator('[data-stream-count]')).toContainText('639');
  await page.locator('[data-year="2020"]').click();
  await expect(page.locator('[data-stream-count]')).toContainText('197');
  await expect(page).toHaveURL(/year=2020/);
  await page.locator('[data-tag="apex"]').click();
  await expect(page).toHaveURL(/tag=apex/);
  await page.locator('[data-year="all"]').click();
  await page.locator('[data-tag="apex"]').click();
  await page.locator('[data-stream-search]').fill('エルデンリング');
  await expect(page.locator('.srow:not([hidden])').first()).toContainText(/ELDEN|エルデン/i);
  await expect(page).toHaveURL(/q=/);
  await page.reload();
  await expect(page.locator('[data-stream-search]')).toHaveValue('エルデンリング');
  void errors;
});

test('Clips: filter chips keep URL state', async ({ page, errors }) => {
  await page.goto('/clips');
  await page.locator('[data-tag="gaming"]').click();
  await expect(page).toHaveURL(/tag=gaming/);
  const visible = await page.locator('.clip:not([hidden])').count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(30);
  void errors;
});

test('Arts: lightbox opens, arrows move, Esc closes and returns focus', async ({ page, errors }) => {
  await page.goto('/arts');
  const first = page.locator('.art-tile__link').first();
  await first.click();
  const dialog = page.locator('dialog.lightbox');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-credit]')).toContainText('©');
  await expect(page).toHaveURL(/#art=/);
  const before = await dialog.locator('.lightbox__pan img').getAttribute('src');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.locator('.lightbox__pan img')).not.toHaveAttribute('src', before!);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
  void errors;
});

test('Discography: tabs switch with arrow keys and hash', async ({ page, errors }) => {
  await page.goto('/discography');
  await page.getByRole('tab', { selected: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#units$/);
  await expect(page.locator('#units')).toBeVisible();
  await expect(page.locator('#originals')).toBeHidden();
  void errors;
});
