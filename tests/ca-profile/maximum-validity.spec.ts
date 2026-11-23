import { expect, test, type Page } from '@playwright/test';

async function openTemplate(page: Page, initialValidity: string) {
  let profile = {
    id: '10',
    name: '电子邮件证书模板',
    type: 'EndEntity',
    description: 'Maximum validity regression fixture',
    conf: JSON.stringify({
      certLevel: 'EndEntity',
      validity: initialValidity,
      keyAlgorithms: ['RSA-2048'],
      signatureAlgorithms: ['SHA256withRSA'],
      subject: [
        { type: { oid: '2.5.4.3', description: 'CN' }, minOccurs: 1 },
        { type: { oid: '1.2.840.113549.1.9.1', description: 'emailAddress' }, minOccurs: 1 }
      ],
      extensions: [
        { type: { oid: '2.5.29.15', description: 'KeyUsage' }, keyUsage: { usages: [{ value: 'digitalSignature', required: true }] } },
        { type: { oid: '2.5.29.37', description: 'ExtendedKeyUsage' }, extendedKeyUsage: { usages: [{ value: 'emailProtection', required: true }] } }
      ]
    })
  };
  const saved: string[] = [];
  await page.addInitScript(() => localStorage.setItem('Admin-Token', 'fixture-ca-profile-session'));
  await page.route('**/dev-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/dev-api', '');
    if (path === '/ca/v1/profiles' && route.request().method() === 'PUT') {
      profile = { ...profile, ...route.request().postDataJSON().co };
      saved.push(JSON.parse(profile.conf).validity);
      await route.fulfill({ json: { code: 'OK', data: null } });
      return;
    }
    const responses: Record<string, unknown> = {
      '/admin/v1/users/profile': { id: '1', username: 'fixture', permissions: ['*:*:*'], extValues: { tenantId: '4' } },
      '/admin/v1/tenants/4': { name: 'CA', status: -1 },
      '/admin/v1/menus/list-tree-user': [
        {
          path: '/ca',
          name: 'Ca',
          component: 'Layout',
          meta: { title: 'CA' },
          children: [
            { path: 'profile', name: 'CaProfile', component: 'ca/profile/index', meta: { title: '模板管理' } },
            { path: 'profile/form', name: 'CaProfileForm', component: 'ca/profile/form', hidden: true, meta: { title: '修改证书模板' } }
          ]
        }
      ],
      '/ca/v1/profiles/10': profile,
      '/ca/v1/profiles/list': [],
      '/ca/v1/profiles/page': { records: [profile], total: 1 }
    };
    await route.fulfill({ json: { code: 'OK', data: responses[path] ?? [] } });
  });
  await page.goto('/ca/profile/form?id=10');
  await expect(page.locator('.validity-input-group input[role="spinbutton"]')).toHaveValue(initialValidity.replace(/[a-z]$/i, ''));
  return saved;
}

test('a longer email maximum saves, reopens and matches the constraints view', async ({ page }, testInfo) => {
  const saved = await openTemplate(page, '10y');
  await page.locator('.validity-input-group input[role="spinbutton"]').fill('20');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => saved).toEqual(['20y']);
  await page.goto('/ca/profile/form?id=10');
  await expect(page.locator('.validity-input-group input[role="spinbutton"]')).toHaveValue('20');
  await page.getByRole('tab', { name: '约束视图' }).click();
  await expect(page.locator('.constraints-container')).toContainText('20 年');
  await page.screenshot({ path: testInfo.outputPath('maximum-validity.png'), fullPage: true });
});

test('legacy m is minutes and an empty input cannot be saved', async ({ page }) => {
  const saved = await openTemplate(page, '12m');
  await expect(page.locator('.validity-input-group .el-select')).toContainText('分钟');
  await page.locator('.validity-input-group input[role="spinbutton"]').fill('');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.el-form-item__error')).toContainText('最大有效期');
  expect(saved).toEqual([]);
  await expect(page.locator('.validity-input-group .el-select')).toContainText('分钟');
});
