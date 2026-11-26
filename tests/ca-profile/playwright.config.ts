import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: ['maximum-validity.spec.ts', 'login-preparation-rate-limit.spec.ts'],
  outputDir: '/private/tmp/ca-profile-validity-browser-results',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4397',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined
  },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'npm run dev -- --host 127.0.0.1 --port 4397 --strictPort',
    env: { BROWSER: 'none', VITE_APP_TENANT_IDS: '4', VITE_APP_CLIENT_ID: 'pki-ca-ui' },
    url: 'http://127.0.0.1:4397',
    timeout: 120000,
    reuseExistingServer: false
  }
});
