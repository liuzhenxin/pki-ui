import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  testDir: './browser',
  testMatch: 'ui.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4386',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined
  },
  reporter: [['list']],
  outputDir: '/tmp/authz-p6-ui-browser-results',
  webServer: {
    cwd: path.resolve(currentDirectory, '../..'),
    command:
      'node node_modules/vite/bin/vite.js --config tests/application-authorization/browser/vite.config.ts --host 127.0.0.1 --port 4386 --strictPort',
    url: 'http://127.0.0.1:4386',
    reuseExistingServer: false,
    timeout: 120000
  }
});
