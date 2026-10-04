import { expect, test } from '@playwright/test';

test('@csp-smoke-e2e local capability request', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://csp.test' || url.pathname !== '/csp/health') {
      await route.abort();
      throw new Error('Unregistered mock request');
    }
    requests.push(url.pathname);
    await route.fulfill({ json: { status: '健康' }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.setContent('<main aria-label="密码服务平台"><h1>运行总览</h1><output aria-live="polite"></output></main>');
  await page.evaluate(async () => {
    const response = await fetch('http://csp.test/csp/health');
    const body = await response.json();
    document.querySelector('output')!.textContent = body.status;
  });
  await expect(page.getByRole('heading', { name: '运行总览' })).toBeVisible();
  await expect(page.locator('output')).toHaveText('健康');
  expect(requests).toEqual(['/csp/health']);
});
