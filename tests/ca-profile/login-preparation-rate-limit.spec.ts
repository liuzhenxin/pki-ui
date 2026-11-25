import { expect, test } from '@playwright/test';

const captchaImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ysAAAAASUVORK5CYII=';

test('login initialization recovers from rate limits when each failed resource is retried', async ({ page }) => {
  const calls = { publicKey: 0, captcha: 0, login: 0 };
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install();

  await page.route('**/dev-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/dev-api', '');
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } });
    const limited = (status: number) => route.fulfill({ status, json: { code: 'Too_Many_Requests', msg: '请求过于频繁' } });
    if (path === '/auth/v1/secrets') return ++calls.publicKey === 1 ? limited(200) : ok({ publicKey: 'fixture-key' });
    if (path.startsWith('/auth/v1/username-password/captchas/')) return ++calls.captcha === 1 ? limited(429) : ok(captchaImage);
    if (path === '/admin/v1/tenants/list') return ok([{ id: '4', code: 'ca', name: 'CA' }]);
    if (path === '/admin/v1/tenants/4') return ok({ id: '4', name: 'CA' });
    if (path === '/auth/v1/security/radius/status') return ok({ enabled: false });
    if (path === '/auth/v1/iam-policy/login-hints') return ok({ captchaEnabled: true });
    if (path === '/auth/v1/oauth2/token') calls.login++;
    return route.abort();
  });

  await page.goto('/login');
  const publicKeyWarning = page.getByText('登录公钥请求过于频繁，请稍后重试。');
  const captchaWarning = page.getByText('验证码请求过于频繁，请稍后点击刷新验证码。');
  const login = page.locator('.login-action .login-button');
  await expect(publicKeyWarning).toBeVisible();
  await expect(captchaWarning).toBeVisible();
  await expect(login).toBeDisabled();

  await page.getByRole('button', { name: '重试获取公钥' }).click();
  await expect(publicKeyWarning).toHaveCount(0);
  await expect(captchaWarning).toBeVisible();
  await expect(login).toBeDisabled();
  expect(calls).toEqual({ publicKey: 2, captcha: 1, login: 0 });

  await page.clock.fastForward(1500);
  await page.getByTitle('刷新验证码').click();
  await expect(page.getByAltText('验证码')).toBeVisible();
  await expect(captchaWarning).toHaveCount(0);
  await expect(login).toBeEnabled();
  expect(calls).toEqual({ publicKey: 2, captcha: 2, login: 0 });
  expect(pageErrors).toEqual([]);
});
