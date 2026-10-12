import { test as base, expect, type Page } from '@playwright/test';

/** Every test fails on uncaught errors or CSP violations. Splash and tour are pre-dismissed unless a test opts in. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      const t = m.text();
      if (m.type() === 'error' && !/Failed to load resource|youtube|ytimg|fonts\.gstatic/i.test(t))
        errors.push(`console: ${t}`);
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) errors.push(`csp: ${t}`);
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('aia:prefs'))
        localStorage.setItem('aia:prefs', JSON.stringify({ splash: true, lang: 'ja' }));
      localStorage.setItem('aia:hint.dock', 'true');
      if (!localStorage.getItem('aia:tour.done')) localStorage.setItem('aia:tour.done', 'true');
      if (!sessionStorage.getItem('aia:splash')) sessionStorage.setItem('aia:splash', '1');
    });
    await use(errors);
    expect(errors, errors.join('\n')).toEqual([]);
  },
});
export { expect };

/** Wait until every Preact island has hydrated (WebKit hydrates later than Chromium). */
export const hydrated = (page: Page) =>
  page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
