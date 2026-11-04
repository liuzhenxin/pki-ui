import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const shell = `<html lang="zh-CN"><head><title>CSP Mock</title><style>
body{background:#faf9f6;color:#172b42;font:16px sans-serif}a,button{color:#172b42} :focus-visible{outline:3px solid #00685d;outline-offset:3px}
</style></head><body><a href="#main">跳到主要内容</a><header><nav aria-label="主导航"><a href="#main">运行总览</a></nav></header>
<main id="main" tabindex="-1"><h1>密码服务平台 Mock</h1><p role="alert"><span aria-hidden="true">⚠</span>服务已失败关闭</p>
<p aria-live="polite">实时连接已断开</p><button aria-label="刷新运行状态" title="刷新运行状态">刷新</button></main></body></html>`;

test('@shell-a11y synthetic shell keyboard and axe', async ({ page }) => {
  await page.setContent(shell);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '运行总览' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
  await expect(page.getByRole('alert')).toHaveText('⚠服务已失败关闭');
  await expect(page.getByRole('button', { name: '刷新运行状态' })).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新运行状态' })).toHaveAttribute('title', '刷新运行状态');
  await expect(page.locator('[role="alert"] span')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[aria-live="polite"]')).toHaveText('实时连接已断开');
  expect(
    await page
      .locator('a')
      .first()
      .evaluate((element) => getComputedStyle(element).outlineStyle)
  ).toBe('solid');
});
