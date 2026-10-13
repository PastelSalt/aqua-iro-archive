import { test, expect, hydrated } from './fixtures';

test('dock: number keys navigate, aria-current follows, prefs persist across pages', async ({
  page,
  errors,
}) => {
  await page.goto('/');
  await hydrated(page);
  await expect(page.locator('.chap[aria-current="page"]')).toContainText('ホーム');
  // a light page: /streaming is ~0.5 MB of HTML and WebKit on CI can take >5 s to swap it in
  await page.keyboard.press('3');
  await expect(page).toHaveURL(/\/clips$/, { timeout: 15_000 });
  await expect(page.locator('.chap[aria-current="page"]')).toContainText('切り抜き');
  // language toggle
  await page.getByRole('button', { name: /言語を英語に/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-lang', 'en');
  await hydrated(page);
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/\/about$/, { timeout: 15_000 });
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
  const drawer = page.locator('aside.drawer--log');
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
  await page.addInitScript(() => {
    localStorage.setItem('aia:prefs', '{}');
    sessionStorage.removeItem('aia:splash');
  });
  // record what the page showed at DOMContentLoaded (the splash only lasts 1.6–3.2 s, so a slow
  // runner can miss it); module scripts have run by then, so a skipped splash is already removed
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      const w = window as unknown as { __splash?: string | null };
      w.__splash = document.querySelector('[data-splash-root] .splash__by')?.getAttribute('href') ?? null;
    }),
  );
  await page.goto('/about');
  expect(await page.evaluate(() => (window as unknown as { __splash?: string }).__splash)).toMatch(/moesoft/);
  const skip = page.getByRole('button', { name: /スキップ|Skip/ }).first();
  // the splash also finishes on its own (≤ 3.2 s) and fades out, so a click may race the fade
  if (await skip.isVisible()) await skip.click({ timeout: 2000 }).catch(() => {});
  await expect(page.locator('[data-splash-root]')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('html')).toHaveAttribute('data-splash', 'seen');
  void errors;
});

test('first-visit tour walks through the controls, and HELP replays it after a reload', async ({
  page,
  errors,
}) => {
  test.slow(); // two splash + tour runs and a full reload
  await page.addInitScript(() => localStorage.removeItem('aia:tour.done'));
  await page.goto('/');
  const card = page.locator('.tour__card');
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText(/1 \/ \d+/);
  const total = Number((await card.locator('.tour__count b').textContent())!.split('/')[1]);
  expect(total).toBeGreaterThanOrEqual(10); // Home has every step, including BGM and the Talk buttons
  for (let n = 0; n < total; n++) await card.locator('[data-next]').click();
  await expect(page.locator('.tour')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('aia:tour.done'))).toBe('true');

  await hydrated(page);
  await page.getByRole('button', { name: /ヘルプ|Help and how-to/ }).click();
  const help = page.locator('aside.drawer--help');
  await expect(help).toHaveClass(/is-open/);
  await help.getByRole('button', { name: /ツアーをもう一度|Replay the tour/ }).click();
  // check at DOMContentLoaded: by the full load event the 1.6 s splash may already be fading out
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    help.getByRole('button', { name: /再生する|Yes, replay/ }).click(),
  ]);
  // the replay shows the loading screen again even though it was seen this session
  // (without a replay the splash removes itself at once on a session that has already seen it)
  await expect(page.locator('[data-splash-root]')).toBeAttached();
  await expect(page.locator('.tour__card')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour')).toHaveCount(0);
  void errors;
});
