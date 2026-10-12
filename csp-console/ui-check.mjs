import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const agreementVersion = readFileSync(new URL('../src/products/csp/agreement.ts', import.meta.url), 'utf8').match(/public-v1-sha256-[a-f0-9]{64}/)[0];

process.env.VITE_APP_PRODUCT = 'csp';
process.env.VITE_APP_TENANT_IDS = '10';
const server = await preview({
  configFile: fileURLToPath(new URL('../vite.config.csp.ts', import.meta.url)),
  preview: { host: '127.0.0.1', port: 5185, strictPort: true }
});
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.CSP_BROWSER_CHANNEL || undefined });
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    let loginCount = 0;
    let failLogin = false;
    let initialized = false;
    let stateExpired = false;
    let authenticated = false;
    let initializationAttempted = false;
    let environmentReady = false;
    let initializeCount = 0;
    let step = 0;
    let draftVersion = 0;
    let failInitialization = true;
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
      if (action === 'session') body = { csrf: 'test-csrf', authenticated, initializationAttempted, certificateLoginEnabled: true };
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
        else authenticated = true;
      } else if (['setup', 'setup-advance', 'setup-complete'].includes(action)) {
        if (action === 'setup-advance') {
          const command = JSON.parse(route.request().postData());
          assert.equal(command.draftVersion, draftVersion);
          if (command.action === 'AGREE') { assert.equal(command.agreementVersion, agreementVersion); step = 1; }
          else if (command.action === 'CHECK_ENV') { if (!environmentReady) status = 412; else step = 2; }
          else if (command.action === 'VERIFY_ACCOUNTS') step = 3;
          if (status === 200) draftVersion++;
        } else if (action === 'setup-complete') {
          initializeCount++; initializationAttempted = true;
          assert.deepEqual(JSON.parse(route.request().postData()), { draftVersion, confirm: true });
          if (failInitialization) status = 502; else initialized = true;
        }
        body = { initialized, draftVersion, step, agreed: step > 0, attempted: initializationAttempted,
          agreementVersion, companyName: '测试软件权利主体', serviceVersion: 'test-v2', environment: 'test',
          checkedAt: step >= 2 ? new Date().toISOString() : null,
          accounts: step === 0 ? [] : ['SYSTEM_ADMIN', 'SECURITY_ADMIN', 'AUDIT_ADMIN'].map(role => ({ role, valid: environmentReady })) };
        if (stateExpired) status = 401;
        if (status !== 200) body = { message: '核验或提交未确认' };
      } else if (action === 'logout') {
        authenticated = false;
        initializationAttempted = false;
        body = { authenticated: false };
      } else throw new Error('Unexpected API');
      await route.fulfill({ status, json: body });
    });
    await page.goto('http://127.0.0.1:5185/csp/overview');
    await expect(page).toHaveURL(/\/login$/);
    assert.equal(loginCount, 0);
    await page.evaluate(() => localStorage.setItem('tenantId', '1'));
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await page.evaluate(() => localStorage.clear());
    await page.getByLabel('账号', { exact: true }).fill('synthetic-admin');
    await page.getByLabel('密码', { exact: true }).fill('Synthetic-password-only');
    await page.getByLabel('图形验证码', { exact: true }).fill('test');
    if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-console-login-${width}.png`, fullPage: true });
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
    await page.getByRole('heading', { name: 'CSP 初始化向导' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/csp/setup');
    await page.goto('http://127.0.0.1:5185/csp/overview');
    await expect(page).toHaveURL(/\/csp\/setup$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), []);
    await expect(page.getByRole('button', { name: '同意并继续' })).toBeDisabled();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByRole('heading', { name: '环境检查', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: '环境检查', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '检测并继续' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: '环境检查', exact: true })).toBeVisible();
    environmentReady = true;
    await page.getByRole('button', { name: '检测并继续' }).click();
    await expect(page.getByRole('heading', { name: '账号初始化', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '核验并继续' }).click();
    await expect(page.getByRole('heading', { name: '确认初始化结果' })).toBeVisible();
    assert.equal(await page.getByRole('button', { name: '确认并完成初始化' }).isDisabled(), true);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal((await page.locator('main').innerText()).includes('租户 10'), false);
    await page.getByRole('checkbox').check();
    if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-console-confirm-${width}.png`, fullPage: true });
    assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id), []);
    await page.getByRole('button', { name: '确认并完成初始化' }).click();
    await page.getByRole('heading', { name: '提交结果需要核查' }).waitFor();
    assert.equal(initializeCount, 1);
    await page.getByRole('button', { name: '刷新状态' }).click();
    await page.getByRole('heading', { name: '提交结果需要核查' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '确认并完成初始化' }).count(), 0);
    assert.equal(initializeCount, 1);
    await page.reload();
    await expect(page.getByRole('heading', { name: '提交结果需要核查' })).toBeVisible();
    initialized = true;
    await page.getByRole('button', { name: '刷新状态' }).click();
    await page.getByRole('heading', { name: '初始化成功，请重新登录' }).waitFor();
    await page.getByRole('button', { name: '退出并重新登录' }).click();
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor();
    initialized = false;
    failInitialization = false;
    async function loginAgain() {
      await page.getByLabel('账号', { exact: true }).fill('synthetic-admin');
      await page.getByLabel('密码', { exact: true }).fill('Synthetic-password-only');
      await page.getByLabel('图形验证码', { exact: true }).fill('test');
      await page.getByRole('button', { name: '登录', exact: true }).click();
    }
    await loginAgain();
    await expect(page.getByRole('heading', { name: '确认初始化结果' })).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '确认并完成初始化' }).dblclick();
    await page.getByRole('heading', { name: '初始化成功，请重新登录' }).waitFor();
    assert.equal(initializeCount, 2);
    if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-console-completed-${width}.png`, fullPage: true });
    assert.deepEqual(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
      []
    );
    await page.getByRole('button', { name: '退出并重新登录' }).click();
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor();
    await loginAgain();
    await page.getByRole('heading', { name: '运行总览', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/csp/overview');
    await page.goto('http://127.0.0.1:5185/csp/setup');
    await expect(page).toHaveURL(/\/csp\/overview$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: '运行总览', exact: true })).toBeVisible();
    await page.goto('http://127.0.0.1:5185/csp/not-open');
    await expect(page.getByRole('heading', { name: '页面未开放', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/csp\/overview$/);
    await expect(page.getByRole('heading', { name: '运行总览', exact: true })).toBeVisible();
    if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-shared-overview-${width}.png`, fullPage: true });
    assert.deepEqual(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
      []
    );
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor();
    await page.getByRole('button', { name: '证书登录', exact: true }).click();
    await page.getByRole('button', { name: '读取 USB Key 证书' }).click();
    await page.getByLabel('USB Key PIN', { exact: true }).fill('Synthetic-PIN-only');
    if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-console-certificate-${width}.png`, fullPage: true });
    assert.deepEqual(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
      []
    );
    await page.getByRole('button', { name: '证书登录', exact: true }).last().click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('USB Key PIN', { exact: true }).inputValue(), '');
    assert.equal(pinAttempts, 1);
    assert.equal(certificateLoginAttempts, 0);
    authenticated = true;
    initialized = 'unknown';
    await page.goto('http://127.0.0.1:5185/csp/overview');
    await expect(page).toHaveURL(/\/csp\/setup$/);
    await expect(page.getByRole('heading', { name: '需要确认初始化状态' })).toBeVisible();
    assert.equal(await page.getByRole('button', { name: '确认并完成初始化' }).count(), 0);
    stateExpired = true;
    await page.goto('http://127.0.0.1:5185/csp/overview');
    await expect(page).toHaveURL(/\/login$/);
    assert.equal(loginCount, 4);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write(
      `CSP_UI_MOCK_PASS width=${width} login/error/setup/confirm/ambiguous/no-retry/completion/reauth/overview/logout/deep-link/reload/back/unknown-state/session-expiry/tenant-isolation/storage/overflow/axe\n`
    );
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
