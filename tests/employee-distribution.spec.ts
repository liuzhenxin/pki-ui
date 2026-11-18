import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, compileScript, compileStyle, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

test('employee certificate filters and search buttons align at desktop and narrow widths', async ({ page }) => {
  const filename = 'employee-cert/index.vue';
  const source = readFileSync(new URL('../src/views/ra/employee-cert/index.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source, { filename });
  const searchCard = descriptor.template!.content.split('</el-card>')[0] + '</el-card></div>';
  const style = compileStyle({ filename, id: 'employee-cert-search', source: descriptor.styles[0].content, scoped: true });
  expect(style.errors).toEqual([]);

  const modules = new URL('../node_modules/', import.meta.url);
  await page.setContent('<div id="app"></div>');
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  await page.addStyleTag({ content: 'body{margin:0}#app{padding:12px}@media(min-width:769px){#app{margin-left:220px}}' + style.code });
  for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
  }
  await page.addScriptTag({
    content: `
    Vue.createApp({
      __scopeId: 'data-v-employee-cert-search',
      template: ${JSON.stringify(searchCard)},
      data: () => ({ showSearch: true, queryParams: {} }),
      methods: { handleQuery() {}, resetQuery() {} }
    }).use(ElementPlus).mount('#app');
  `
  });

  const form = page.locator('.query-form');
  const search = form.getByRole('button', { name: '搜索', exact: true });
  const reset = form.getByRole('button', { name: '重置', exact: true });
  for (const width of [1600, 1280, 980, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const searchBox = (await search.boundingBox())!;
    const resetBox = (await reset.boundingBox())!;
    const formBox = (await form.boundingBox())!;
    expect(searchBox.y).toBeCloseTo(resetBox.y, 0);
    expect(searchBox.x + searchBox.width).toBeLessThan(resetBox.x);
    expect(resetBox.x + resetBox.width).toBeCloseTo(formBox.x + formBox.width, 0);
    expect(
      await form.locator('.el-form-item').evaluateAll((items) =>
        items.every((item) => {
          const label = item.querySelector('.el-form-item__label')!.getBoundingClientRect();
          const control = item.querySelector('.el-form-item__content')!.getBoundingClientRect();
          return label.width === 76 && Math.abs(label.top - control.top) < 1 && control.width > 0;
        })
      )
    ).toBe(true);
  }
});

function harness() {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/index.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'index.vue', id: 'distribution' }).errors).toEqual([]);
  const compiled = compileScript(descriptor, { id: 'distribution' });
  const code = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const messages: Array<{ type: string; text: string }> = [];
  let status = 'SENDING';
  let timer: (() => Promise<void>) | undefined;
  let unmount: (() => void) | undefined;
  const queries: any[] = [];
  const api = new Proxy({
    distributeEmployeeCert: async () => ({ data: { distributionStatus: 'SENDING' } }),
    pageEmployeeCerts: async (query: any) => {
      queries.push(query);
      return { data: { total: query.taskNo ? 12 : query.distributionStatus === 'SENDING' && status !== 'SENDING' ? 0 : 1,
        records: [{ id: query.pageNum, issueStatus: 'ISSUED', distributionStatus: status }] } };
    }
  }, { get: (target, name) => target[name as keyof typeof target] || (async () => ({ data: {} })) });
  const module = { exports: {} as any };
  const message = Object.fromEntries(['success', 'warning', 'error', 'info'].map((type) => [type, (text: string) => messages.push({ type, text })]));
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'setTimeout', 'clearTimeout', code)(
    (name: string) => {
      if (name === 'vue') return { ...vue, onMounted: () => {}, onUnmounted: (callback: () => void) => (unmount = callback) };
      if (name === '@/hooks/useRaListRefreshOnReturn') return { useRaListRefreshOnReturn: () => {} };
      if (name === 'file-saver') return { default: { saveAs: () => {} } };
      if (name === '@/api/ra/employeeCert') return api;
      if (name === '@/utils/raCertificateDownload') return { certificateDownloadBlob: async (blob: Blob) => blob };
      if (name === '@/plugins/auth') return { default: { hasPermi: () => true } };
      if (name.endsWith('.vue')) return { default: {} };
      throw new Error(name);
    }, module, module.exports, message, { confirm: async () => {} },
    (callback: () => Promise<void>) => { timer = callback; return 1; }, () => (timer = undefined)
  );
  return { page: module.exports.default.setup({}, { expose: () => {} }), messages, queries,
    finish: () => (status = 'SENT'), poll: () => timer!(), stop: () => unmount!(), pending: () => timer };
}

test('task search opens distribution for all pages of the applied task only', async () => {
  const { page, queries, stop } = harness();
  const selections: any[] = [];
  page.distributionDialog.value = { open: (selection: any) => selections.push(selection) };
  page.queryParams.taskNo = ' EC-001 ';
  await page.handleQuery();
  expect(queries.at(-1)).toMatchObject({ taskNo: 'EC-001', pageNum: 1 });
  expect(page.total.value).toBe(12);
  page.queryParams.pageNum = 2;
  page.queryParams.taskNo = 'EC-002';
  await page.loadList();
  expect(queries.at(-1)).toMatchObject({ taskNo: 'EC-001', pageNum: 2 });
  page.distributeTask();
  expect(selections).toEqual([{ taskNo: 'EC-001' }]);
  page.queryParams.employeeName = 'Test';
  await page.handleQuery();
  expect(page.taskForDistribution.value).toBe('');
  page.distributeTask();
  expect(selections).toHaveLength(1);
  await page.resetQuery();
  expect(queries.at(-1)).toMatchObject({ taskNo: '', pageNum: 1 });
  stop();
});

test('distribution submission is tracked without claiming completed delivery', async () => {
  const h = harness();
  const selections: any[] = [];
  h.page.distributionDialog.value = { open: (selection: any) => selections.push(selection) };
  h.page.distribute({ id: 1, employeeName: 'Employee', distributionStatus: 'PENDING' });
  expect(selections).toEqual([{ ids: [1], resend: false }]);
  expect(h.pending()).toBeUndefined();
  await h.page.onDistributionSubmitted({ ids: [1] }, 'MIXED');
  expect(h.messages.some((message) => message.type === 'success')).toBe(false);
  expect(h.pending()).toBeDefined();
  h.finish();
  await h.poll();
  expect(h.page.rows.value[0].distributionStatus).toBe('SENT');
  h.stop();
});

test('certificate pages compile and remove arbitrary package uploads and password exports', () => {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/index.vue', import.meta.url), 'utf8');
  expect(source).not.toContain('uploadEmployeeCertDistributionPackage');
  expect(source).not.toContain('row.certPassword,');
  expect(source).toContain('distributionConfig.smtpServer');
  expect(source).not.toContain('v-model="distributionConfig.guideHtml"');
  const taskSource = readFileSync(new URL('../src/views/ra/employee-cert/issue.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(taskSource);
  expect(errors).toEqual([]);
  compileScript(descriptor, { id: 'distribution-task' });
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'issue.vue', id: 'distribution-task' }).errors).toEqual([]);
  const taskActions = taskSource.match(/<el-table-column label="操作"[^>]*>([\s\S]*?)<\/el-table-column>/)?.[1];
  expect(taskActions).toContain('<CertRowAction label="详情" icon="View" @click="openTask(row)" />');
  expect(taskActions).toContain('label="下载证书 ZIP"');
  expect(taskActions).toContain(`v-hasPermi="['ra:employee-cert:distribute']"`);
  expect(taskActions).toContain(':disabled="row.successCount <= 0 || Boolean(downloadingTask)"');
  expect(taskActions).toContain('@click="downloadTaskPackage(row)"');
  expect(taskSource).toContain('@click="issueSelectedCerts">签发</el-button>');
  expect(taskSource).toContain('distributionDialog.value?.open({ taskNo: row.taskNo }');
  expect(taskSource).toContain('prop="issueMessage"');
  expect(taskSource).toContain('prop="distributionMessage"');
});

function issueHarness(api: Record<string, unknown>) {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/issue.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: 'issue-selected' });
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'onMounted', 'watch', 'ref', 'reactive', 'computed', code)(
    (name: string) => {
      if (name === 'vue') return { ...vue, onUnmounted: () => {} };
      if (name === '@/hooks/useRaListRefreshOnReturn') return { useRaListRefreshOnReturn: () => {} };
      if (name === 'vue-router') return { useRoute: () => ({ query: {}, fullPath: '/' }) };
      if (name === '@/api/ra/employeeCert') return {
        pageEmployeeCertTasks: async () => ({ data: { records: [], total: 0 } }),
        ...api
      };
      return { default: {} };
    }, module, module.exports, { info: () => {}, success: () => {} }, { confirm: async () => true },
    () => {}, vue.watch, vue.ref, vue.reactive, vue.computed
  );
  return module.exports.default.setup({}, { expose: () => {} });
}

test('employee issuance sends only selected eligible IDs and displays the returned history', async () => {
  const issued = { id: '9007199254740993', issueStatus: 'ISSUED', serialNumber: '1234' };
  const failed = { id: '9007199254740994', issueStatus: 'FAILED' };
  const other = { id: '9007199254740995', issueStatus: 'FAILED' };
  const detail = { task: { taskNo: 'TEST' }, certs: [issued, failed, other] };
  const history = [{ startedAt: '2026-11-13T10:00:00', finishedAt: '2026-11-13T10:00:01', status: 'FAILED', message: 'CA CMP 500' }];
  const calls: unknown[] = [];
  const page = issueHarness({
    getEmployeeCertTask: async () => ({ data: detail }),
    issueEmployeeCertTask: async (taskNo: string, ids: string[]) => {
      calls.push({ taskNo, ids });
      return { data: { ...detail, certs: [issued, { ...failed, issueHistory: history }, other] } };
    }
  });
  await page.openTask(detail.task);
  expect(calls).toEqual([]);
  expect(page.canIssueCert(issued)).toBe(false);
  page.issueSelection.value = [issued, failed];
  await page.issueSelectedCerts();
  expect(calls).toEqual([{ taskNo: 'TEST', ids: [failed.id] }]);
  expect(page.taskDetail.value.certs[1].issueHistory).toEqual(history);
  expect(page.taskDetail.value.certs[2].issueHistory).toBeUndefined();
});

test('employee task requires explicit CA and template selection and resets it when CA changes', async () => {
  const rootA = '9007199254740993';
  const rootB = '9007199254740995';
  const profileId = '9007199254740997';
  const rsa = { rootId: rootA, rootName: 'CA A', profileId, profileName: 'Mail', enabled: true, maxValidityYears: 2 };
  const alternate = { ...rsa, rootId: rootB, rootName: 'CA B' };
  let profiles = [rsa];
  const submissions: unknown[] = [];
  const page = issueHarness({
    listEmployeeEmailCertProfiles: async () => ({ data: profiles }),
    createEmployeeCertTask: async (data: unknown) => {
      submissions.push(data);
      return { data: { task: { taskNo: 'TEST', rootId: rootB }, certs: [] } };
    }
  });
  await page.loadEmailProfiles();
  page.selectedEmployees.value = [{ id: '1', identityKey: 'verified', raUserId: '42' }];
  expect(page.form.rootId).toBe('');
  expect(page.form.profileId).toBe('');
  expect(page.canCreateTask.value).toBe(false);

  profiles = [rsa, alternate, { ...alternate, profileId: '99', enabled: false },
    { ...alternate, profileId: '100', algorithmRestriction: 'SM2' }];
  await page.loadEmailProfiles();
  expect(page.eligibleCas.value.map((item: { id: string }) => item.id)).toEqual([rootA, rootB]);
  page.form.rootId = rootA;
  page.form.profileId = profileId;
  page.form.validityYears = 2;
  expect(page.canCreateTask.value).toBe(true);
  page.form.rootId = rootB;
  expect(page.form.profileId).toBe('');
  expect(page.form.validityYears).toBeUndefined();
  expect(page.profilesForCa.value).toEqual([alternate]);
  await page.createTask();
  expect(submissions).toEqual([]);
  page.form.profileId = profileId;
  page.form.validityYears = 3;
  expect(page.canCreateTask.value).toBe(false);
  await page.createTask();
  expect(submissions).toEqual([]);
  page.form.validityYears = 2;
  await page.createTask();
  expect(submissions).toEqual([{ employeeIds: ['1'], identityKeys: ['verified'], userIds: ['42'], rootId: rootB, profileId, validityYears: 2, remark: '' }]);
  expect(page.taskCaName(page.taskDetail.value.task.rootId)).toBe('CA B');

  profiles = [rsa, { ...alternate, enabled: false }];
  await page.loadEmailProfiles();
  expect(page.form.rootId).toBe('');
  expect(page.form.profileId).toBe('');
  expect(page.canCreateTask.value).toBe(false);
  expect(page.taskCaName(rootB)).toBe('CA B');
});

test('distribution sends only after the final confirmation and ignores double clicks', async () => {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/DistributionDialog.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: 'distribution-confirm' });
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'DistributionDialog.vue', id: 'distribution-confirm' }).errors).toEqual([]);
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let resolveConfirm: () => void;
  let rejectConfirm: () => void;
  const sent: any[] = [];
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name === 'vue') return vue;
    if (name === 'element-plus') return {
      ElMessage: { info: () => {} },
      ElMessageBox: { confirm: () => new Promise<void>((resolve, reject) => { resolveConfirm = resolve; rejectConfirm = reject; }) }
    };
    if (name === '@/api/ra/employeeCert') return {
      getEmployeeDistributionOptions: async () => ({ data: { messageType: 'MIXED', maxAttachmentBytes: 1024 } }),
      submitEmployeeDistribution: async (...args: any[]) => sent.push(args)
    };
    throw new Error(name);
  }, module, module.exports);
  const dialog = module.exports.default.setup({}, { expose: () => {}, emit: () => {} });
  const selection = { ids: [1, 2] };
  await dialog.open(selection, '2 employees');
  const cancelled = dialog.submit();
  expect(sent).toHaveLength(0);
  rejectConfirm!();
  await cancelled;
  expect(sent).toHaveLength(0);
  const confirmed = dialog.submit();
  await dialog.submit();
  expect(sent).toHaveLength(0);
  resolveConfirm!();
  await confirmed;
  expect(sent).toEqual([[selection, 'MIXED', []]]);
});

test('attachment switches send only enabled files from the distribution dialog', async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_CHANNEL, 'Requires a local browser channel');
  const filename = 'DistributionDialog.vue';
  const { descriptor } = parse(readFileSync(new URL(`../src/views/ra/employee-cert/${filename}`, import.meta.url), 'utf8'));
  const script = compileScript(descriptor, { id: 'attachment-switch' });
  const template = compileTemplate({ source: descriptor.template!.content, filename, id: 'attachment-switch',
    compilerOptions: { bindingMetadata: script.bindings } });
  expect(template.errors).toEqual([]);
  const code = ts.transpileModule(script.content + '\n' + template.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const asset = (path: string) => fileURLToPath(new URL(`../node_modules/${path}`, import.meta.url));
  await page.setContent('<div id="app"></div>');
  await page.addStyleTag({ path: asset('element-plus/dist/index.css') });
  await page.addScriptTag({ path: asset('vue/dist/vue.global.prod.js') });
  await page.addScriptTag({ path: asset('element-plus/dist/index.full.min.js') });
  await page.addScriptTag({ content: `
    (() => {
      const module={exports:{}},exports=module.exports;
      let type='MIXED';
      const api={
        getEmployeeDistributionOptions:async()=>({data:{messageType:type,maxAttachmentBytes:100}}),
        submitEmployeeDistribution:async(selection,type,files)=>{window.sent={selection,type,names:files.map(file=>file.name)};}
      };
      const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:api;
      ${code}
      const Dialog=module.exports.default;
      Dialog.render=exports.render;
      Vue.createApp({setup(){
        const dialog=Vue.ref();
        window.openDistribution=(nextType)=>{type=nextType;return dialog.value.open({taskNo:'EC-TEST'},'测试任务');};
        return ()=>Vue.h(Dialog,{ref:dialog});
      }}).use(ElementPlus).mount('#app');
    })();`
  });
  await page.evaluate(() => (window as any).openDistribution('MIXED'));
  const dialog = page.getByRole('dialog', { name: '证书分发' });
  await dialog.locator('input[type=file]').setInputFiles([
    { name: 'guide.pdf', mimeType: 'application/pdf', buffer: Buffer.from('guide') },
    { name: 'oversize.zip', mimeType: 'application/zip', buffer: Buffer.alloc(120) },
    { name: 'removed.txt', mimeType: 'text/plain', buffer: Buffer.from('removed') }
  ]);
  await expect(dialog.getByText('已选择 3 / 3 个')).toBeVisible();
  await expect(dialog.getByRole('switch', { name: '发送附件 guide.pdf' })).toBeChecked();
  const oversize = dialog.locator('.attachment-row').filter({ hasText: 'oversize.zip' });
  await oversize.locator('.el-switch__core').click({ timeout: 4000 });
  await expect(oversize.getByRole('switch')).not.toBeChecked();
  await dialog.getByRole('button', { name: '移除附件 removed.txt' }).click();
  await expect(dialog.getByText('已选择 1 / 2 个')).toBeVisible();
  await dialog.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText(/另附 1 个文件/)).toBeVisible();
  await page.getByRole('button', { name: '确认发送' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sent)).toEqual({
    selection: { taskNo: 'EC-TEST' }, type: 'MIXED', names: ['guide.pdf']
  });
  await expect(dialog).toBeHidden();
  await page.evaluate(() => (window as any).openDistribution('TEXT'));
  const textDialog = page.getByRole('dialog', { name: '发送纯文本通知' });
  await expect(textDialog).toBeVisible();
  await expect(textDialog.getByRole('button', { name: '选择附件' })).toBeDisabled();
  await expect(textDialog.getByText('当前为纯文本模板，不能随邮件发送附件。')).toBeVisible();
  await expect(textDialog.locator('input[type=file]')).toHaveCount(0);
});
