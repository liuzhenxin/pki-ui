import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: 'certificate-list.spec.ts',
  outputDir: '/tmp/ca-root-browser-results',
  use: {
    baseURL: 'http://127.0.0.1:4388',
    timezoneId: 'UTC',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined
  },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'npm run dev -- --host 127.0.0.1 --port 4388 --strictPort',
    env: { BROWSER: 'none' },
    url: 'http://127.0.0.1:4388',
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
});
