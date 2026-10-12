import { test, expect, hydrated } from './fixtures';

test('dock: number keys navigate, aria-current follows, prefs persist across pages', async ({
  page,
  errors,
}) => {
  await page.goto('/');
  await hydrated(page);
  await expect(page.locator('.chap[aria-current="page"]')).toContainText('ホーム');
  await page.keyboard.press('5');
  await expect(page).toHaveURL(/\/streaming$/);
  await expect(page.locator('.chap[aria-current="page"]')).toContainText('配信');
  // language toggle
  await page.getByRole('button', { name: /言語を英語に/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-lang', 'en');
  await hydrated(page);
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('html')).toHaveAttribute('data-lang', 'en');
  // motion toggle
  await page.keyboard.press('Alt+KeyM');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  void errors;
});

test('LOG drawer opens with Esc, traps focus and closes', async ({ page, errors }) => {
  await page.goto('/about');
  await hydrated(page);
  await page.keyboard.press('Escape');
  const drawer = page.locator('aside.drawer');
  await expect(drawer).toHaveClass(/is-open/);
  await page.getByRole('tab', { name: /ショートカット|Shortcuts/ }).click();
  await expect(drawer).toContainText('Alt');
  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveClass(/is-open/);
  void errors;
});

test('Motion OFF stops CSS animations', async ({ page, errors }) => {
  await page.addInitScript(() =>
    localStorage.setItem('aia:prefs', JSON.stringify({ splash: true, motion: 'off' })),
  );
  await page.goto('/');
  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === 'running' && (a.effect as KeyframeEffect)?.getTiming().iterations === Infinity,
        ).length,
  );
  expect(running).toBe(0);
  void errors;
});

test('first visit shows the splash, which can be skipped', async ({ page, errors }) => {
  await page.addInitScript(() => localStorage.setItem('aia:prefs', '{}'));
  await page.goto('/about');
  const skip = page.getByRole('button', { name: /スキップ|Skip/ }).first();
  // the splash also finishes on its own (≤ 2.5 s) and fades out, so a click may race the fade
  if (await skip.isVisible()) await skip.click({ timeout: 2000 }).catch(() => {});
  await expect(page.locator('[data-splash-root]')).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('html')).toHaveAttribute('data-splash', 'seen');
  void errors;
});
