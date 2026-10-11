import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// 全部远程页面/API请求拦截为合成数据；绝不连接128或真实Auth。
const local = 'http://127.0.0.1:5187';
const origin = 'http://10.10.10.128:9085';
const server = await preview({
  configFile: fileURLToPath(new URL('vite.config.ts', import.meta.url)),
  preview: { host: '127.0.0.1', port: 5187, strictPort: true }
});
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const scenario of [
    { origin, enabled: false, width: 1440 },
    { origin: 'http://10.10.10.129:9085', enabled: true, width: 1440 },
    { origin, enabled: true, width: 1440 },
    { origin, enabled: true, width: 375 }
  ]) {
    const allowed = scenario.enabled && scenario.origin === origin;
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let initialized = false;
    let submissions = 0;
    let logins = 0;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      assert.equal(url.origin, scenario.origin);
      if (!url.pathname.startsWith('/console-api/')) {
        const response = await context.request.get(local + url.pathname, { maxRedirects: 0 });
        await route.fulfill({ response });
        return;
      }
      const action = url.pathname.split('/').pop();
      let body;
      if (action === 'session')
        body = { csrf: 'synthetic-csrf', authenticated: false, certificateLoginEnabled: true, httpTestMode: scenario.enabled };
      else if (action === 'challenge')
        body = {
          csrf: 'synthetic-csrf',
          captchaEnabled: true,
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ysAAAAASUVORK5CYII='
        };
      else if (action === 'login') {
        assert.equal(allowed, true);
        logins++;
        body = { authenticated: true };
      } else if (action === 'state') body = { initialized };
      else if (action === 'environment')
        body = {
          checks: [
            { name: '平台租户', ok: true },
            { name: '管理员/审计员', ok: true }
          ]
        };
      else if (action === 'initialize') {
        assert.equal(allowed, true);
        assert.deepEqual(JSON.parse(route.request().postData()), { confirm: true });
        assert.equal(route.request().headers()['x-csrf-token'], 'synthetic-csrf');
        initialized = true;
        submissions++;
        body = { initialized: true, reauthenticationRequired: true };
      } else if (action === 'logout') body = { authenticated: false };
      else throw new Error('Unexpected synthetic API action: ' + action);
      await route.fulfill({ json: body });
    });
    await page.goto(scenario.origin + '/login');
    await page.getByLabel('账号', { exact: true }).fill('synthetic-admin');
    await page.getByLabel('密码', { exact: true }).fill('Synthetic-password-only');
    await page.getByLabel('图形验证码', { exact: true }).fill('test');
    const login = page.getByRole('button', { name: '登录', exact: true });
    if (!allowed) {
      await expect(login).toBeDisabled();
      assert.equal(await page.getByText('128 HTTP 测试入口', { exact: false }).count(), 0);
      assert.equal(logins, 0);
    } else {
      await expect(login).toBeEnabled();
      await expect(page.getByText('128 HTTP 测试入口', { exact: false })).toBeVisible();
      await page.screenshot({ path: `/tmp/csp-http-test-login-${scenario.width}.png`, fullPage: true });
      assert.deepEqual(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
        []
      );
      await login.click();
      await page.getByRole('heading', { name: 'CSP 初始化向导' }).waitFor();
      await expect(page.getByText('128 HTTP 测试入口', { exact: false })).toBeVisible();
      await page.screenshot({ path: `/tmp/csp-http-test-setup-${scenario.width}.png`, fullPage: true });
      assert.deepEqual(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
        []
      );
      await page.getByRole('button', { name: '下一步：初始化确认' }).click();
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '确认并初始化 CSP' }).dblclick();
      await page.getByRole('heading', { name: '初始化已完成，请重新登录' }).waitFor();
      assert.equal(submissions, 1);
      assert.equal(logins, 1);
      await page.getByRole('button', { name: '退出并重新登录' }).click();
      await page.getByRole('heading', { name: '欢迎回来' }).waitFor();
    }
    await page.getByRole('button', { name: '证书登录', exact: true }).click();
    await expect(page.getByRole('button', { name: '读取 USB Key 证书' })).toBeDisabled();
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write(
      `CSP_HTTP_TEST_UI_MOCK_PASS origin=${scenario.origin} flag=${scenario.enabled} width=${scenario.width} allowed=${allowed}\n`
    );
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
