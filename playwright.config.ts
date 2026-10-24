import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4321', trace: 'retain-on-failure' },
  // the built static site with vercel.json headers (CSP included); board/keeper flows need a deployment (BASE_URL)
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node scripts/dev/serve-dist.mjs 4321',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  // screenshots live beside the specs and aren't per-platform: the visual project only runs locally
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  projects: [
    {
      name: 'chromium',
      testIgnore: /visual\.spec/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
    {
      name: 'webkit',
      testIgnore: /visual\.spec/,
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1600, height: 900 },
        // Playwright's WebKit renders without a GPU: with every ambient animation running a page draws ~2
        // frames a second, so nothing is ever "stable" enough to click. Reduced motion starts the site in
        // Motion OFF (as for any visitor with that setting); Chromium covers the animated paths.
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
    { name: 'mobile', testIgnore: /visual\.spec/, use: { ...devices['iPhone 13'] } },
    // npm run test:visual — the slow laptop's screen and a phone (FULL-UPDATE-PLAN §A3)
    {
      name: 'visual-laptop',
      testMatch: /visual\.spec/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 649 } },
    },
    {
      name: 'visual-phone',
      testMatch: /visual\.spec/,
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
    },
  ],
});
