import { test, expect } from './fixtures';

/**
 * Nothing paints over the content (FULL-UPDATE-PLAN §A3): the fixed page wash, a band or a decoration layer
 * must never sit above the page's heading. This is the bug that blanked the keeper pages (fe0a04d).
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
  '/privacy',
];

const topmostIsInside = (selector: string) => {
  // decorative layers are pointer-events:none, which elementFromPoint would look straight through; turn
  // hit-testing on everywhere so a covering layer (or its ::before) is what gets hit
  const force = document.createElement('style');
  force.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
  document.head.append(force);
  const el = document.querySelector<HTMLElement>(selector)!;
  const r = el.getBoundingClientRect();
  // the first layer that actually paints there (skipping invisible ones, like Events' dusk before it fades in)
  const hit = document
    .elementsFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2)
    .find((h) => {
      const cs = getComputedStyle(h);
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
    });
  force.remove();
  return !!hit && (el === hit || el.contains(hit));
};

for (const path of PAGES) {
  test(`${path}: the heading is the topmost thing where it sits`, async ({ page, errors }) => {
    await page.goto(path);
    await page.locator('h1').first().scrollIntoViewIfNeeded();
    expect(await page.evaluate(topmostIsInside, 'h1')).toBe(true);
    expect(errors).toEqual([]);
  });
}

// /keeper is rendered on demand, so it only exists on a deployment (BASE_URL=https://… npm run test:e2e)
test('keeper sign-in: the form is the topmost thing where it sits', async ({ page, errors }) => {
  test.skip(!process.env.BASE_URL?.startsWith('https://'), 'needs a deployment (BASE_URL=https://…)');
  await page.goto('/keeper/login');
  expect(await page.evaluate(topmostIsInside, 'form')).toBe(true);
  expect(errors).toEqual([]);
});
