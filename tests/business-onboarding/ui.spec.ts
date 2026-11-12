import { test, expect } from '@playwright/test';
const application = {
  applicationId: 'ba_' + 'a'.repeat(32),
  productTenantId: 10,
  name: '验收应用',
  ownerUserId: '9007199254740993',
  status: 'ACTIVE',
  version: '0',
  credentialVersion: '1'
};
test('无权限不发出请求', async ({ page }) => {
  let requests = 0;
  await page.route('**/admin/v1/business-applications**', async (route) => {
    requests++;
    await route.fulfill({ json: { data: [] } });
  });
  await page.goto('/?denied');
  await expect(page.getByText('需要业务应用接入管理权限及平台管理员身份。')).toBeVisible();
  expect(requests).toBe(0);
});
test('注册重试保持请求和长整数，凭据关闭后清除', async ({ page }) => {
  const bodies: Record<string, string>[] = [];
  await page.route('**/admin/v1/business-applications', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: [] } });
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) return route.fulfill({ status: 503, json: {} });
    await route.fulfill({ json: { data: { application, clientSecret: 'synthetic-once-secret' } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '登记业务应用' }).click();
  const form = page.getByRole('dialog', { name: '登记业务应用' });
  await form.getByRole('textbox').nth(0).fill(application.name);
  await form.getByRole('textbox').nth(1).fill(application.ownerUserId);
  await form.getByRole('button', { name: '登记', exact: true }).click();
  await expect(form.getByRole('button', { name: '重试原请求' })).toBeEnabled();
  await form.getByRole('button', { name: '重试原请求' }).click();
  await expect(page.getByLabel('一次性客户端凭据')).toHaveValue('synthetic-once-secret');
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[0].ownerUserId).toBe(application.ownerUserId);
  await page.getByRole('button', { name: '已保存，关闭' }).click();
  await expect(page.getByLabel('一次性客户端凭据')).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain('synthetic-once-secret');
});
test('轮换与停用携带版本，停用禁止再次操作', async ({ page }) => {
  let current = { ...application };
  const operations: unknown[] = [];
  await page.route('**/admin/v1/business-applications**', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: [current] } });
    operations.push(route.request().postDataJSON());
    if (route.request().url().endsWith('rotate-secret')) {
      current = { ...current, version: '1', credentialVersion: '2' };
      return route.fulfill({ json: { data: { application: current, clientSecret: 'synthetic-rotated' } } });
    }
    current = { ...current, status: 'SUSPENDED', version: '2' };
    return route.fulfill({ json: { data: current } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '轮换凭据' }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByLabel('一次性客户端凭据')).toHaveValue('synthetic-rotated');
  await page.getByRole('button', { name: '已保存，关闭' }).click();
  await page.getByRole('button', { name: '停用', exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('button', { name: '轮换凭据' })).toBeDisabled();
  expect(operations).toEqual([{ expectedVersion: '0' }, { expectedVersion: '1' }]);
});
test('列表故障显示错误并允许刷新恢复', async ({ page }) => {
  let count = 0;
  await page.route('**/admin/v1/business-applications', (route) =>
    ++count === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: { data: [] } })
  );
  await page.goto('/');
  await expect(page.getByText('无法加载登记，请检查权限、服务状态后重试。')).toBeVisible();
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.getByText('暂无业务应用登记')).toBeVisible();
});
