import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const server = await preview({
  configFile: fileURLToPath(new URL('vite.config.ts', import.meta.url)),
  preview: { host: '127.0.0.1', port: 5185, strictPort: true }
});
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    let loginCount = 0;
    let failLogin = false;
    let initialized = false;
    let pinAttempts = 0;
    let certificateLoginAttempts = 0;
    await page.routeWebSocket('ws://127.0.0.1:9001', (socket) => {
      socket.onMessage((raw) => {
        const request = JSON.parse(String(raw));
        let result;
        if (request.method === 'FindCertificates') result = [{ key: 'synthetic-key', value: '测试签名证书', type: 'Sign', cert: 'A'.repeat(100) }];
        else if (request.method === 'CheckPIN') {
          pinAttempts++;
          result = false;
        } else throw new Error('PIN failure must not sign');
        socket.send(JSON.stringify({ id: request.id, result }));
      });
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/console-api/**', async (route) => {
      const action = new URL(route.request().url()).pathname.split('/').pop();
      assert.equal((route.request().postData() || '').includes('Synthetic-PIN-only'), false);
      let body;
      let status = 200;
      if (action === 'session') body = { csrf: 'test-csrf', authenticated: false, certificateLoginEnabled: true };
      else if (action === 'certificate-challenge') body = { challengeId: 'synthetic-challenge', signData: 'dGVzdA', sm2UserId: '1234567812345678' };
      else if (action === 'certificate-login') {
        certificateLoginAttempts++;
        throw new Error('PIN failure must not verify');
      } else if (action === 'challenge')
        body = {
          csrf: 'test-csrf',
          captchaEnabled: true,
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ysAAAAASUVORK5CYII='
        };
      else if (action === 'login') {
        loginCount++;
        body = failLogin ? { message: '测试登录拒绝' } : { authenticated: true };
        if (failLogin) status = 401;
      } else if (action === 'state') body = { initialized };
      else if (action === 'logout') body = { authenticated: false };
      else throw new Error('Unexpected API');
      await route.fulfill({ status, json: body });
    });
    await page.goto('http://127.0.0.1:5185/login');
    await page.getByLabel('账号', { exact: true }).fill('synthetic-admin');
    await page.getByLabel('密码', { exact: true }).fill('Synthetic-password-only');
    await page.getByLabel('图形验证码', { exact: true }).fill('test');
    await page.screenshot({ path: `/tmp/csp-console-login-${width}.png`, fullPage: true });
    assert.deepEqual(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
      []
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    failLogin = true;
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('密码', { exact: true }).inputValue(), '');
    assert.equal(loginCount, 1);
    failLogin = false;
    await page.getByRole('button', { name: '刷新图形验证码' }).click();
    await page.getByLabel('密码', { exact: true }).fill('Synthetic-password-only');
    await page.getByLabel('图形验证码', { exact: true }).fill('test');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByRole('heading', { name: '初始化状态引导' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/csp/setup');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/csp-console-setup-${width}.png`, fullPage: true });
    initialized = true;
    await page.getByRole('button', { name: '刷新状态' }).click();
    await page.getByRole('heading', { name: '运行总览', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/csp/overview');
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor();
    await page.getByRole('button', { name: '证书登录', exact: true }).click();
    await page.getByRole('button', { name: '读取 USB Key 证书' }).click();
    await page.getByLabel('USB Key PIN', { exact: true }).fill('Synthetic-PIN-only');
    await page.screenshot({ path: `/tmp/csp-console-certificate-${width}.png`, fullPage: true });
    assert.deepEqual(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
      []
    );
    await page.getByRole('button', { name: '证书登录', exact: true }).last().click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('USB Key PIN', { exact: true }).inputValue(), '');
    assert.equal(pinAttempts, 1);
    assert.equal(certificateLoginAttempts, 0);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write(`CSP_UI_MOCK_PASS width=${width} login/error/setup/overview/logout/storage/overflow\n`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
