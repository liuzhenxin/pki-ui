import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
let server: Server;
let origin: string;
const appId = 'ba_' + 'a'.repeat(32);
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url?.split('?')[0] || '/';
    const name = path.startsWith('/assets/') && /^\/assets\/[A-Za-z0-9_.-]+$/.test(path) ? path : path === '/csp-mark.svg' ? path : '/index.html';
    try {
      const bytes = readFileSync(resolve('dist-csp', '.' + name));
      res.writeHead(200, {
        'Content-Type':
          { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(name)] ||
          'application/octet-stream'
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
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
  test('@management-flow mock built application at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const failures: string[] = [];
    const calls: { action: string; body: Record<string, unknown> }[] = [];
    let conflict = true;
    const resource = {
      serviceId: 'svs-demo',
      family: 'SVS',
      poolKey: 'sign-pool',
      adapterKey: 'simulation-v1',
      enabled: true,
      simulated: true,
      healthy: false,
      version: '1'
    };
    let view = {
      applicationId: appId,
      version: '0',
      state: 'UNREGISTERED',
      platformVersion: null as string | null,
      proposerId: null as string | null,
      approverId: null as string | null,
      policy: null as Record<string, unknown> | null
    };
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        failures.push(url.origin);
        return route.abort();
      }
      if (!url.pathname.startsWith('/console-api/')) return route.continue();
      const action = url.pathname.split('/').at(-1)!;
      const body = route.request().postDataJSON() || {};
      calls.push({ action, body });
      let result: unknown;
      if (action === 'session') result = { csrf: 'public-test-csrf', authenticated: true };
      else if (action === 'service-list') result = { items: [resource], hasMore: false };
      else if (action === 'service-save') {
        if (conflict) {
          conflict = false;
          return route.fulfill({ status: 409, json: { message: '版本或审批条件已变化，请刷新后核对。未自动重试。' } });
        }
        result = { ...resource, ...body, version: '2' };
      } else if (action === 'application-list')
        result = {
          items: [{ applicationId: appId, name: '合同应用', platformStatus: 'ACTIVE', onboardingState: view.state, version: view.version }],
          hasMore: false
        };
      else if (action === 'application-view') result = view;
      else if (action === 'application-draft') {
        const { applicationId, expectedVersion, ...policy } = body;
        expect(applicationId).toBe(appId);
        expect(expectedVersion).toBe('0');
        view = { ...view, version: '1', state: 'DRAFT', platformVersion: '0', proposerId: '100', policy };
        result = view;
      } else if (action === 'application-publish') {
        expect(body).toEqual({ applicationId: appId, expectedVersion: '1' });
        view = { ...view, version: '2', state: 'PUBLISHED', approverId: '101' };
        result = view;
      } else if (action === 'quota-list') result = { items: [], hasMore: false };
      else if (action === 'quota-save') result = { ...body, version: '1' };
      else {
        failures.push(action);
        return route.abort();
      }
      return route.fulfill({ json: result });
    });
    await page.goto(origin + '/csp/management');
    await expect(page.getByRole('heading', { name: '服务与应用管理' })).toBeVisible();
    await expect(page.getByText('SVS · 模拟服务')).toBeVisible();
    await page.getByRole('button', { name: '编辑服务 svs-demo' }).click();
    await page.getByRole('button', { name: '保存服务', exact: true }).click();
    await page.getByRole('button', { name: '确认保存', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '版本或审批条件已变化' })).toBeVisible();
    expect(calls.filter((c) => c.action === 'service-save')).toHaveLength(1);
    await expect(page.getByRole('button', { name: '保存服务', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '刷新当前页' }).click();
    await page.getByRole('button', { name: '应用授权', exact: true }).click();
    await page.getByRole('button', { name: '管理应用 合同应用' }).click();
    await page.getByRole('button', { name: '添加服务授权' }).click();
    await page.getByLabel('服务标识 1', { exact: true }).fill('svs-demo');
    await page.getByLabel('逻辑对象 1', { exact: true }).fill('contract-key');
    await page.getByRole('button', { name: '保存授权草稿' }).click();
    await page.getByRole('button', { name: '确认提交', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '待独立审核' })).toBeVisible();
    const draft = calls.find((c) => c.action === 'application-draft')!.body;
    expect(draft.services).toEqual([{ serviceId: 'svs-demo', operation: 'SIGN', algorithm: 'MOCK', objectId: 'contract-key' }]);
    expect(draft).not.toHaveProperty('actorId');
    expect(draft).not.toHaveProperty('tenantId');
    await page.getByRole('button', { name: '审核发布', exact: true }).click();
    await page.getByRole('button', { name: '确认提交', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '已发布' })).toBeVisible();
    await page.getByRole('button', { name: '共享配额', exact: true }).click();
    await page.getByRole('button', { name: '保存配额', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '共享配额已保存' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: 'test-results/csp/management-' + width + '.png', fullPage: true });
    expect(failures).toEqual([]);
    expect(calls.some((c) => ['installation', 'setup'].includes(c.action))).toBe(false);
  });

test.describe('CSP-owned applications', () => {
  test('registers OA, saves a grant, renames the application, and removes it after suspension', async ({ page }) => {
    const application = {
      applicationId: 'app_12345678-1234-1234-1234-123456789012',
      name: 'OA 系统',
      appKey: 'csp_' + 'k'.repeat(32),
      version: '1',
      enabled: true
    };
    const appSecret = 's'.repeat(43);
    const grant = { serviceId: 'svs-test', operation: 'SIGN', algorithm: 'SM2', objectId: 'oa-signer' };
    let registered = false;
    let saved = false;
    let version = '1';
    await page.route('**/console-api/**', async (route) => {
      const action = new URL(route.request().url()).pathname.split('/').at(-1);
      const body = route.request().postDataJSON();
      const view = {
        application: { ...application, version },
        quota: saved ? { maxRequests: 100, windowSeconds: 60 } : null,
        activeGrants: saved ? [grant] : []
      };
      switch (action) {
        case 'session':
          return route.fulfill({ json: { csrf: 'test-csrf', authenticated: true, canOperateApplications: true } });
        case 'owned-application-list':
          return route.fulfill({ json: { items: registered ? [view.application] : [], hasMore: false } });
        case 'owned-service-list':
          return route.fulfill({ json: { items: [{ serviceId: grant.serviceId, family: 'SVS', enabled: true }], hasMore: false } });
        case 'owned-application-register':
          expect(body).toEqual({ name: application.name });
          registered = true;
          return route.fulfill({ json: { ...application, appSecret } });
        case 'owned-application-view':
          return route.fulfill({ json: view });
        case 'owned-application-save-policy':
          expect(body).toEqual({
            applicationId: application.applicationId,
            expectedVersion: '1',
            policy: { grants: [grant], maxRequests: 100, windowSeconds: 60 }
          });
          saved = true;
          version = '2';
          return route.fulfill({ json: { ...view, application: { ...application, version }, activeGrants: [grant] } });
        case 'owned-application-rename':
          expect(body).toEqual({ applicationId: application.applicationId, expectedVersion: '2', name: 'OA 生产系统' });
          application.name = body.name;
          version = '3';
          return route.fulfill({ json: { ...view, application: { ...application, version } } });
        case 'owned-application-suspend':
          expect(body).toEqual({ applicationId: application.applicationId, expectedVersion: '3' });
          application.enabled = false;
          version = '4';
          return route.fulfill({ json: { ...view, application: { ...application, version }, activeGrants: [] } });
        case 'owned-application-remove':
          expect(body).toEqual({ applicationId: application.applicationId, expectedVersion: '4' });
          registered = false;
          return route.fulfill({ json: { applicationId: application.applicationId, version: '5' } });
        default:
          return route.abort();
      }
    });
    await page.goto(origin + '/csp/applications');
    await page.getByLabel('应用名称').fill(application.name);
    await page.getByRole('button', { name: '注册并签发凭据' }).click();
    await expect(page.getByLabel('APP Secret', { exact: true })).toHaveValue(appSecret);
    await page.getByRole('button', { name: '已保存', exact: true }).click();
    await expect(page.getByLabel('APP Secret', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '查看授权' }).click();
    await page.getByLabel('服务', { exact: true }).selectOption(grant.serviceId);
    await page.getByLabel('操作', { exact: true }).selectOption(grant.operation);
    await page.getByLabel('算法').fill(grant.algorithm);
    await page.getByLabel('逻辑对象').fill(grant.objectId);
    await page.getByRole('button', { name: '添加授权' }).click();
    await page.getByRole('button', { name: '保存并生效' }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByRole('button', { name: '撤销授权' })).toBeVisible();
    await expect(page.getByLabel('APP Secret', { exact: true })).toHaveCount(0);
    expect(saved).toBe(true);
    await expect(page.getByRole('button', { name: '移除应用' })).toHaveCount(0);
    await page.getByRole('button', { name: '修改名称' }).click();
    await page.getByLabel('新应用名称').fill('OA 生产系统');
    await page.getByRole('button', { name: '保存名称' }).click();
    await expect(page.getByRole('heading', { name: 'OA 生产系统' })).toBeVisible();
    await expect(page.getByRole('button', { name: '撤销授权' })).toBeVisible();
    await page.getByRole('button', { name: '停用应用' }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await page.getByRole('button', { name: '移除应用' }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByText('应用已移除。')).toBeVisible();
    await expect(page.getByText('暂无应用')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'OA 生产系统' })).toHaveCount(0);
  });
});
