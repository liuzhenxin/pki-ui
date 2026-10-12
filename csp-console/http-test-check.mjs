import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const agreementVersion = readFileSync(new URL('../src/products/csp/agreement.ts', import.meta.url),'utf8').match(/public-v1-sha256-[a-f0-9]{64}/)[0];

// 全部远程页面/API请求拦截为合成数据；绝不连接128或真实Auth。
const local = 'http://127.0.0.1:5187';
const origin = 'http://10.10.10.128:9085';
process.env.VITE_APP_PRODUCT = 'csp';
process.env.VITE_APP_TENANT_IDS = '10';
const server = await preview({
  configFile: fileURLToPath(new URL('../vite.config.csp.ts', import.meta.url)),
  preview: { host: '127.0.0.1', port: 5187, strictPort: true }
});
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.CSP_BROWSER_CHANNEL || undefined });
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
    let authenticated = false;
    let initializationAttempted = false;
    let submissions = 0;
    let step = 0;
    let draftVersion = 0;
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
        body = { csrf: 'synthetic-csrf', authenticated, initializationAttempted, certificateLoginEnabled: true, httpTestMode: scenario.enabled };
      else if (action === 'challenge')
        body = {
          csrf: 'synthetic-csrf',
          captchaEnabled: true,
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ysAAAAASUVORK5CYII='
        };
      else if (action === 'login') {
        assert.equal(allowed, true);
        logins++;
        authenticated = true;
        body = { authenticated: true };
      } else if (['setup','setup-advance','setup-complete'].includes(action)) {
        if(action==='setup-advance') {
          const input=JSON.parse(route.request().postData());assert.equal(input.draftVersion,draftVersion);
          step=input.action==='AGREE'?1:input.action==='CHECK_ENV'?2:3;draftVersion++;
        } else if(action==='setup-complete') {
          assert.equal(allowed,true);assert.deepEqual(JSON.parse(route.request().postData()),{draftVersion,confirm:true});
          initialized=true;initializationAttempted=true;submissions++;
        }
        body={initialized,draftVersion,step,agreed:step>0,attempted:initializationAttempted,agreementVersion,companyName:'测试权利主体',serviceVersion:'v2',environment:'test',checkedAt:step>=2?new Date().toISOString():null,
          accounts:step===0?[]:['SYSTEM_ADMIN','SECURITY_ADMIN','AUDIT_ADMIN'].map(role=>({role,valid:true}))};
      } else if (action === 'logout') {
        authenticated = false;
        initializationAttempted = false;
        body = { authenticated: false };
      } else throw new Error('Unexpected synthetic API action: ' + action);
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
      if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-http-test-login-${scenario.width}.png`, fullPage: true });
      assert.deepEqual(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
        []
      );
      await login.click();
      await page.getByRole('heading', { name: 'CSP 初始化向导' }).waitFor();
      await expect(page.getByText('128 HTTP 测试入口', { exact: false })).toBeVisible();
      if (process.env.CSP_UI_SCREENSHOTS === 'true') await page.screenshot({ path: `/tmp/csp-http-test-setup-${scenario.width}.png`, fullPage: true });
      assert.deepEqual(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => v.id),
        []
      );
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '同意并继续' }).click();
      await page.getByRole('button', { name: '检测并继续' }).click();
      await page.getByRole('button', { name: '核验并继续' }).click();
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '确认并完成初始化' }).dblclick();
      await page.getByRole('heading', { name: '初始化成功，请重新登录' }).waitFor();
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
