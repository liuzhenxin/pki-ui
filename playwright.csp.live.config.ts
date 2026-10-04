import { defineConfig } from '@playwright/test';

if (process.env.CSP_LIVE_CONTRACT !== 'true') throw new Error('Explicit CSP_LIVE_CONTRACT=true required');
const target = new URL(process.env.CSP_LIVE_BASE_URL ?? '');
const allowed = (process.env.CSP_LIVE_ALLOWED_ORIGINS ?? '').split(',');
if (target.protocol !== 'https:' || target.username || target.password || !allowed.includes(target.origin)) {
  throw new Error('CSP live origin must be explicitly allowlisted HTTPS');
}
for (const name of ['CSP_LIVE_INITIATOR_SECRET', 'CSP_LIVE_APPROVER_A_SECRET', 'CSP_LIVE_APPROVER_B_SECRET']) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

export default defineConfig({
  testDir: './tests/csp/contract',
  testMatch: '**/*.spec.ts',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  outputDir: 'test-results/csp/live',
  use: { browserName: 'chromium', baseURL: target.origin, timezoneId: 'Asia/Shanghai' }
});
