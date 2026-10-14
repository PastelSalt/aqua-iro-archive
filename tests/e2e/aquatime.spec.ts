/** Aqua Time (IMPROVEMENT-PLAN Part 2 A): travel to a day, see the archive change, come back. */
import { test, expect, hydrated } from './fixtures';

test('Aqua Time: travel to 2020.08.08, the site follows, then back to the present', async ({
  page,
  errors,
}) => {
  await page.addInitScript(() => sessionStorage.setItem('aia:onthisday', '1'));
  await page.setViewportSize({ width: 1366, height: 649 });
  await page.goto('/');
  await hydrated(page);
  await page.locator('.dock__sys [data-sys="time"]').click();
  const range = page.locator('.timedeck input[type=range]');
  await expect(range).toBeVisible();
  await range.evaluate((el: HTMLInputElement) => {
    el.value = '731'; // 2018.08.08 + 731 days
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('.timedeck__counter')).toHaveText('2020.08.08');
  await page.locator('.timedeck__actions .btn--primary').click();
  await expect(page.locator('html')).toHaveAttribute('data-time', '2020-08-08');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await page.keyboard.press('Escape');
  // Home: the outfit she wore then (original maid, index 1) and a greeting about the day
  await expect(page.locator('[data-pose="1"]').first()).toHaveClass(/is-on/);
  await expect(page.locator('.dialog-box__text')).toContainText(/デビュー記念日|debut anniversary/);
  // the choice survives a page change, and Discography marks later songs
  await page.goto('/discography');
  await expect(page.locator('.jacket.is-notyet').first()).toBeAttached();
  // back to the present
  await page.locator('.time-badge__x').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-time', /./);
  await expect(page.locator('.jacket.is-notyet')).toHaveCount(0);
  void errors;
});
