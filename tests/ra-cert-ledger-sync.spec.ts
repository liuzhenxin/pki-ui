import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { createMemoryHistory, createRouter } from 'vue-router';
import ts from 'typescript';
import { intranetCertSyncLocation } from '../src/utils/raIntranetCertNavigation';

test('certificate sync uses the registered ledger route and prioritizes the source ID', () => {
  const currentPath = '/ra-cert-management/ra-intranet-cert';
  const oldPath = '/ra-certificate/ra-intranet-cert';
  const router = createRouter({ history: createMemoryHistory(), routes: [] });
  expect(intranetCertSyncLocation(router, '12')).toBeUndefined();
  router.addRoute({ name: 'old', path: oldPath, component: {} });
  expect(intranetCertSyncLocation(router, undefined, 'ABC')).toEqual({ path: oldPath, query: { serialNumber: 'ABC' } });
  router.addRoute({ name: 'current', path: currentPath, component: {} });
  expect(intranetCertSyncLocation(router, '9007199254740993', 'ABC')).toEqual({
    path: currentPath,
    query: { sourceCertId: '9007199254740993' }
  });
});

test('certificate query, issue and ledger components compile', () => {
  for (const name of ['cert/index.vue', 'issue/index.vue', 'intranet-cert/index.vue', 'components/CertOperationPage.vue', 'components/RaCertDetailDialog.vue']) {
    const { descriptor, errors } = parse(readFileSync(new URL(`../src/views/ra/${name}`, import.meta.url), 'utf8'), { filename: name });
    expect(errors).toEqual([]);
    const script = compileScript(descriptor, { id: name });
    expect(compileTemplate({ source: descriptor.template!.content, filename: name, id: name,
      compilerOptions: { bindingMetadata: script.bindings } }).errors).toEqual([]);
  }
});

test('public certificate notification can be cancelled and is submitted at most once per confirmation', async () => {
  const source = readFileSync(new URL('../src/views/ra/public-cert/index.vue', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('async function sendNotice('), source.indexOf('async function setReminder('));
  const code = ts.transpileModule(method, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const sent: number[][] = [];
  let accept: () => void;
  let cancel: () => void;
  const send = new Function('ElMessageBox', 'notifyPublicCerts', `
    const sendingNotice = { value: false }, unwrap = value => value, loadList = () => {};
    const ElMessage = { info: () => {} };
    ${code}
    return sendNotice;
  `)({ confirm: () => new Promise<void>((resolve, reject) => { accept = resolve; cancel = reject; }) },
    async (ids: number[]) => sent.push(ids));
  const row = { id: 7, domainName: 'example.test' };
  const cancelled = send(row);
  cancel!();
  await cancelled;
  expect(sent).toEqual([]);
  const confirmed = send(row);
  await send(row);
  expect(sent).toEqual([]);
  accept!();
  await confirmed;
  expect(sent).toEqual([[7]]);
});

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

for (const operation of [undefined, 'renewal', 'employee-candidate']) {
  test(`certificate details reopen and ignore an earlier request (${operation ?? 'ledger'})`, async ({ page }) => {
    const source = readFileSync(new URL('../src/views/ra/components/RaCertDetailDialog.vue', import.meta.url), 'utf8');
    const state = source.slice(source.indexOf('const detailOpen ='), source.indexOf('function unwrapData<'));
    const methods = source.slice(source.indexOf('async function handleDetail('), source.indexOf('defineExpose('));
    const dialog = source.match(/<el-dialog v-if="detailOpen"[\s\S]*?>/)?.[0];
    expect(dialog).toBeDefined();
    const script = ts.transpileModule(state + methods, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    await page.setContent('<div id="app"></div>');
    for (const path of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
      await page.addScriptTag({ path: fileURLToPath(new URL('../node_modules/' + path, import.meta.url)) });
    }
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const links = `
      <button @click="handleDetail({ id: 'new' })">新证书序列号</button>
      <button @click="handleDetail({ id: 'old' })">查看详情</button>`;
    const template = `
      ${operation === 'employee-candidate'
        ? '<el-dialog :model-value="true" title="员工公钥与历史证书" append-to-body>' + links + '</el-dialog>'
        : links}
      ${dialog}
        <output>{{ detail.subject || '加载中' }}</output>
        <template #footer><button @click="closeDetail">关闭</button></template>
      </el-dialog>`;
    await page.addScriptTag({ content: `
      const { ref } = Vue;
      const pending = window.pending = [];
      const getRaCert = (id) => new Promise(resolve => pending.push({ id, resolve }));
      const getRaOperationCertDetail = (id, operation) => new Promise(resolve => pending.push({ id, operation, resolve }));
      const unwrapData = value => value;
      const operation = ${JSON.stringify(operation ?? null)};
      const props = operation === 'employee-candidate'
        ? { loadDetail: (id) => new Promise(resolve => pending.push({ id, operation, resolve })) }
        : { operation };
      const kmcKeyStatus = ref(null);
      Vue.createApp({
        template: ${JSON.stringify(template)},
        setup() {
          ${script}
          return { detailOpen, detailSession, detail, handleDetail, closeDetail, onDetailVisibilityChange };
        }
      }).use(ElementPlus).mount('#app');
    ` });
    const dialogNode = page.getByRole('dialog', { name: '证书详情' });
    const reply = (index: number, subject: string) => page.evaluate(([request, text]) => {
      (window as any).pending[request].resolve({ subject: text });
    }, [index, subject] as const);
    await page.getByRole('button', { name: '新证书序列号' }).click();
    await expect(dialogNode).toBeVisible();
    await dialogNode.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(dialogNode).toHaveCount(0);
    await page.getByRole('button', { name: '查看详情' }).click();
    await expect(dialogNode).toBeVisible();
    await reply(1, '老平台证书');
    await reply(0, '延迟的新证书响应');
    await expect(dialogNode.locator('output')).toHaveText('老平台证书');
    await dialogNode.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(dialogNode).toHaveCount(0);
    await page.getByRole('button', { name: '查看详情' }).click();
    await reply(2, '再次打开同一张证书');
    await expect(dialogNode.locator('output')).toHaveText('再次打开同一张证书');
    await page.keyboard.press('Escape');
    await expect(dialogNode).toHaveCount(0);
    if (operation === 'employee-candidate') {
      await expect(page.getByRole('dialog', { name: '员工公钥与历史证书' })).toBeVisible();
    }
    await page.getByRole('button', { name: '查看详情' }).click();
    await reply(3, '关闭后再次打开');
    await expect(dialogNode.locator('output')).toHaveText('关闭后再次打开');
    expect(errors).toEqual([]);
    const operations = await page.evaluate(() => (window as any).pending.map((request) => request.operation ?? null));
    expect(operations).toEqual(Array(4).fill(operation ?? null));
  });
}
