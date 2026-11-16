import { expect, test, type Page } from '@playwright/test';
import { KEYUTIL, KJUR } from 'jsrsasign';

const key = KEYUTIL.generateKeypair('EC', 'secp256r1');
const issuer = '/DC=example/DC=company/CN=Example Root CA';
const rootName = 'Example Root CA';
const childName = 'Example Subordinate CA';

function certificate(subject: string, serial: number) {
  return new KJUR.asn1.x509.Certificate({
    version: 3,
    serial: { int: serial },
    sigalg: 'SHA256withECDSA',
    issuer: { str: issuer },
    subject: { str: subject },
    notbefore: '000101000000Z',
    notafter: '20990101000000Z',
    sbjpubkey: key.pubKeyObj,
    cakey: key.prvKeyObj
  }).getPEM();
}

const roots = [
  { id: '1', name: rootName, cert: certificate(issuer, 1), selfSigned: true, imported: true, caStatus: 'inactive', signerId: '10' },
  {
    id: '2',
    name: childName,
    cert: certificate(`/DC=example/O=Development+OU=Internal/CN=${childName}`, 2),
    selfSigned: false,
    imported: true,
    parentRootId: '1',
    caStatus: 'inactive'
  },
  {
    id: '3',
    name: 'Independent CA',
    cert: certificate('/O=Independent Organization/OU=Infrastructure', 3),
    selfSigned: true,
    caStatus: 'active'
  }
];

async function openList(page: Page, permissions: string[]) {
  await page.addInitScript(() => localStorage.setItem('Admin-Token', 'fixture-ca-session'));
  await page.route('**/dev-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/dev-api', '');
    const responses: Record<string, unknown> = {
      '/admin/v1/users/profile': { id: '1', username: 'fixture', permissions, extValues: { tenantId: '4' } },
      '/admin/v1/tenants/4': { name: 'CA', status: -1 },
      '/admin/v1/menus/list-tree-user': [
        {
          path: '/ca',
          name: 'Ca',
          component: 'Layout',
          meta: { title: 'CA' },
          children: [{ path: 'root', name: 'RootCert', component: 'ca/root/index', meta: { title: 'CA 证书管理' } }]
        }
      ],
      '/ca/v1/roots/tree': roots,
      '/ca/v1/roots/1': roots[0]
    };
    if (path === '/ca/v1/roots/page') {
      const name = route.request().postDataJSON()?.name?.trim().toLowerCase() ?? '';
      const records = roots.filter((root) => root.name.toLowerCase().includes(name));
      responses[path] = { records, total: records.length };
    }
    await route.fulfill({ json: { code: 'OK', data: responses[path] ?? [] } });
  });
  await page.goto('/ca/root');
  await expect(page.getByRole('columnheader', { name: '证书名称' })).toBeVisible({ timeout: 20000 });
}

const certificateRow = (page: Page, name: string) =>
  page.locator('.ca-root-table tbody tr').filter({ has: page.locator('.ca-root-name-text').and(page.getByText(name, { exact: true })) });

test('长 DN 保持单行摘要，键盘可查看完整属性，搜索和重置可更新列表', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openList(page, ['*:*:*']);

  const child = certificateRow(page, childName);
  const subject = child.getByRole('cell').nth(2).getByText(childName, { exact: true });
  await expect(subject).toHaveCSS('white-space', 'nowrap');
  await expect.poll(() => child.evaluate((row) => row.getBoundingClientRect().height)).toBeLessThan(90);
  const scroll = page.locator('.ca-root-table .el-scrollbar__wrap');
  await expect.poll(() => scroll.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await subject.focus();
  await expect(page.getByRole('tooltip').filter({ hasText: `DC=example, OU=Internal + O=Development, CN=${childName}` })).toBeVisible();
  await expect(certificateRow(page, 'Independent CA')).toContainText('O=Independent Organization, OU=Infrastructure');
  await expect(child).toContainText('2000-01-01');
  await expect(child).toContainText('2099-01-01');

  const filter = page.getByRole('textbox', { name: '证书名称' });
  await filter.fill(' subordinate ');
  await filter.press('Enter');
  await expect(child).toBeVisible();
  await expect(certificateRow(page, 'Independent CA')).toHaveCount(0);

  await filter.fill('不存在的证书');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.getByText('未找到匹配的证书')).toBeVisible();
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(certificateRow(page, 'Independent CA')).toBeVisible();
});

test('更多菜单按权限和签发状态显示，窄屏在表格内横向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openList(page, ['ca:root:detail', 'ca:root:enable']);
  const parent = certificateRow(page, rootName);
  const table = page.locator('.ca-root-table');
  const scroll = table.locator('.el-scrollbar__wrap');
  await expect.poll(() => scroll.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await expect(table.getByRole('button', { name: '下载', exact: true })).toHaveCount(0);
  await expect(certificateRow(page, 'Independent CA').getByRole('button', { name: '更多' })).toHaveCount(0);
  await parent.getByRole('button', { name: '更多' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([/^启用(?:签发)?$/]);
});

test('下载证书仍提供四种选项并按原名称保存', async ({ page }) => {
  await openList(page, ['ca:root:download']);
  await certificateRow(page, rootName).getByRole('button', { name: '下载' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['根证书（DER）', '根证书（PEM）', '证书链（DER）', '证书链（PEM）']);
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: '根证书（PEM）' }).click();
  expect((await download).suggestedFilename()).toBe(`${rootName}.pem`);
});
