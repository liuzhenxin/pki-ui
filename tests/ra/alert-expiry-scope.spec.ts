import { expect, test, type Locator, type Page } from '@playwright/test';

const rulePath = '/ra/v1/alert-rules';
const rootId = '9007199254740993';
const profileId = '9007199254740995';

async function openRules(page: Page, failFirstOptionsRequest = false) {
  let rule = {
    id: '1',
    ruleName: '旧到期规则',
    alertType: 'cert_expire',
    alertLevel: 'warning',
    notificationType: 'inapp',
    ruleStatus: 1,
    coolDownMinutes: 30,
    triggerCondition: { thresholdDays: 30 }
  };
  const saved: Record<string, unknown>[] = [];
  const paths: string[] = [];
  await page.addInitScript(() => localStorage.setItem('Admin-Token', 'fixture-ra-alert-session'));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4398') return route.abort();
    if (!url.pathname.startsWith('/dev-api/')) return route.continue();
    const path = url.pathname.replace('/dev-api', '');
    paths.push(path);
    if (path === rulePath && route.request().method() === 'PUT') {
      rule = route.request().postDataJSON();
      saved.push(rule.triggerCondition);
      return route.fulfill({ json: { code: 'OK' } });
    }
    if (path === `${rulePath}/expiry-options` && failFirstOptionsRequest) {
      failFirstOptionsRequest = false;
      return route.fulfill({ status: 503, json: { code: 'Error' } });
    }
    const responses: Record<string, unknown> = {
      '/admin/v1/users/profile': { id: '501', username: 'fixture', permissions: ['ra:alert:rule'], extValues: { tenantId: '5' } },
      '/admin/v1/tenants/5': { name: 'RA', status: -1 },
      '/admin/v1/menus/list-tree-user': [
        {
          path: '/ra',
          name: 'Ra',
          component: 'Layout',
          meta: { title: 'RA' },
          children: [{ path: 'alert/rule', name: 'RaAlertRule', component: 'ra/alert/rule/index', meta: { title: '告警规则' } }]
        }
      ],
      [`${rulePath}/page`]: { records: [rule], total: 1 },
      [`${rulePath}/1`]: rule,
      [`${rulePath}/expiry-options`]: {
        roots: [{ id: rootId, name: '测试 CA 根' }],
        profiles: [{ id: profileId, name: '测试证书模板' }]
      }
    };
    return route.fulfill({ json: { code: 'OK', data: responses[path] ?? [] } });
  });
  await page.goto('/ra/alert/rule');
  await expect(page.getByText('旧到期规则', { exact: true })).toBeVisible();
  return { saved, paths };
}

function expirySelect(dialog: Locator, page: Page, label: string) {
  return dialog
    .locator('.el-form-item')
    .filter({ has: page.getByRole('combobox', { name: label, exact: true }) })
    .locator('.el-select');
}

test('RA saves both filters as exact IDs, reloads them and clears a single filter', async ({ page }) => {
  const { saved, paths } = await openRules(page);
  const edit = page.locator('tr').filter({ hasText: '旧到期规则' }).getByRole('button').nth(0);
  await edit.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('范围内的 30、7、1 天节点各提醒一次')).toBeVisible();
  const root = expirySelect(dialog, page, 'CA 根');
  const profile = expirySelect(dialog, page, '证书模板');
  await root.getByRole('combobox').click();
  await page.getByRole('option', { name: '测试 CA 根' }).click();
  await profile.getByRole('combobox').click();
  await page.getByRole('option', { name: '测试证书模板' }).click();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => saved).toEqual([{ thresholdDays: 30, days: 30, rootScope: 'selected', rootId, profileScope: 'selected', profileId }]);
  await expect(dialog).toBeHidden();

  await edit.click();
  await expect(root).toContainText('测试 CA 根');
  await expect(profile).toContainText('测试证书模板');
  await root.hover();
  await root.locator('.el-select__clear').click();
  await expect(root).toContainText('全部 CA 根');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => saved[1]).toEqual({ thresholdDays: 30, days: 30, rootScope: 'all', profileScope: 'selected', profileId });
  expect(paths.filter((path) => path.startsWith('/ops/'))).toEqual([]);
});

test('RA reports a failed options read and allows retry without clearing the draft', async ({ page }) => {
  await openRules(page, true);
  await page.getByRole('button', { name: '新增规则' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('请输入规则名称').fill('模拟证书提醒');
  const root = dialog.getByRole('combobox', { name: 'CA 根' });
  await expect(dialog.getByText('证书筛选选项加载失败。')).toBeVisible();
  await expect(root).toBeDisabled();
  await dialog.getByRole('button', { name: '重试' }).click();
  await expect(root).toBeEnabled();
  await expect(dialog.getByPlaceholder('请输入规则名称')).toHaveValue('模拟证书提醒');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await dialog.locator('.el-dialog').boundingBox())?.width).toBeLessThan(390);
  await dialog.getByRole('combobox', { name: '证书模板' }).click();
  await expect(page.getByRole('option', { name: '测试证书模板' })).toBeInViewport();
});
