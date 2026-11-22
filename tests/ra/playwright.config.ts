import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: 'alert-expiry-scope.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4398',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined
  },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'npm run dev -- --host 127.0.0.1 --port 4398 --strictPort',
    env: { BROWSER: 'none', VITE_APP_TENANT_IDS: '5', VITE_APP_CLIENT_ID: 'pki-ra-ui' },
    url: 'http://127.0.0.1:4398',
    timeout: 120000
  }
});
