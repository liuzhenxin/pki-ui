import { defineConfig } from '@playwright/test';

if (process.env.CSP_LIVE_BASE_URL) throw new Error('CSP mock tests reject live configuration');

export default defineConfig({
  testDir: './tests/csp',
  testMatch: /\/(e2e|a11y|visual|security)\/.*\.spec\.ts$/,
  testIgnore: ['**/contract/**', '**/remote-tests/**'],
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  outputDir: 'test-results/csp/browser',
  use: {
    browserName: 'chromium',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
