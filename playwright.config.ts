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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1600, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
