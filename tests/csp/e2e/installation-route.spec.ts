import { test, expect } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { CSP_AGREEMENT_VERSION } from '../../../src/products/csp/agreement';

test.use({ video: 'off' });

const fixtureToken = 'fixture-platform-token';
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const loginPublicKey = publicKey.export({ type: 'spki', format: 'pem' });
const captchaImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ysAAAAASUVORK5CYII=';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    if (sessionStorage.getItem('fixture-platform-bootstrapped')) return;
    localStorage.setItem('tenantId', '10');
    localStorage.setItem('tenantCode', 'csp');
    localStorage.setItem('Admin-Token', token);
    sessionStorage.setItem('fixture-platform-bootstrapped', 'true');
  }, fixtureToken);
});

let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url?.split('?')[0] || '/';
    const name = /^\/assets\/[A-Za-z0-9_.-]+$/.test(path) || path === '/csp-mark.svg' ? path : '/index.html';
    try {
      res.writeHead(200, {
        'Content-Type':
          { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(name)] ||
          'application/octet-stream'
      });
      res.end(readFileSync(resolve('dist-csp', '.' + name)));
    } catch {
      res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
});

test.afterAll(async () => {
  await new Promise<void>((done) => {
    server.closeAllConnections();
    server.close(() => done());
  });
});

for (const width of [1440, 390])
  test('mock installation entry and permissions at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let initialized = false;
    let canInitialize = true;
    let authenticated = true;
    let captchaUuid: string | undefined;
    const calls: string[] = [];
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        failures.push(url.origin);
        return route.abort();
      }
      if (url.pathname.startsWith('/console-api/')) {
        failures.push(url.pathname);
        return route.abort();
      }
      if (!url.pathname.startsWith('/api-gateway/')) return route.continue();
      const path = url.pathname.replace('/api-gateway', '');
      const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } });
      if (path.startsWith('/csp/')) {
        expect(route.request().headers().authorization).toBe('Bearer ' + fixtureToken);
      }
      if (path === '/csp/v1/console/session') {
        calls.push('session');
        return authenticated
          ? ok({ authenticated, initialized, canInitialize, canManageServices: true })
          : route.fulfill({ status: 401, json: { code: 'Unauthorized' } });
      }
      if (path === '/auth/v1/tokens') {
        authenticated = false;
        return ok(null);
      }
      if (path === '/auth/v1/oauth2/token') {
        const body = new URLSearchParams(route.request().postData() || '');
        expect(body.get('tenant_code')).toBe('csp');
        expect(body.get('captcha')).toBe('A123');
        expect(body.get('uuid')).toBe(captchaUuid);
        calls.push('login');
        authenticated = true;
        return route.fulfill({ json: { access_token: fixtureToken } });
      }
      if (path === '/auth/v1/secrets') return ok({ publicKey: loginPublicKey });
      if (path === '/admin/v1/tenants/list') return ok([{ id: '10', code: 'csp', name: '密码服务平台' }]);
      if (path === '/admin/v1/tenants/10') return ok({ id: '10', name: '密码服务平台' });
      if (path === '/auth/v1/security/radius/status') return ok({ enabled: false });
      if (path === '/auth/v1/iam-policy/login-hints') return ok({ captchaEnabled: true });
      if (path.startsWith('/auth/v1/username-password/captchas/')) {
        captchaUuid = path.split('/').at(-1);
        return ok(captchaImage);
      }
      if (path === '/csp/v2/setup') {
        calls.push('installation');
        return ok({
          initialized,
          draftVersion: '0',
          step: initialized ? 3 : 0,
          agreed: initialized,
          attempted: false,
          agreementVersion: CSP_AGREEMENT_VERSION,
          companyName: '虚构 CSP 测试公司',
          accounts: [],
          checkedAt: null
        });
      }
      if (path === '/csp/v3/setup') return route.fulfill({ status: 503, json: { msg: '服务状态暂不可用' } });
      if (path === '/csp/v3/services') return ok({ items: [], hasMore: false });
      failures.push(path);
      return route.abort();
    });

    await page.goto(origin + '/csp/installation');
    await expect(page).toHaveURL(origin + '/csp/setup');
    await expect(page.getByRole('heading', { name: '安装初始化', exact: true })).toBeVisible();
    await expect(page.locator('.setup-steps li')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: '公共用户协议' })).toBeVisible();
    await expect(page.getByText('资源接入与服务启用', { exact: true })).toHaveCount(0);
    expect(calls).not.toContain('setup');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/csp/installation-route-' + width + '.png', fullPage: true });

    await page.goto(origin + '/csp/management');
    await expect(page).toHaveURL(origin + '/csp/setup');
    if (width < 992) await page.getByRole('button', { name: '切换导航菜单' }).click();
    const navigation = page.getByRole('navigation', { name: '控制台导航' });
    await expect(navigation.getByRole('menuitem')).toHaveText(['安装初始化']);
    if (width < 992) await page.getByRole('button', { name: '关闭导航菜单' }).click({ position: { x: width - 20, y: 100 } });

    initialized = true;
    await page.getByRole('button', { name: '退出登录' }).click();
    await expect(page).toHaveURL(origin + '/login');
    await page.getByLabel('用户名', { exact: true }).fill('fixture-admin');
    await page.getByLabel('密码', { exact: true }).fill('fixture-password');
    await expect(page.getByRole('img', { name: '验证码' })).toBeVisible();
    await page.getByLabel('验证码', { exact: true }).fill('A123');
    await page.getByRole('button', { name: '登 录', exact: true }).click();
    expect(calls.filter((action) => action === 'login')).toHaveLength(1);
    await expect(page).toHaveURL(origin + '/csp/overview');
    await page.goto(origin + '/csp/setup');
    await expect(page).toHaveURL(origin + '/csp/overview');
    if (width < 992) await page.getByRole('button', { name: '切换导航菜单' }).click();
    await expect(navigation.getByRole('menuitem', { name: '运行总览' })).toBeVisible();
    await expect(navigation.getByRole('menuitem', { name: '应用接入' })).toBeVisible();
    await expect(navigation.getByRole('menuitem', { name: '安装初始化' })).toHaveCount(0);
    if (width < 992) await page.getByRole('button', { name: '关闭导航菜单' }).click({ position: { x: width - 20, y: 100 } });
    await expect(page.getByText('服务状态尚未确认', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '刷新状态' }).click();
    await expect(page).toHaveURL(origin + '/csp/overview');
    await expect(page.getByText('资源接入与服务启用', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    canInitialize = false;
    const previousInstallations = calls.filter((action) => action === 'installation').length;
    for (const entry of ['/csp/setup', '/csp/installation']) {
      await page.goto(origin + entry);
      await expect(page).toHaveURL(origin + '/csp/management');
      await expect(page.getByRole('heading', { name: '服务与应用管理', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: '安装初始化' })).toHaveCount(0);
    }
    expect(calls.filter((action) => action === 'installation')).toHaveLength(previousInstallations);

    authenticated = false;
    await page.goto(origin + '/csp/setup');
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    expect(calls.filter((action) => action === 'installation')).toHaveLength(previousInstallations);
    expect(calls).not.toContain('setup-advance');
    expect(calls).not.toContain('setup-complete');
    expect(failures).toEqual([]);
  });

test('account initialization verifies the seeded accounts before submitting credentials', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let completed = false;
  const verifications: unknown[] = [];
  const submissions: unknown[] = [];
  const state = {
    draftVersion: 2,
    step: 2,
    agreed: true,
    attempted: false,
    checkedAt: '2026-11-11T00:00:00Z',
    environment: 'test',
    serviceVersion: 'test',
    companyName: '虚构 CSP 测试公司',
    agreementVersion: CSP_AGREEMENT_VERSION,
    accounts: [
      { role: 'SYSTEM_ADMIN', valid: true },
      { role: 'AUDIT_ADMIN', valid: true }
    ]
  };
  await page.route('**/api-gateway/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session'))
      return route.fulfill({ json: { code: 'OK', data: { authenticated: true, initialized: completed, canInitialize: true } } });
    if (path.endsWith('/setup/advance')) {
      verifications.push(route.request().postDataJSON());
      state.draftVersion = 3;
      state.step = 3;
    }
    if (path.endsWith('/setup/complete')) {
      submissions.push(route.request().postDataJSON());
      completed = true;
    }
    return route.fulfill({ json: { code: 'OK', data: { ...state, initialized: completed } } });
  });
  await page.goto(origin + '/csp/setup');
  const admin = page.getByRole('group', { name: '系统管理员' });
  const auditor = page.getByRole('group', { name: '审计管理员' });
  const finish = page.getByRole('button', { name: '提交初始化' });
  await expect(page.getByRole('heading', { name: '账号初始化', exact: true })).toBeVisible();
  await expect(admin.getByLabel('用户名')).toHaveValue('admin');
  await expect(auditor.getByLabel('用户名')).toHaveValue('auditor');
  await expect(admin.getByLabel('用户名')).not.toBeEditable();
  await expect(auditor.getByLabel('用户名')).not.toBeEditable();
  await expect(finish).toBeDisabled();
  for (const group of [admin, auditor]) {
    await group.getByLabel('登录密码', { exact: true }).fill('fixture-system-password');
    await group.getByLabel('确认密码', { exact: true }).fill('fixture-system-password');
  }
  await expect(finish).toBeDisabled();
  await auditor.getByLabel('登录密码', { exact: true }).fill('fixture-audit-password');
  await expect(auditor.getByText('两次输入的密码不一致')).toBeVisible();
  await auditor.getByLabel('确认密码', { exact: true }).fill('fixture-audit-password');
  await expect(finish).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await finish.click();
  await expect(page.getByRole('heading', { name: '初始化成功，请重新登录' })).toBeVisible();
  expect(verifications).toEqual([{ draftVersion: 2, action: 'VERIFY_ACCOUNTS' }]);
  expect(submissions).toEqual([
    {
      draftVersion: 3,
      confirm: true,
      admin: { password: 'fixture-system-password' },
      auditor: { password: 'fixture-audit-password' }
    }
  ]);
});

test('audit administrator and auditor land on separate menus and routes', async ({ page }) => {
  let isAuditAdmin = true;
  const calls: string[] = [];
  await page.route('**/api-gateway/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const action = path.split('/').at(-1);
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } });
    calls.push(path);
    if (action === 'session')
      return ok({
        authenticated: true,
        initialized: true,
        canInitialize: false,
        canManageServices: false,
        canManageAuditors: isAuditAdmin,
        canReadLoginLogs: !isAuditAdmin,
        canReadOperationLogs: !isAuditAdmin
      });
    if (action === 'ui-context') return ok({ mode: 'ENFORCE', multiRoleEnabled: false });
    return ok({ total: 1, records: [{ id: '901', username: 'fixture-auditor', operator: 'fixture-auditor', status: 0 }] });
  });
  await page.goto(origin + '/csp/login-logs');
  await expect(page).toHaveURL(origin + '/csp/auditors');
  await expect(page.getByRole('menuitem')).toHaveText(['审计员管理']);
  await expect(page.getByText('fixture-auditor')).toBeVisible();
  expect(calls).not.toContain('/api-gateway/admin/v1/login-logs/page');
  isAuditAdmin = false;
  await page.goto(origin + '/csp/auditors');
  await expect(page).toHaveURL(origin + '/csp/login-logs');
  await expect(page.getByRole('menuitem')).toHaveText(['登录日志', '操作日志']);
  await page.getByRole('menuitem', { name: '操作日志' }).click();
  await expect(page.getByRole('heading', { name: '操作日志' })).toBeVisible();
  await expect(page.getByText('fixture-auditor')).toBeVisible();
  expect(calls).toContain('/api-gateway/admin/v1/operate-logs/page');
  expect(calls).not.toContain('/api-gateway/csp/v2/setup');
});
