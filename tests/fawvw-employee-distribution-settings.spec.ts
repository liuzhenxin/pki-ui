import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
import ts from 'typescript';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

test('distribution settings keep local drafts separate from OPS and let AD be set independently', async ({ page }) => {
  const root = new URL('../', import.meta.url);
  const filename = 'src/views/ra/employee-cert/EmployeeDistributionSettingsDialog.vue';
  const component = (filename: string, id: string) => {
    const { descriptor } = parse(readFileSync(new URL(filename, root), 'utf8'), { filename });
    const script = compileScript(descriptor, { id, inlineTemplate: true });
    const js = ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const style = compileStyle({ source: descriptor.styles[0].content, filename, id, scoped: true }).code;
    return {
      source: `(() => { const module = { exports: {} }, exports = module.exports; ${js}
      exports.default.__scopeId = 'data-v-${id}'; return exports.default; })()`,
      style
    };
  };
  const settings = component(filename, 'distribution-settings');
  const inventory = component('src/views/ra/employee/EmployeeCertificateInventory.vue', 'employee-inventory');

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.setContent('<div id="app"></div>');
  await page.addStyleTag({ path: fileURLToPath(new URL('node_modules/element-plus/dist/index.css', root)) });
  await page.addStyleTag({ content: settings.style + inventory.style });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(`node_modules/${asset}`, root)) });
  }
  await page.addScriptTag({
    content: `
    const stored = {
      useOps: false,
      adUploadEnabled: true,
      distribution: {
        emailServerUrl: 'https://local.example.test/mail', dingtalkServerUrl: 'https://local.example.test/ding',
        emailAccount: 'local@example.test', dingtalkApp: 'local-app', smtpServer: 'CC', appKey: 'local-ak',
        attachmentMaxSizeMb: 10, secretKeyConfigured: true
      },
      administrators: { emails: ['local-admin@example.test'], domainAccounts: ['local-admin'] }
    };
    const api = {
      getEmployeeCertDistributionSettings: async () => ({ data: structuredClone(stored) }),
      getEmployeeAdConfig: async () => ({ data: {
        protocol: 'ldaps', host: 'directory.example.test', port: 636, baseDn: 'DC=example,DC=test',
        account: 'publisher@example.test', fields: ['userCertificate', 'userSMIMECertificate'],
        mode: 'REPLACE', passwordConfigured: true
      } }),
      testEmployeeAdConfig: async (config, email, file) => {
        window.adTest = { protocol: config.protocol, fields: [...config.fields], mode: config.mode, email, file: file.name };
        return { data: true };
      },
      getEmployeeCertOpsSettings: async () => ({
        data: {
          distribution: {
            emailServerUrl: 'https://ops.example.test/mail', dingtalkServerUrl: 'https://ops.example.test/ding',
            emailAccount: 'ops@example.test', dingtalkApp: 'ops-app', smtpServer: 'CD', appKey: 'ops-ak', secretKeyConfigured: true
          },
          administrators: { emails: ['ops1@example.test', 'ops2@example.test'], domainAccounts: ['ops1', 'ops2'] }
        }
      }),
      saveEmployeeCertDistributionSettings: async (value) => {
        const payload = JSON.parse(JSON.stringify(value));
        window.lastDistributionSave = payload;
        stored.useOps = payload.useOps;
        stored.adUploadEnabled = payload.adUploadEnabled;
        const { secretKey, ...distribution } = payload.distribution;
        Object.assign(stored.distribution, distribution);
        if (payload.administrators) stored.administrators = payload.administrators;
      },
      testEmployeeCertDistributionConfig: async (value) => {
        window.distributionTests.push(JSON.parse(JSON.stringify(value)));
        return { data: value.send ? '测试消息已发送' : 'HTTP 200' };
      }
    };
    window.distributionTests = [];
    const require = name => name === 'vue' ? Vue : name === 'element-plus' ? ElementPlus : api;
    const Settings = ${settings.source};
    const Inventory = ${inventory.source};
    const app = Vue.createApp({
      setup() {
        const dialog = Vue.ref();
        const adUpload = Vue.ref(true);
        return () => Vue.h('main', [
          Vue.h('button', { onClick: () => dialog.value.open() }, '分发设置'),
          Vue.h(Settings, { ref: dialog, onAdUploadChange: enabled => { adUpload.value = enabled; } }),
          Vue.h(Inventory, {
            adUploadEnabled: adUpload.value, page: 1, pageSize: 10, total: 1,
            rows: [{ id: '1', serialNumber: 'SERIAL-1', adUploadEligible: true, status: 'VALID' }]
          })
        ]);
      }
    });
    app.use(ElementPlus).mount('#app');
  `
  });

  const open = page.getByRole('button', { name: '分发设置' });
  const dialog = page.getByRole('dialog', { name: '员工证书分发配置' });
  const adRowAction = page.getByRole('button', { name: '上传 AD' });
  await expect(adRowAction).toBeVisible();
  await open.click();
  const useOps = dialog.locator('.el-switch').filter({ has: page.getByRole('switch', { name: '使用OPS统一配置' }) });
  const sender = dialog.getByLabel('发件邮箱');
  const secret = dialog.locator('input[type="password"]');
  const distribution = dialog.getByRole('tab', { name: '证书分发' });
  const administrators = dialog.getByRole('tab', { name: '管理员通知' });
  const upload = dialog.getByRole('tab', { name: '证书上传' });

  await expect(sender).toHaveValue('local@example.test');
  await sender.fill('changed@example.test');
  await dialog.getByLabel('邮件服务器标识').fill('QD');
  await dialog.getByLabel('钉钉应用标识').fill('changed-app');
  await administrators.click();
  await dialog.getByRole('combobox', { name: '管理员邮箱' }).fill('another@example.test');
  await dialog.getByRole('combobox', { name: '管理员邮箱' }).press('Enter');
  await dialog.getByRole('combobox', { name: '管理员域账号' }).fill('another-admin');
  await dialog.getByRole('combobox', { name: '管理员域账号' }).press('Enter');
  await useOps.click();
  await expect(dialog.getByText('ops2@example.test', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ops2', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox').first()).toBeDisabled();
  await distribution.click();
  await expect(sender).toHaveValue('ops@example.test');
  await expect(sender).toHaveAttribute('readonly', '');
  await expect(dialog.getByLabel('App Key')).toHaveValue('ops-ak');
  await expect(secret).toHaveValue('');
  await expect(secret).toHaveAttribute('readonly', '');

  await dialog.getByLabel('附件最大大小').fill('15');
  await dialog.getByPlaceholder('测试收件邮箱').fill('recipient@example.test');
  await dialog.getByRole('button', { name: '测试并发送' }).first().click();
  await page.getByRole('button', { name: '确认发送' }).click();
  await expect(dialog.getByText('邮件：测试消息已发送')).toBeVisible();
  expect(await page.evaluate(() => (window as any).distributionTests)).toEqual([
    { channel: 'EMAIL', send: false, useOps: true },
    { channel: 'EMAIL', send: true, useOps: true, recipient: 'recipient@example.test' }
  ]);

  await useOps.click();
  await expect(sender).toHaveValue('changed@example.test');
  await expect(sender).toBeEditable();
  await expect(dialog.getByLabel('邮件服务器标识')).toHaveValue('QD');
  await expect(dialog.getByLabel('钉钉应用标识')).toHaveValue('changed-app');
  await administrators.click();
  await expect(dialog.getByText('another@example.test', { exact: true })).toBeVisible();
  await expect(dialog.getByText('another-admin', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '保存配置' }).click();
  await expect(dialog).toBeHidden();

  await open.click();
  await useOps.click();
  await upload.click();
  await expect(dialog.getByText('LDAPS（推荐）')).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'S/MIME 证书' })).toBeChecked();
  await dialog.getByPlaceholder('测试用户邮箱').fill('test@example.test');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'test.cer', mimeType: 'application/pkix-cert', buffer: Buffer.from([1]) });
  await dialog.getByRole('button', { name: '写入并回读' }).click();
  await page.getByRole('button', { name: '确认写入', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).adTest)).toMatchObject({
    protocol: 'ldaps', fields: ['userCertificate', 'userSMIMECertificate'], mode: 'REPLACE', email: 'test@example.test', file: 'test.cer'
  });
  await dialog
    .locator('.el-switch')
    .filter({ has: page.getByRole('switch', { name: 'AD上传功能' }) })
    .click();
  await dialog.getByRole('button', { name: '保存配置' }).click();
  await expect(dialog).toBeHidden();
  await expect(adRowAction).toHaveCount(0);
  const viewAction = page.getByRole('button', { name: '证书详情' });
  await expect(viewAction).toBeVisible();
  const buttonBox = (await viewAction.boundingBox())!;
  const cellBox = (await page.getByRole('cell').filter({ has: viewAction }).boundingBox())!;
  expect(buttonBox.x + buttonBox.width / 2).toBeCloseTo(cellBox.x + cellBox.width / 2, 0);
  expect(await page.evaluate(() => (window as any).lastDistributionSave)).toEqual({
    useOps: true,
    adUploadEnabled: false,
    distribution: { attachmentMaxSizeMb: 15 }
  });

  await open.click();
  await expect(sender).toHaveValue('ops@example.test');
  await useOps.click();
  await expect(sender).toHaveValue('changed@example.test');
  await administrators.click();
  await expect(dialog.getByText('another-admin', { exact: true })).toBeVisible();
});
