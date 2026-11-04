import { expect, test } from '@playwright/test';

for (const [width, height] of [
  [1440, 900],
  [1920, 1080],
  [1180, 800],
  [992, 768]
]) {
  test(`@shell-visual mock-fail-closed-${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.clock.install({ time: new Date('2026-10-04T00:00:00Z') });
    await page.setContent(
      '<html lang="zh-CN"><head><title>CSP Mock</title><style>body{font:16px sans-serif;background:#faf9f6;color:#172b42}main{padding:32px}</style></head><body><main><h1>密码服务平台 Mock</h1><p role="alert">服务已失败关闭</p><p>快照：2026-10-04 08:00:00</p></main></body></html>'
    );
    await expect(page).toHaveScreenshot(`mock-fail-closed-${width}x${height}.png`, { maxDiffPixels: 0 });
  });
}
