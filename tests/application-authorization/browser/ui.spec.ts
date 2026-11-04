import { test, expect, type Page } from '@playwright/test';
const context = {
  mode: 'ENFORCE',
  policyVersion: '1',
  authzEpoch: '9007199254740993',
  multiRoleEnabled: false,
  customRoleEnabled: false,
  roleChangeEnabled: true,
  actions: ['CREATE_USER', 'UPDATE_PROFILE', 'SET_STATUS', 'ASSIGN_ROLES', 'BIND_CERTIFICATE'],
  createCandidates: [{ roleId: '2001', departmentId: '10' }],
  assignableRoleIds: ['2001']
};
const user = { id: '9007199254740993', username: 'FixtureUser', mobile: '13800000000', mail: 'fixture@example.test', status: 0, roleIds: ['2001'] };
async function fixture(
  page: Page,
  options: { mode?: string; failContext?: boolean; denyWrite?: boolean; empty?: boolean; closed?: boolean; installation?: boolean } = {}
) {
  const writes: { path: string; method: string; data: any }[] = [];
  const reads: string[] = [];
  await page.route('**/__fixture/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/__fixture', '');
    if (request.method() === 'GET') reads.push(path);
    let data: any = {};
    if (path.includes('/application-authorization/ui-context')) {
      if (options.failContext) {
        await route.fulfill({ status: 403, json: {} });
        return;
      }
      data = {
        ...context,
        mode: options.mode ?? 'ENFORCE',
        actions: options.closed ? [] : context.actions,
        createCandidates: options.closed ? [] : context.createCandidates,
        assignableRoleIds: options.closed ? [] : context.assignableRoleIds
      };
    } else if (path.endsWith('/users/page')) data = { records: options.empty ? [] : [user], total: options.empty ? 0 : 1 };
    else if (path.endsWith('/roles/list'))
      data = [
        { id: '2001', name: '允许角色' },
        { id: '2002', name: '范围外角色' }
      ];
    else if (path.endsWith('/roles/page')) throw new Error('Closed custom role capability must not request role page');
    else if (path.endsWith('/installation/status'))
      data = {
        state: options.installation ? 'COMPLETED' : 'INSTALLING',
        rootId: '10',
        profileId: '20',
        requestorId: '30',
        certificateAvailable: false,
        crlAvailable: false,
        completionAvailable: false,
        projectionPending: !!options.installation
      };
    else if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), data: request.postDataJSON() });
      if (options.denyWrite) {
        await route.fulfill({ status: 403, json: {} });
        return;
      }
    }
    await route.fulfill({ json: { data } });
  });
  return { writes, reads };
}
test('context failure never mounts legacy or opens a write', async ({ page }) => {
  const calls = await fixture(page, { failContext: true });
  await page.goto('/?surface=entry');
  await expect(page.getByText('无法确认当前管理权限，操作已关闭')).toBeVisible();
  await expect(page.getByText('LEGACY_ONLY')).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});
test('explicit transition mode mounts legacy only', async ({ page }) => {
  const calls = await fixture(page, { mode: 'SHADOW' });
  await page.goto('/?surface=entry');
  await expect(page.getByText('LEGACY_ONLY')).toBeVisible();
  expect(calls.writes).toEqual([]);
  await expect(page.getByRole('button', { name: '新增用户', exact: true })).toHaveCount(0);
});
test('profile update is one atomic whitelisted request', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/');
  await expect(page.getByText('FixtureUser', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '修改资料', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('手机').fill('13900000000');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(calls.writes).toEqual([{ path: '/admin/v1/users', method: 'PUT', data: { co: { id: user.id, mobile: '13900000000', mail: user.mail } } }]);
});
test('server denial closes dialog and does not send a second write', async ({ page }) => {
  const calls = await fixture(page, { denyWrite: true });
  await page.goto('/');
  await page.getByRole('button', { name: '修改资料', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('手机').fill('13900000000');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('操作未完成，请刷新当前权限后重新操作')).toBeVisible();
  expect(calls.writes).toHaveLength(1);
});
test('create choices contain declared role and department only', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: '新增用户', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('请选择当前可授予角色', { exact: true }).click();
  await expect(page.getByRole('option', { name: '允许角色', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: '范围外角色', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: '允许角色', exact: true }).click();
  await dialog.getByLabel('角色').press('Escape');
  await dialog.getByText('请选择允许部门', { exact: true }).click();
  await expect(page.getByRole('option', { name: '10', exact: true })).toBeVisible();
  expect(calls.writes).toEqual([]);
});
test('closed capabilities show no fallback actions on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, { closed: true });
  await page.goto('/');
  await expect(page.getByText('FixtureUser', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增用户', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '修改角色', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.el-loading-mask')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/authz-p6-ui-mobile.png', fullPage: true });
});
test('empty list remains empty without write controls', async ({ page }) => {
  await fixture(page, { empty: true, closed: true });
  await page.goto('/');
  await expect(page.getByText('No Data')).toBeVisible();
});
test('unrequested custom role capability does not load role data', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/?surface=role');
  await expect(page.getByText('当前应用未启用自定义角色')).toBeVisible();
  await expect(page.getByRole('button', { name: '新增角色草稿' })).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});
test('uncertain installation state exposes no signing or completion', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/?surface=installation');
  await expect(page.getByRole('button', { name: '取得安装证书' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '取得初始 CRL' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '完成安装并关闭安装能力' })).toBeDisabled();
  expect(calls.writes).toEqual([]);
});
test('completed installation shows pending projection and no signing inputs', async ({ page }) => {
  const calls = await fixture(page, { installation: true });
  await page.goto('/?surface=installation');
  await expect(page.getByText('安装已完成', { exact: true })).toBeVisible();
  await expect(page.getByText('平台状态正在同步，请稍后刷新。')).toBeVisible();
  await expect(page.getByRole('button', { name: '取得安装证书' })).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});

test('installation exposes current authorized business account creation without legacy initialization writes', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/?surface=installation');
  await expect(page.getByText('日常业务账号', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新增用户', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('用户名').fill('NewBusinessUser');
  await dialog.getByLabel('密码').fill('FixturePassword123');
  await dialog.getByText('请选择当前可授予角色', { exact: true }).click();
  await page.getByRole('option', { name: '允许角色', exact: true }).click();
  await dialog.getByLabel('角色').press('Escape');
  await dialog.getByText('请选择允许部门', { exact: true }).click();
  await page.getByRole('option', { name: '10', exact: true }).click();
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(calls.writes).toEqual([
    {
      path: '/admin/v1/users',
      method: 'POST',
      data: { co: { username: 'NewBusinessUser', password: 'FixturePassword123', mobile: '', mail: '', deptId: '10', roleIds: ['2001'] } }
    }
  ]);
});

test('certificate selection is cleared when binding dialog is reopened', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: '绑定证书', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'fixture-public.pem', mimeType: 'application/x-pem-file', buffer: Buffer.from('fixture public certificate') });
  await expect(dialog.getByRole('button', { name: '确认', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '绑定证书', exact: true }).click();
  await expect(dialog.locator('input[type="file"]')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: '确认', exact: true })).toBeDisabled();
  expect(calls.writes).toEqual([]);
});

test('KMC auditor entry uses governed user management in ENFORCE', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/?surface=kmc-audit');
  await expect(page.getByText('FixtureUser', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增用户', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增审计员', exact: true })).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});
test('KMC auditor entry closes when authorization context fails', async ({ page }) => {
  const calls = await fixture(page, { failContext: true });
  await page.goto('/?surface=kmc-audit');
  await expect(page.getByText('无法确认当前管理权限，操作已关闭')).toBeVisible();
  await expect(page.getByRole('button', { name: '新增审计员', exact: true })).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});

test('CA auditor entry uses governed user management in ENFORCE', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/?surface=ca-audit');
  await expect(page.getByText('FixtureUser', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增用户', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增审计员', exact: true })).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});
test('CA auditor entry closes when authorization context fails', async ({ page }) => {
  const calls = await fixture(page, { failContext: true });
  await page.goto('/?surface=ca-audit');
  await expect(page.getByText('无法确认当前管理权限，操作已关闭')).toBeVisible();
  await expect(page.getByRole('button', { name: '新增审计员', exact: true })).toHaveCount(0);
  expect(calls.writes).toEqual([]);
});
