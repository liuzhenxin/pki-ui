import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, compileScript, compileStyle, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { employeeCertLedgerPath } from '../src/utils/fawvwEmployeeNavigation';
import * as certificateSubject from '../src/utils/raCertificateSubject';
import * as issueValidity from '../src/utils/raIssueValidity';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

const submittedBatchNo = '11111111-1111-4111-8111-111111111111';
const mixedBatchNo = '22222222-2222-4222-8222-222222222222';

test('employee certificate filters and search buttons align at desktop and narrow widths', async ({ page }) => {
  const filename = 'employee-cert/index.vue';
  const source = readFileSync(new URL('../src/views/ra/employee-cert/index.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source, { filename });
  const actionSource = readFileSync(new URL('../src/views/ra/components/CertRowAction.vue', import.meta.url), 'utf8');
  const action = parse(actionSource).descriptor;
  const actionStyle = compileStyle({
    filename: 'CertRowAction.vue', id: 'employee-cert-action', source: action.styles[0].content, scoped: true
  });
  const searchCard = descriptor.template!.content.split('</el-card>')[0] + '</el-card></div>';
  const style = compileStyle({ filename, id: 'employee-cert-search', source: descriptor.styles[0].content, scoped: true });
  expect(style.errors).toEqual([]);
  expect(actionStyle.errors).toEqual([]);

  const modules = new URL('../node_modules/', import.meta.url);
  await page.setContent('<div id="app"></div>');
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  await page.addStyleTag({ content: 'body{margin:0}#app{padding:12px}@media(min-width:769px){#app{margin-left:220px}}' + style.code + actionStyle.code });
  for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
  }
  await page.addScriptTag({
    content: `
    Vue.createApp({
      __scopeId: 'data-v-employee-cert-search',
      template: ${JSON.stringify(searchCard)},
      data: () => ({ managementTab: 'ledger', canManageLegacy: true, showSearch: true, queryParams: {}, certificateStatuses: [], ledgerProfiles: [], ledgerProfilesLoading: false }),
      methods: { handleQuery() {}, resetQuery() {}, switchManagementTab() {}, openTemplates() {}, openDistributionConfig() {} }
    }).use(ElementPlus).directive('hasPermi', {}).component('CertRowAction', {
      __scopeId: 'data-v-employee-cert-action',
      props: ['label', 'icon'],
      template: ${JSON.stringify(action.template!.content)}
    }).mount('#app');
  `
  });

  const header = page.locator('.management-header');
  const tabs = header.getByRole('tablist');
  const templates = header.getByRole('button', { name: '分发模板' });
  const config = header.getByRole('button', { name: '分发设置' });
  await expect(templates).toHaveText('');
  await expect(config).toHaveText('');
  const form = page.locator('.query-form');
  const search = form.getByRole('button', { name: '搜索', exact: true });
  const reset = form.getByRole('button', { name: '重置', exact: true });
  for (const width of [1600, 1280, 980, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const tabBox = (await tabs.boundingBox())!;
    const templateBox = (await templates.boundingBox())!;
    const configBox = (await config.boundingBox())!;
    expect(configBox.y).toBeCloseTo(templateBox.y, 0);
    expect(Math.abs(configBox.y + configBox.height / 2 - tabBox.y - tabBox.height / 2)).toBeLessThan(2);
    expect(templateBox.x).toBeGreaterThanOrEqual(tabBox.x + tabBox.width);
    expect(configBox.x).toBeGreaterThan(templateBox.x);
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

function harness(overrides: Record<string, unknown> = {}, permissions?: string[], initialQuery: Record<string, string | undefined> = {},
  confirm: (message: string) => Promise<void> = async () => {}, passwordPreferences = new Map<string, string>()) {
  const hasPermi = (permission: string) => permissions?.includes(permission) ?? true;
  const source = readFileSync(new URL('../src/views/ra/employee-cert/index.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'index.vue', id: 'distribution' }).errors).toEqual([]);
  const compiled = compileScript(descriptor, { id: 'distribution' });
  const code = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const messages: Array<{ type: string; text: string }> = [];
  let status = 'SENDING';
  let timer: (() => Promise<void>) | undefined;
  let mount: (() => void) | undefined;
  let activate: (() => void) | undefined;
  let deactivate: (() => void) | undefined;
  let unmount: (() => void) | undefined;
  const route = vue.reactive({ path: employeeCertLedgerPath, query: { ...initialQuery } });
  const router = { replace: async (location: typeof route) => Object.assign(route, location) };
  const queries: any[] = [];
  const apiSource = readFileSync(new URL('../src/api/ra/employeeCert.ts', import.meta.url), 'utf8');
  const apiScript = ts.transpileModule(apiSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const apiModule = { exports: {} as any };
  new Function('require', 'exports', apiScript)(() => ({}), apiModule.exports);
  const api = new Proxy({
    canDistributeEmployeeCert: apiModule.exports.canDistributeEmployeeCert,
    distributeEmployeeCert: async () => ({ data: { distributionStatus: 'SENDING' } }),
    pageEmployeeCerts: async (query: any) => {
      queries.push(query);
      return { data: { total: query.taskNo ? 12 : query.distributionStatus === 'SENDING' && status !== 'SENDING' ? 0 : 1,
        records: [{ id: query.pageNum, issueStatus: 'ISSUED', certStatus: 'VALID', raCertId: 1, distributionStatus: status }] } };
    },
    pageEmployeeDistributionBatches: async () => ({
      data: { total: 1, records: [{ batchNo: submittedBatchNo, totalCount: 1, successCount: status === 'SENT' ? 1 : 0, failedCount: 0 }] }
    }),
    getEmployeeDistributionBatch: async () => ({ data: [{ certId: 1, sendStatus: status === 'SENT' ? 1 : 0 }] }),
    ...overrides
  }, { get: (target, name) => target[name as keyof typeof target] || (async () => ({ data: {} })) });
  const module = { exports: {} as any };
  const message = Object.fromEntries(['success', 'warning', 'error', 'info'].map((type) => [type, (text: string) => messages.push({ type, text })]));
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'setTimeout', 'clearTimeout', 'sessionStorage', code)(
    (name: string) => {
      if (name === 'vue')
        return {
          ...vue,
          onMounted: (callback: () => void) => (mount = callback),
          onActivated: (callback: () => void) => (activate = callback),
          onDeactivated: (callback: () => void) => (deactivate = callback),
          onUnmounted: (callback: () => void) => (unmount = callback)
        };
      if (name === 'vue-router') return { useRoute: () => route, useRouter: () => router };
      if (name === '@/utils/fawvwEmployeeNavigation') return { employeeCertLedgerPath };
      if (name === '@/utils/raCertificateSubject') return certificateSubject;
      if (name === 'file-saver') return { default: { saveAs: () => {} } };
      if (name === '@/api/ra/employeeCert') return api;
      if (name === '@/store/modules/user') return { useUserStore: () => ({ tenantId: '5', userId: '501' }) };
      if (name === '@/utils/raCertificateDownload') return { certificateDownloadBlob: async (blob: Blob) => blob };
      if (name === '@/plugins/auth') return { default: { hasPermi, hasPermiOr: (entries: string[]) => entries.some(hasPermi) } };
      if (name.endsWith('.vue')) return { default: {} };
      throw new Error(name);
    }, module, module.exports, message, { confirm },
    (callback: () => Promise<void>) => { timer = callback; return 1; }, () => (timer = undefined), {
      getItem: (key: string) => passwordPreferences.get(key),
      setItem: (key: string, value: string) => passwordPreferences.set(key, value),
      removeItem: (key: string) => passwordPreferences.delete(key)
    }
  );
  return {
    page: module.exports.default.setup({}, { expose: () => {} }),
    messages,
    queries,
    route,
    mount: () => mount!(),
    activate: () => activate!(),
    deactivate: () => deactivate!(),
    finish: () => (status = 'SENT'),
    poll: () => {
      const callback = timer;
      timer = undefined;
      return callback!();
    },
    stop: () => unmount!(),
    pending: () => timer
  };
}

test('mail and DingTalk test sends check connectivity before confirming one recipient', async () => {
  const requests: any[] = [];
  const confirmations: string[] = [];
  let confirmSend!: () => void;
  let cancelSend!: () => void;
  let failProbe = true;
  const filename = 'src/views/ra/employee-cert/EmployeeDistributionSettingsDialog.vue';
  const source = readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
  const { descriptor } = parse(source, { filename });
  const script = compileScript(descriptor, { id: 'distribution-settings' });
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as any };
  const api = {
    testEmployeeCertDistributionConfig: async (request: { send: boolean }) => {
      requests.push(request);
      if (!request.send && failProbe) throw new Error('unreachable');
      return { data: request.send ? 'ok' : '网关已响应（HTTP 405）' };
    }
  };
  const confirm = (message: string) => new Promise<void>((resolve, reject) => {
    confirmations.push(message);
    confirmSend = resolve;
    cancelSend = reject;
  });
  new Function('require', 'module', 'exports', code)(
    (name: string) => name === 'vue' ? vue : name === 'element-plus' ? { ElMessageBox: { confirm } } : api,
    module, module.exports
  );
  const page = module.exports.default.setup({}, { emit: () => {}, expose: () => {} });
  page.distributionConfigOpen.value = true;
  Object.assign(page.distributionConfig.value, { emailAccount: 'manual@example.test', smtpServer: 'CD', dingtalkApp: 'manual-app' });
  page.distributionTestEmail.value = 'one@example.test';
  await page.testDistributionConfig('EMAIL');
  expect(confirmations).toHaveLength(0);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ channel: 'EMAIL', send: false });
  expect(page.distributionTestResult.value).toContain('网关连通性检测失败');

  failProbe = false;
  const email = page.testDistributionConfig('EMAIL');
  await Promise.resolve();
  expect(confirmations.at(-1)).toContain('one@example.test');
  expect(confirmations.at(-1)).toContain('网络已连通');
  expect(requests).toHaveLength(2);
  cancelSend();
  await email;
  expect(requests).toHaveLength(2);

  page.distributionTestDing.value = 'ding.original';
  const ding = page.testDistributionConfig('DINGTALK');
  await Promise.resolve();
  expect(confirmations.at(-1)).toContain('ding.original');
  expect(requests[2]).toMatchObject({ channel: 'DINGTALK', send: false });
  expect(requests).toHaveLength(3);
  page.distributionTestDing.value = 'ding.changed';
  confirmSend();
  await ding;
  expect(requests).toHaveLength(4);
  expect(requests[3]).toMatchObject({
    channel: 'DINGTALK', send: true, recipient: 'ding.original',
    config: { emailAccount: 'manual@example.test', smtpServer: 'CD', dingtalkApp: 'manual-app' }
  });
});

test('task search filters the ledger without distributing unselected rows', async () => {
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
  page.distributeSelected();
  expect(selections).toHaveLength(0);
  page.queryParams.employeeName = 'Test';
  await page.handleQuery();
  page.distributeSelected();
  expect(selections).toHaveLength(0);
  await page.resetQuery();
  expect(queries.at(-1)).toMatchObject({ taskNo: '', pageNum: 1 });
  stop();
});

test('returning to the ledger preserves manual filters but explicitly reopening the same task resets them', async () => {
  const h = harness({}, undefined, { taskNo: 'EC-A', taskEntry: 'first-entry' });
  h.mount();
  expect(h.queries.at(-1)).toMatchObject({ taskNo: 'EC-A', pageNum: 1 });
  h.page.queryParams.taskNo = 'EC-B';
  await h.page.handleQuery();
  h.page.queryParams.pageNum = 2;
  await h.page.loadList();
  h.deactivate();
  h.route.path = '/other';
  await vue.nextTick();
  h.route.path = employeeCertLedgerPath;
  await vue.nextTick();
  await h.activate();
  expect(h.queries.at(-1)).toMatchObject({ taskNo: 'EC-B', pageNum: 2 });

  h.deactivate();
  h.route.path = '/production';
  await vue.nextTick();
  h.route.path = employeeCertLedgerPath;
  h.route.query.taskEntry = 'second-entry';
  await vue.nextTick();
  await h.activate();
  expect(h.page.queryParams.taskNo).toBe('EC-A');
  expect(h.queries.at(-1)).toMatchObject({ taskNo: 'EC-A', pageNum: 1 });

  h.route.query.taskNo = 'EC-C';
  await vue.nextTick();
  expect(h.queries.at(-1)).toMatchObject({ taskNo: 'EC-C', pageNum: 1 });
  h.stop();
});

test('production task opens the exact ledger task without sending any certificates', async () => {
  const task = { taskNo: 'EC-001' };
  const locations: unknown[] = [];
  const issue = issueHarness(
    {
      canDistributeEmployeeCert: () => true,
      getEmployeeCertTask: async () => ({ data: { task, certs: [{ id: 1 }, { id: 2 }] } })
    },
    async (location) => {
      locations.push(location);
      return undefined;
    }
  );
  await issue.openTask(task);
  const opened: unknown[] = [];
  issue.distributionDialog.value = { open: (selection: unknown) => opened.push(selection) };
  await issue.distributeTask(task);
  expect(locations).toEqual([{ path: employeeCertLedgerPath, query: { taskNo: 'EC-001', taskEntry: expect.any(String) } }]);
  expect(opened).toEqual([]);
  expect(issue.taskOpen.value).toBe(false);

  const h = harness({}, undefined, { taskNo: task.taskNo });
  h.mount();
  expect(h.page.managementTab.value).toBe('ledger');
  expect(h.page.queryParams.taskNo).toBe('EC-001');
  expect(h.queries).toEqual([expect.objectContaining({ taskNo: 'EC-001', pageNum: 1 })]);

  await h.page.switchManagementTab('distribution');
  h.page.queryParams.profileId = '8';
  h.page.queryParams.pageNum = 3;
  h.deactivate();
  h.route.path = '/ra-cert-management/ra-employee-cert-issue';
  await vue.nextTick();
  h.route.path = employeeCertLedgerPath;
  h.route.query = { taskNo: 'EC-002' };
  await vue.nextTick();
  h.activate();
  expect(h.page.managementTab.value).toBe('ledger');
  expect(h.page.queryParams.taskNo).toBe('EC-002');
  expect(h.queries.at(-1)).toMatchObject({ taskNo: 'EC-002', profileId: '', pageNum: 1 });
  h.route.query.taskNo = undefined;
  await vue.nextTick();
  expect(h.queries.at(-1)).toMatchObject({ taskNo: '', pageNum: 1 });
  h.stop();
});

test('submitted distributions open the matching task and batch and keep mixed selections visible', async () => {
  const pages: any[] = [];
  const details: string[] = [];
  const batch = (batchNo: string, taskNo?: string) => ({
    batchNo,
    taskNo,
    taskCount: taskNo ? 1 : 2,
    totalCount: taskNo ? 1 : 2,
    successCount: 1,
    failedCount: taskNo ? 0 : 1
  });
  const one = { certId: 1, taskNo: 'EC-001', serialNumber: 'A1', sendStatus: 2, emailStatus: 'SENT', dingtalkStatus: 'FAILED', certTypeName: '员工邮件证书' };
  const two = { certId: 2, taskNo: 'EC-002', sendStatus: 2, emailStatus: 'FAILED', dingtalkStatus: 'PENDING' };
  const h = harness({
    pageEmployeeDistributionBatches: async (query: any) => {
      pages.push(query);
      return { data: { total: 2, records: [batch('newest', 'EC-001'), query.taskNo ? batch(submittedBatchNo, query.taskNo) : batch(mixedBatchNo)] } };
    },
    getEmployeeDistributionBatch: async (batchNo: string) => {
      details.push(batchNo);
      return { data: [one, two] };
    }
  });
  await h.page.onDistributionSubmitted({ taskNo: 'EC-001' }, 'MIXED', submittedBatchNo);
  expect(h.page.managementTab.value).toBe('distribution');
  expect(h.page.distributionTaskNo.value).toBe('EC-001');
  expect(pages.at(-1)).toMatchObject({ taskNo: 'EC-001', pageNum: 1 });
  expect(details.at(-1)).toBe(submittedBatchNo);
  expect(h.page.distributionRecords.value).toEqual([one]);
  expect(h.page.distributionTaskDetail.value).toEqual(one);
  expect(h.page.distributionDetailsOpen.value).toBe(false);
  await h.page.selectDistributionBatch(submittedBatchNo);
  expect(h.page.distributionDetailsOpen.value).toBe(true);
  expect(h.page.distributionRecords.value).toEqual([one]);
  h.page.distributionDetailsOpen.value = false;

  const first = {
    id: 1,
    taskNo: 'EC-001',
    employeeName: 'One',
    distributionStatus: 'PENDING',
    issueStatus: 'ISSUED',
    raCertId: 1,
    certStatus: 'VALID'
  };
  const second = { ...first, id: 2, taskNo: 'EC-002' };
  const selections: any[] = [];
  h.page.distributionDialog.value = { open: (selection: any, description: string, taskNo?: string) => selections.push({ selection, taskNo }) };
  h.page.distribute(first, 'BOTH');
  h.page.selectedRows.value = [first];
  h.page.distributeSelected();
  h.page.selectedRows.value = [first, second];
  h.page.distributeSelected();
  expect(selections).toEqual([
    { selection: { ids: [1], freshBatch: true }, taskNo: 'EC-001' },
    { selection: { ids: [1], freshBatch: true }, taskNo: 'EC-001' },
    { selection: { ids: [1, 2], freshBatch: true }, taskNo: undefined }
  ]);
  await h.page.onDistributionSubmitted(selections[0].selection, 'TEXT', submittedBatchNo, selections[0].taskNo);
  expect(pages.at(-1).taskNo).toBe('EC-001');
  await h.page.onDistributionSubmitted(selections[2].selection, 'MIXED', mixedBatchNo, selections[2].taskNo);
  expect(h.page.distributionTaskNo.value).toBe('');
  expect(pages.at(-1).taskNo).toBeUndefined();
  expect(details.at(-1)).toBe(mixedBatchNo);
  expect(h.page.distributionRecords.value).toEqual([one, two]);
  h.stop();
});

test('sending records combine task number and batch type and reset both filters', async () => {
  const filters: unknown[] = [];
  const { page, route, stop } = harness({
    pageEmployeeDistributionBatches: async (query: unknown) => {
      filters.push(query);
      return { data: { records: [], total: 0 } };
    }
  });
  page.managementTab.value = 'distribution';
  page.distributionTaskNo.value = 'TASK-1';
  page.distributionBatchType.value = 'DISTRIBUTION';
  await page.searchDistributionRecords();
  expect(filters.at(-1)).toMatchObject({ taskNo: 'TASK-1', batchType: 'DISTRIBUTION', pageNum: 1 });
  expect(route.query).toMatchObject({ taskNo: 'TASK-1', batchType: 'DISTRIBUTION' });
  page.distributionBatchType.value = 'UPLOAD';
  await page.searchDistributionRecords();
  expect(filters.at(-1)).toMatchObject({ taskNo: 'TASK-1', batchType: 'UPLOAD' });
  await page.resetDistributionQuery();
  expect(filters.at(-1)).toMatchObject({ taskNo: undefined, batchType: undefined });
  stop();
});

test('a submitted batch stays selected outside the list page, across navigation and after reload', async () => {
  const detailReads: string[] = [];
  const finished = { certId: 1, taskNo: 'EC-001', sendStatus: 1, createTime: '2026-11-19T10:00:00', emailStatus: 'SENT' };
  const api = {
    pageEmployeeCerts: async () => ({ data: { total: 0, records: [] } }),
    pageEmployeeDistributionBatches: async () => ({
      data: { total: 11, records: [{ batchNo: mixedBatchNo, taskNo: 'EC-001', totalCount: 99, successCount: 99, failedCount: 0 }] }
    }),
    getEmployeeDistributionBatch: async (batchNo: string) => {
      detailReads.push(batchNo);
      return { data: batchNo === submittedBatchNo ? [finished] : [] };
    }
  };
  const h = harness(api, undefined, { taskNo: 'EC-001' });
  h.mount();
  await h.page.onDistributionSubmitted({ taskNo: 'EC-001' }, 'MIXED', submittedBatchNo);
  expect(h.route.query).toEqual({ tab: 'distribution', taskNo: 'EC-001', batchNo: submittedBatchNo });
  expect(h.page.activeDistributionBatch.value).toMatchObject({ batchNo: submittedBatchNo, totalCount: 1, successCount: 1 });
  expect(h.page.distributionBatches.value[0].batchNo).toBe(mixedBatchNo);

  h.page.distributionDetailsOpen.value = true;
  h.deactivate();
  expect(h.page.distributionDetailsOpen.value).toBe(false);
  h.route.path = '/statistics';
  await vue.nextTick();
  h.route.path = employeeCertLedgerPath;
  await vue.nextTick();
  await h.activate();
  expect(h.page.managementTab.value).toBe('distribution');
  expect(h.page.activeDistributionBatchNo.value).toBe(submittedBatchNo);

  const reloaded = harness(api, undefined, h.route.query);
  reloaded.mount();
  await expect.poll(() => reloaded.page.activeDistributionBatch.value?.batchNo).toBe(submittedBatchNo);
  expect(reloaded.page.distributionRecords.value).toEqual([finished]);
  expect(reloaded.page.distributionDetailsOpen.value).toBe(false);
  expect(detailReads).toEqual([submittedBatchNo, submittedBatchNo, submittedBatchNo]);
  await reloaded.page.searchDistributionRecords(mixedBatchNo);
  expect(reloaded.page.activeDistributionBatch.value).toBeUndefined();
  expect(reloaded.page.activeDistributionBatchNo.value).toBe(mixedBatchNo);
  expect(reloaded.page.distributionRecords.value).toEqual([]);
  await h.page.switchManagementTab('ledger');
  expect(h.route.query.tab).toBeUndefined();
  expect(h.page.queryParams.taskNo).toBe('EC-001');
  reloaded.stop();
  h.stop();
});

test('record reads retry after list and detail failures without resubmitting a finished text notice', async () => {
  let listReads = 0;
  let detailReads = 0;
  const h = harness({
    pageEmployeeCerts: async () => ({ data: { total: 0, records: [] } }),
    pageEmployeeDistributionBatches: async () => {
      if (++listReads === 1) throw new Error('list unavailable');
      return { data: { total: 0, records: [] } };
    },
    getEmployeeDistributionBatch: async () => {
      if (++detailReads === 2) throw new Error('details unavailable');
      return { data: [{ certId: 1, taskNo: 'EC-001', sendStatus: 1, messageType: 'TEXT', emailStatus: 'SENT' }] };
    }
  });
  h.mount();
  await h.page.onDistributionSubmitted({ taskNo: 'EC-001' }, 'TEXT', submittedBatchNo);
  expect(h.page.distributionReadFailures.value).toBe(1);
  expect(h.pending()).toBeDefined();
  await h.poll();
  expect(h.page.distributionReadFailures.value).toBe(2);
  await h.poll();
  expect(h.page.distributionReadFailures.value).toBe(0);
  expect(h.page.activeDistributionBatchNo.value).toBe(submittedBatchNo);
  expect(h.page.distributionRecords.value[0]).toMatchObject({ sendStatus: 1, emailStatus: 'SENT' });
  expect([listReads, detailReads]).toEqual([3, 3]);
  expect(h.pending()).toBeUndefined();
  h.stop();
});

test('distribution channel labels preserve recorded outcomes and mark unknown final results', () => {
  const h = harness();
  const channelStatus = h.page.distributionChannelStatus;
  expect(channelStatus({ sendStatus: 2, emailStatus: 'PENDING' }, 'emailStatus')).toBe('UNKNOWN');
  expect(channelStatus({ sendStatus: 2, emailStatus: 'FAILED', dingtalkStatus: 'PENDING' }, 'dingtalkStatus')).toBe('UNKNOWN');
  expect(channelStatus({ sendStatus: 0, dingtalkStatus: 'PENDING' }, 'dingtalkStatus')).toBe('PENDING');
  expect(channelStatus({ sendStatus: 2, emailStatus: 'SENT' }, 'emailStatus')).toBe('SENT');
  expect(channelStatus({ sendStatus: 2, dingtalkStatus: 'FAILED' }, 'dingtalkStatus')).toBe('FAILED');
  expect(channelStatus({ sendStatus: 1, messageType: 'TEXT' }, 'dingtalkStatus')).toBe('NOT_APPLICABLE');
  expect(channelStatus({ sendStatus: 2, messageType: 'NOTICE', emailStatus: 'SENT' }, 'emailStatus')).toBe('SENT');
  expect(channelStatus({ sendStatus: 2, messageType: 'NOTICE', dingtalkStatus: 'SENDING' }, 'dingtalkStatus')).toBe('UNKNOWN');
  expect(channelStatus({ sendStatus: 2, messageType: 'NOTICE', dingtalkStatus: 'PENDING' }, 'dingtalkStatus')).toBe('NOT_SENT');
  expect(channelStatus({ sendStatus: 2, messageType: 'NOTICE', dingtalkStatus: 'NOT_APPLICABLE' }, 'dingtalkStatus')).toBe('NOT_APPLICABLE');
  h.stop();
});

test('production task preserves distribution only for roles authorized to send when the ledger is unavailable', async () => {
  const task = { taskNo: 'EC-001' };
  const send = 'ra:employee-cert:distribute';
  const ledger = 'ra:employee-cert';
  const api = {
    canDistributeEmployeeCert: () => true,
    getEmployeeCertTask: async () => ({ data: { task, certs: [{ id: 1 }] } })
  };
  for (const [permissions, routeRegistered, expectedOpens] of [
    [[send], true, 1],
    [[send, ledger], false, 1],
    [[ledger], true, 0]
  ] as const) {
    const opened: unknown[] = [];
    const locations: unknown[] = [];
    const page = issueHarness(
      api,
      async (location) => {
        locations.push(location);
        return undefined;
      },
      [...permissions],
      routeRegistered
    );
    await page.openTask(task);
    page.distributionDialog.value = { open: (selection: unknown) => opened.push(selection) };
    expect(page.canIssueTaskCert({ id: 1, issueStatus: 'ISSUED' })).toBe(false);
    await page.distributeTask(task);
    expect(page.distributionPickerOpen.value).toBe(Boolean(expectedOpens));
    expect(opened).toEqual([]);
    if (expectedOpens) {
      page.distributionSelection.value = [{ id: 1 }];
      page.confirmTaskDistribution();
    }
    expect(locations).toEqual([]);
    expect(opened).toEqual(expectedOpens ? [{ ids: ['1'], freshBatch: true }] : []);
    expect(page.taskOpen.value).toBe(true);
  }
});

test('AD batch queues only eligible certificates after confirmation and displays its actual result', async () => {
  const requests: number[][] = [];
  const confirmations: string[] = [];
  const h = harness({
    distributeEmployeeCert: () => { throw new Error('AD upload must not send a distribution'); },
    queueEmployeeAdBatch: async (ids: number[]) => {
      requests.push(ids);
      return { data: submittedBatchNo };
    },
    pageEmployeeDistributionBatches: async () => ({ data: {
      total: 1, records: [{ batchNo: submittedBatchNo, taskType: 'UPLOAD', totalCount: 1, successCount: 0, failedCount: 0, runningCount: 1 }]
    } }),
    getEmployeeAdBatch: async () => ({ data: [{ certId: 10, sendStatus: 3, createTime: '2026-11-26T12:00:00' }] })
  }, undefined, {}, async message => { confirmations.push(message); });
  h.page.selectedRows.value = [{ id: 1, adUploadEligible: true }, { id: 2, adUploadEligible: false }];
  expect(h.page.adUploadSelectionReady.value).toBe(false);
  await h.page.uploadSelectedToAd();
  expect(requests).toEqual([]);
  h.page.selectedRows.value = [{ id: 1, adUploadEligible: true }];
  await h.page.uploadSelectedToAd();
  expect(confirmations).toEqual(['确认将所选 1 张证书上传至 AD？']);
  expect(requests).toEqual([[1]]);
  expect(h.page.activeDistributionBatch.value.taskType).toBe('UPLOAD');
  expect(h.page.batchResult(h.page.activeDistributionBatch.value).label).toBe('运行中');
  h.stop();
});

test('distribution submission is tracked without claiming completed delivery', async () => {
  const h = harness();
  const selections: any[] = [];
  h.page.distributionDialog.value = { open: (selection: any) => selections.push(selection) };
  const row = { id: 1, employeeName: 'Employee', distributionStatus: 'SENT', issueStatus: 'ISSUED', raCertId: 1, certStatus: 'VALID' };
  h.page.distribute(row, 'BOTH');
  h.page.distribute(row, 'EMAIL');
  h.page.distribute(row, 'DINGTALK');
  expect(selections).toEqual([
    { ids: [1], freshBatch: true },
    { ids: [1], certificateChannel: 'EMAIL' },
    { ids: [1], certificateChannel: 'DINGTALK' }
  ]);
  expect(h.pending()).toBeUndefined();
  h.mount();
  await h.page.onDistributionSubmitted({ ids: [1] }, 'MIXED', submittedBatchNo);
  expect(h.messages.some((message) => message.type === 'success')).toBe(false);
  expect(h.pending()).toBeDefined();
  h.finish();
  await h.poll();
  expect(h.page.managementTab.value).toBe('distribution');
  h.page.managementTab.value = 'ledger';
  await h.page.loadList();
  expect(h.page.rows.value[0].distributionStatus).toBe('SENT');
  h.stop();
});

test('legacy certificate import is available to issuers and administrators', () => {
  for (const [permissions, allowed] of [
    [['ra:employee-cert', 'ra:employee-cert:issue'], true],
    [['ra:employee-cert', 'ra:admin'], true],
    [['ra:employee-cert', 'ra:employee-cert:distribute'], false],
    [['ra:employee-cert:issue'], false]
  ] as const) {
    const { page, stop } = harness({}, [...permissions]);
    expect(page.managementTab.value).toBe('ledger');
    expect(page.canManageLegacy.value).toBe(allowed);
    page.switchManagementTab('legacy');
    expect(page.managementTab.value).toBe(allowed ? 'legacy' : 'ledger');
    stop();
  }
});

test('ledger export uses applied filters without pagination and certificate details use the ledger link', async () => {
  const exports: unknown[] = [];
  const opened: unknown[] = [];
  const page = harness({
    exportEmployeeCertLedger: async (filters: object) => {
      exports.push(filters);
      return new Blob(['test']);
    }
  });
  page.page.queryParams.domainAccount = 'applied';
  await page.page.handleQuery();
  page.page.queryParams.domainAccount = 'unsubmitted';
  page.page.queryParams.pageNum = 4;
  await page.page.handleExport();
  expect(exports).toEqual([expect.objectContaining({ domainAccount: 'applied' })]);
  expect(exports[0]).not.toHaveProperty('pageNum');
  expect(exports[0]).not.toHaveProperty('pageSize');
  page.page.ledgerCertificateDetail.value = { open: (row: unknown) => opened.push(row) };
  page.page.openLedgerCertificate({ id: '42', raCertId: '51', serialNumber: 'ABC', subject: 'CN=test' });
  expect(opened).toEqual([{ id: '42', serialNumber: 'ABC', subject: 'CN=test' }]);
  page.stop();
});

test('ledger remembers password visibility after reload and fetches only current-page passwords', async () => {
  const ids = ['9007199254740993', '9007199254740994'];
  const requests: string[][] = [];
  const preferences = new Map<string, string>();
  const api = {
    pageEmployeeCerts: async ({ pageNum }: { pageNum: number }) => ({
      data: { records: [{ id: ids[pageNum - 1], certPassword: '******' }], total: 2 }
    }),
    getEmployeeCertPasswords: async (selected: string[]) => {
      requests.push(selected);
      return { data: { [selected[0]]: 'fixture password' } };
    }
  };
  const first = harness(api, undefined, {}, undefined, preferences);
  first.mount();
  await first.page.loadList();
  expect(first.page.ledgerPasswords.value).toBeUndefined();
  await first.page.toggleLedgerPasswords();
  expect(requests).toEqual([[ids[0]]]);
  expect(first.page.ledgerPasswords.value).toEqual({ [ids[0]]: 'fixture password' });
  expect(first.page.rows.value[0].certPassword).toBe('******');
  expect([...preferences.values()]).toEqual(['1']);
  first.stop();

  const reopened = harness(api, undefined, {}, undefined, preferences);
  reopened.mount();
  await reopened.page.loadList();
  expect(reopened.page.ledgerPasswords.value).toEqual({ [ids[0]]: 'fixture password' });
  reopened.page.queryParams.pageNum++;
  expect(reopened.page.ledgerPasswords.value).toBeUndefined();
  await reopened.page.loadList();
  expect(reopened.page.ledgerPasswords.value).toEqual({ [ids[1]]: 'fixture password' });
  await reopened.page.toggleLedgerPasswords();
  expect(reopened.page.ledgerPasswords.value).toBeUndefined();
  expect(preferences.size).toBe(0);
  reopened.stop();
});

test('distribution templates can save pure text and delete only after confirmation', async () => {
  const text = { id: 'text', name: '业务通知', profileId: '0', revision: 'current', enabled: true,
    email: { type: 'TEXT', title: 'Notice', body: 'Body' } };
  const schemes = [text];
  const calls: unknown[] = [];
  let confirmed = false;
  const { page, stop } = harness({
    listEmployeeCertTemplates: async () => ({ data: [] }),
    listEmployeeDistributionSchemes: async () => ({ data: { schemes: [...schemes] } }),
    saveEmployeeDistributionScheme: async (scheme: object, files: File[]) => calls.push({ scheme, files }),
    deleteEmployeeDistributionScheme: async (id: string, revision: string) => {
      calls.push({ id, revision });
      schemes.pop();
    }
  }, undefined, {}, async () => { if (!confirmed) throw new Error('cancelled'); });
  await page.openTemplates();
  expect(page.templateRows.value).toContainEqual(expect.objectContaining({ scheme: text }));
  page.editScheme(text);
  await page.saveScheme();
  expect(calls).toEqual([{ scheme: expect.objectContaining({ email: text.email, profileId: '' }), files: [] }]);
  await page.removeScheme(text);
  expect(calls).toHaveLength(1);
  confirmed = true;
  await page.removeScheme(text);
  expect(calls[1]).toEqual({ id: 'text', revision: 'current' });
  expect(page.templateRows.value).not.toContainEqual(expect.objectContaining({ scheme: text }));
  stop();
});

test('employee certificate password editor saves empty and unmodified input', async () => {
  const cert = { id: '9007199254740993', issueStatus: 'ISSUED', raCertId: 5, distributionStatus: 'PENDING', certPassword: 'old' };
  const saved: Array<[string, string]> = [];
  let rejectSave = false;
  const { page, stop } = harness({
    getEmployeeCert: async () => ({ data: { cert: { ...cert }, logs: [] } }),
    updateEmployeeCertPassword: async (id: string, password: string) => {
      if (rejectSave) throw new Error('Save failed');
      saved.push([id, password]);
      cert.certPassword = password;
      return { data: true };
    }
  });
  await page.openDetail(cert);
  page.openPasswordEditor();
  expect(page.passwordDraft.value).toBe('old');
  page.passwordDraft.value = '';
  await page.saveCertificatePassword();
  expect(page.detail.value.cert.certPassword).toBe('');
  expect(page.passwordOpen.value).toBe(false);
  page.openPasswordEditor();
  page.passwordDraft.value = ' 证书! ';
  rejectSave = true;
  await expect(page.saveCertificatePassword()).rejects.toThrow('Save failed');
  expect(page.passwordOpen.value).toBe(true);
  expect(page.passwordDraft.value).toBe(' 证书! ');
  rejectSave = false;
  await page.saveCertificatePassword();
  expect(saved).toEqual([[cert.id, ''], [cert.id, ' 证书! ']]);
  expect(page.detail.value.cert.certPassword).toBe(' 证书! ');
  stop();
});

test('ledger signing template stays applied across pages and resets without changing task distribution', async () => {
  const profiles = [
    { id: '8', name: '安全Internet邮件证书模板' },
    { id: '9007199254740993', name: '另一份员工证书模板' }
  ];
  const { page, queries, stop } = harness({
    listEmployeeCertLedgerProfiles: async () => ({ data: profiles })
  });
  await page.loadLedgerProfiles();
  expect(page.ledgerProfiles.value).toEqual(profiles);
  page.queryParams.taskNo = 'EC-001';
  page.queryParams.profileId = '9007199254740993';
  page.queryParams.certStatus = 'VALID';
  page.queryParams.pageNum = 3;
  await page.handleQuery();
  expect(queries.at(-1)).toMatchObject({ profileId: '9007199254740993', certStatus: 'VALID', taskNo: 'EC-001', pageNum: 1 });
  expect(queries.at(-1)).not.toHaveProperty('certTypeCode');
  page.queryParams.pageNum = 2;
  page.queryParams.profileId = '8';
  await page.loadList();
  expect(queries.at(-1)).toMatchObject({ profileId: '9007199254740993', pageNum: 2 });
  await page.resetQuery();
  expect(queries.at(-1)).toMatchObject({ profileId: '', certStatus: '', pageNum: 1 });
  page.queryParams.taskNo = 'EC-001';
  await page.handleQuery();
  stop();
});

test('ledger status blocks single and batch channels and sends the selected search filter', async () => {
  const { page, queries, stop } = harness();
  const selections: any[] = [];
  page.distributionDialog.value = { open: (selection: any) => selections.push(selection) };
  const row = { id: 1, employeeName: 'Employee', distributionStatus: 'PENDING', issueStatus: 'ISSUED', raCertId: 1 };
  for (const certStatus of ['EXPIRED', 'EXPIRING', 'REVOKED', 'NOT_YET_VALID', 'UNKNOWN', 'ARCHIVED']) {
    const invalid = { ...row, certStatus };
    for (const channel of ['BOTH', 'EMAIL', 'DINGTALK']) page.distribute(invalid, channel);
    page.selectedRows.value = [invalid];
    page.distributeSelected();
  }
  expect(selections).toHaveLength(0);
  expect(page.certificateStatusLabel({ ...row, certStatus: 'EXPIRING', remainingDays: 0 })).toBe('剩余 0 天');
  page.selectedRows.value = [{ ...row, id: 2, certStatus: 'EXPIRED' }, { ...row, certStatus: 'VALID' }];
  page.distributeSelected();
  expect(selections).toHaveLength(0);
  page.selectedRows.value = [{ ...row, certStatus: 'VALID', distributionStatus: 'SENT' }];
  page.distributeSelected();
  expect(selections).toEqual([{ ids: [1], freshBatch: true }]);
  page.queryParams.certStatus = 'REVOKED';
  await page.handleQuery();
  expect(queries.at(-1)).toMatchObject({ certStatus: 'REVOKED' });
  expect(page.queryParams.pageNum).toBe(1);
  await page.resetQuery();
  expect(queries.at(-1)).toMatchObject({ certStatus: '' });
  stop();
});

test('certificate pages compile and remove arbitrary package uploads and password exports', () => {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/index.vue', import.meta.url), 'utf8');
  expect(source).not.toContain('uploadEmployeeCertDistributionPackage');
  expect(source).not.toContain('row.certPassword,');
  const settings = readFileSync(
    new URL('../src/views/ra/employee-cert/EmployeeDistributionSettingsDialog.vue', import.meta.url),
    'utf8'
  );
  expect(settings).toContain('v-model="visibleDistributionConfig.smtpServer"');
  expect(settings).not.toContain('v-model="distributionConfig.guideHtml"');
  expect(source).toContain('label="存量导入"');
  expect(source).toContain('label="证书台账"');
  expect(source).toContain('label="发送记录"');
  const header = source.slice(source.indexOf('class="management-header"'), source.indexOf('<LegacyCertificates'));
  expect(header).toContain('label="分发模板" icon="Message"');
  expect(header).toContain('label="分发设置" icon="Setting"');
  expect(source).not.toContain('按任务分发');
  expect(source).not.toContain('发送通知');
  expect(source).toContain('label="邮件模板"');
  expect(source).toContain('label="钉钉模板"');
  expect(source).toContain('label="到期时间" prop="notAfter"');
  const taskSource = readFileSync(new URL('../src/views/ra/employee-cert/issue.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(taskSource);
  expect(errors).toEqual([]);
  compileScript(descriptor, { id: 'distribution-task' });
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'issue.vue', id: 'distribution-task' }).errors).toEqual([]);
  const taskActions = taskSource.match(/<el-table-column label="操作"[^>]*>([\s\S]*?)<\/el-table-column>/)?.[1];
  expect(taskActions).toContain('<CertRowAction label="详情" icon="View" @click="openTask(row)" />');
  expect(taskActions).toContain('<EmployeeCertificateDownloadMenu');
  expect(taskActions).toContain(`v-hasPermi="['ra:employee-cert:distribute']"`);
  expect(taskActions).toContain(':disabled="row.successCount <= 0 || Boolean(downloadingTask)"');
  expect(taskActions).toContain('@download="downloadTaskPackage(row, $event)"');
  expect(taskSource).toContain('@click="issueSelectedCerts"');
  expect(taskSource).toContain(": '重签'");
  expect(taskSource).not.toContain(':disabled="!distributableTaskCerts.length"');
  expect(taskSource).toContain('@click="distributeTask(taskDetail.task)"');
  expect(taskSource).toContain('@submitted="onFallbackDistributionSubmitted"');
  expect(taskSource).toContain('prop="issueMessage"');
  expect(taskSource).toMatch(/label="办理类型"[\s\S]*?label="序列号"[\s\S]*?旧证书序列号：{{ original }}/);
  expect(taskSource).not.toContain('prop="distributionMessage"');
});

function issueHarness(
  api: Record<string, unknown>,
  push = async (_location: unknown) => undefined,
  permissions?: string[],
  routeRegistered = true
) {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/issue.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: 'issue-selected' });
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as any };
  let refreshOnReturn: (() => unknown) | undefined;
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'onMounted', 'watch', 'ref', 'reactive', 'computed', code)(
    (name: string) => {
      if (name === 'vue') return { ...vue, onUnmounted: () => {}, onDeactivated: () => {} };
      if (name === '@/hooks/useRaListRefreshOnReturn') return { useRaListRefreshOnReturn: (refresh: () => unknown) => { refreshOnReturn = refresh; } };
      if (name === 'vue-router') return {
        useRoute: () => ({ query: {}, fullPath: '/', path: '/' }),
        useRouter: () => ({ push, resolve: () => ({ matched: routeRegistered ? [{ path: employeeCertLedgerPath }] : [{ path: '/:pathMatch(.*)*' }] }) })
      };
      if (name === '@/plugins/auth') return { default: { hasPermi: (permission: string) => permissions?.includes(permission) ?? true } };
      if (name === '@/utils/fawvwEmployeeNavigation') return { employeeCertLedgerPath };
      if (name === '@/utils/raCertificateSubject') return certificateSubject;
      if (name === '@/utils/raIssueValidity') return issueValidity;
      if (name === '@/api/ra/employeeCert') return {
        pageEmployeeCertTasks: async () => ({ data: { records: [], total: 0 } }),
        listEmployeeCertTaskProfiles: async () => ({ data: [] }),
        getEmployeeProductionCandidateAvailability: async () => ({ data: [] }),
        ...api
      };
      return { default: {} };
    }, module, module.exports, { info: () => {}, success: () => {} }, { confirm: async () => true },
    () => {}, vue.watch, vue.ref, vue.reactive, vue.computed
  );
  const setup = module.exports.default.setup({}, { expose: () => {} });
  return Object.assign(setup, { refreshOnReturn });
}

test('employee PFX default restores the selected length and symbols after reopening', async () => {
  const rule = { length: 12, uppercase: false, lowercase: true, digits: true, symbols: true };
  const save = async (draft: typeof rule) => {
    expect(draft).toEqual(rule);
    return { data: draft };
  };
  const page = issueHarness({ saveEmployeePfxPasswordDefault: save });
  page.openPasswordRule();
  Object.assign(page.passwordRuleDraft, rule);
  await page.setDefaultPasswordRule();
  expect(page.savedPasswordRule.value).toEqual(rule);
  const reopened = issueHarness({ getEmployeePfxPasswordDefault: async () => ({ data: rule }) });
  await reopened.loadDefaultPasswordRule();
  reopened.openPasswordRule();
  expect(reopened.passwordRuleDraft).toEqual(rule);
  expect(reopened.passwordRuleSummary.value).toBe('12 位');
  expect(reopened.describePasswordRule(reopened.savedPasswordRule.value)).toContain('12 位');
  expect(reopened.describePasswordRule(reopened.savedPasswordRule.value)).toContain('特殊字符');
});

test('employee issuance sends only selected eligible IDs and displays the returned history', async () => {
  const issued = { id: '9007199254740993', issueStatus: 'ISSUED', serialNumber: '1234' };
  const failed = { id: '9007199254740994', issueStatus: 'FAILED', productionMode: 'AUTO' };
  const other = { id: '9007199254740995', issueStatus: 'FAILED' };
  const detail = { task: { taskNo: 'TEST' }, certs: [issued, failed, other] };
  const history = [{ startedAt: '2026-11-13T10:00:00', finishedAt: '2026-11-13T10:00:01', status: 'FAILED', message: 'CA CMP 500' }];
  const calls: unknown[] = [];
  const page = issueHarness({
    getEmployeeCertTask: async () => ({ data: detail }),
    issueEmployeeCertTask: async (taskNo: string, ids: string[]) => {
      calls.push({ taskNo, ids });
      return { data: { ...detail, certs: [issued, { ...failed, issueHistory: history, originalSerialNumbers: ['A123', 'B456'] }, other] } };
    }
  });
  await page.openTask(detail.task);
  expect(calls).toEqual([]);
  expect(page.canIssueCert(issued)).toBe(false);
  page.issueSelection.value = [issued, failed];
  await page.issueSelectedCerts();
  expect(calls).toEqual([{ taskNo: 'TEST', ids: [failed.id] }]);
  expect(page.taskDetail.value.certs[1].issueHistory).toEqual(history);
  expect(page.taskDetail.value.certs[1].originalSerialNumbers).toEqual(['A123', 'B456']);
  expect(page.productionTypeLabel(page.taskDetail.value.certs[1])).toBe('密钥恢复');
  expect(page.productionTypeLabel({ productionMode: 'AUTO' })).toBe('自动选择');
  expect(page.productionTypeLabel({ productionMode: 'NEW' })).toBe('新办');
  expect(page.productionTypeLabel({ productionMode: 'FALLBACK' })).toBe('新办');
  expect(page.productionTypeLabel({ productionMode: 'SELECTED' })).toBe('密钥恢复');
  expect(page.productionTypeLabel({ productionMode: 'RENEW' })).toBe('密钥恢复');
  expect(page.taskDetail.value.certs[2].issueHistory).toBeUndefined();
});

test('employee renewal displays automatic choices and keeps per-employee overrides', async () => {
  const first = { id: '9007199254740993', identityKey: 'first' };
  const second = { id: '9007199254740994', identityKey: 'second' };
  const submitted: unknown[] = [];
  const page = issueHarness({
    listEmployeeEmailCertProfiles: async () => ({ data: [{
      rootId: '1', rootName: 'CA', profileId: '2', profileName: '安全Internet邮件证书模板',
      enabled: true, supportedRsaKeySizes: [2048], templateValidity: '1y',
      issuerNotAfter: new Date(Date.now() + 730 * 86400000).toISOString()
    }] }),
    getEmployeeCertIssuanceDefault: async () => ({ data: { issuanceMode: 'RENEW' } }),
    getEmployeeProductionCandidateAvailability: async (data: Record<string, unknown>) => {
      expect(data).toEqual({ rootId: '1', profileId: '2', rsaKeySize: 2048,
        employeeIds: [first.id, second.id], identityKeys: [first.identityKey, second.identityKey] });
      return { data: [first.id] };
    },
    listEmployeeProductionCandidates: async () => ({ data: [{ id: '99' }] }),
    createEmployeeCertTask: async (data: unknown) => {
      submitted.push(data);
      return { data: { task: { taskNo: 'TEST' }, certs: [] } };
    }
  });
  await page.loadEmailProfiles();
  await page.loadIssuanceDefault();
  page.form.rootId = '1';
  page.form.profileId = '2';
  page.selectedEmployees.value = [first, second];
  await expect.poll(() => page.productionChoiceLabel(first)).toBe('续签');
  expect(page.productionChoiceLabel(second)).toBe('新签');
  await page.openKeys(first);
  page.keyChoice.value = '99';
  page.saveKeyChoice();
  expect(page.productionChoiceLabel(first)).toBe('已指定');
  await page.openKeys(first);
  expect(page.keyChoice.value).toBe('99');
  page.keyChoice.value = 'AUTO';
  page.saveKeyChoice();
  expect(page.productionChoiceLabel(first)).toBe('续签');
  await page.openKeys(first);
  page.keyChoice.value = 'NEW';
  page.saveKeyChoice();
  expect(page.productionChoiceLabel(first)).toBe('新签');
  await page.createTask();
  expect(submitted).toEqual([expect.objectContaining({
    issuanceMode: 'RENEW', productionChoices: [{ employeeId: first.id, mode: 'NEW' }]
  })]);
});

test('production details can open batch distribution before the ledger checks certificate eligibility', async () => {
  const task = { taskNo: 'EC-001' };
  const locations: unknown[] = [];
  const page = issueHarness({
    canDistributeEmployeeCert: () => false,
    getEmployeeCertTask: async () => ({ data: { task, certs: [{ id: 1, issueStatus: 'ISSUED' }] } })
  }, async location => { locations.push(location); return undefined; });
  await page.openTask(task);
  expect(page.distributableTaskCerts.value).toEqual([]);
  await page.distributeTask(task);
  expect(locations).toEqual([expect.objectContaining({ query: expect.objectContaining({ taskNo: task.taskNo }) })]);
});

test('employee automatic issuance refreshes progress and exposes only failed rows for retry', async () => {
  const queued = { taskNo: 'AUTO', taskStatus: 'AUTO_QUEUED' };
  const running = { ...queued, taskStatus: 'AUTO_ISSUING' };
  const done = { ...queued, taskStatus: 'PARTIAL_FAILED' };
  const issued = { id: '1', issueStatus: 'ISSUED', serialNumber: '81' };
  const failed = { id: '2', issueStatus: 'FAILED' };
  const pending = { ...failed, issueStatus: 'READY_FOR_ISSUE' };
  const tasks = [queued, running, done];
  const details = [
    { task: queued, certs: [{ ...pending, id: issued.id }, pending] },
    { task: running, certs: [issued, { ...pending, issueStatus: 'ISSUING' }] },
    { task: done, certs: [issued, failed] }
  ];
  const calls: string[][] = [];
  let listIndex = 0;
  let detailIndex = 0;
  const page = issueHarness({
    pageEmployeeCertTasks: async () => {
      if (listIndex++ === 1) throw new Error('temporary list refresh failure');
      return { data: { records: [tasks[Math.max(0, Math.min(listIndex - 2, 2))]], total: 1 } };
    },
    getEmployeeCertTask: async () => ({ data: details[Math.min(detailIndex++, 2)] }),
    issueEmployeeCertTask: async (_taskNo: string, certIds: string[]) => {
      calls.push(certIds);
      return { data: details[2] };
    }
  });
  expect(tasks.concat({ ...done, taskStatus: 'ISSUED' }).map((task) =>
    page.issueStatusType(page.taskIssueStatus(task.taskStatus))
  )).toEqual(['info', 'warning', 'danger', 'success']);
  page.activeTab.value = 'tasks';
  await page.loadTasks();
  await page.openTask(queued);
  page.issueSelection.value = [pending];
  await page.issueSelectedCerts();
  expect(calls).toEqual([]);
  await expect.poll(() => page.tasks.value[0]?.taskStatus, { timeout: 9000 }).toBe('AUTO_ISSUING');
  await expect.poll(() => page.detailIssueStatus.value, { timeout: 9000 }).toBe('FAILED');
  await expect.poll(() => page.tasks.value[0]?.taskStatus, { timeout: 9000 }).toBe('PARTIAL_FAILED');
  expect(page.canIssueTaskCert(issued)).toBe(false);
  expect(page.canIssueTaskCert(failed)).toBe(true);
  page.issueSelection.value = [issued, failed];
  await page.issueSelectedCerts();
  expect(calls).toEqual([['2']]);
});

test('manual retry shows progress for submitted rows while the signing request is still open', async () => {
  const task = { taskNo: 'RETRY', taskStatus: 'PARTIAL_FAILED' };
  const first = { id: '1', version: 2, issueStatus: 'FAILED' };
  const second = { id: '2', version: 2, issueStatus: 'FAILED' };
  const unselected = { id: '3', version: 2, issueStatus: 'FAILED' };
  const next = { ...first, version: 3, issueStatus: 'ISSUED', serialNumber: '81' };
  const progressed = { task: { ...task, taskStatus: 'ISSUING' }, certs: [next, second, unselected] };
  const finished = { task, certs: [next, { ...second, version: 3 }, unselected] };
  let reads = 0;
  let finish: () => void = () => {};
  let deliverStale: () => void = () => {};
  const page = issueHarness({
    getEmployeeCertTask: async () => {
      reads++;
      if (reads === 1) return { data: { task, certs: [first, second, unselected] } };
      if (reads === 2) return { data: progressed };
      return new Promise((resolve) => { deliverStale = () => resolve({ data: progressed }); });
    },
    issueEmployeeCertTask: async () => new Promise((resolve) => { finish = () => resolve({ data: finished }); })
  });
  await page.openTask(task);
  page.issueSelection.value = [first, second];
  const retry = page.issueSelectedCerts();
  await expect.poll(() => page.detailIssueStatus.value).toBe('ISSUING');
  expect(page.displayIssueStatus(first)).toBe('ISSUING');
  expect(page.displayIssueStatus(second)).toBe('ISSUING');
  expect(page.displayIssueStatus(unselected)).toBe('FAILED');
  await expect.poll(() => page.taskDetail.value.certs.map(page.displayIssueStatus)).toEqual(['ISSUED', 'ISSUING', 'FAILED']);
  await expect.poll(() => reads).toBe(3);
  finish();
  await retry;
  deliverStale();
  await Promise.resolve();
  expect(page.detailIssueStatus.value).toBe('FAILED');
  expect(page.taskDetail.value.certs.map(page.displayIssueStatus)).toEqual(['ISSUED', 'FAILED', 'FAILED']);
});

test('task search combines task number and signing template and reset clears both', async () => {
  const profile = { id: '9007199254740997', name: '旧版邮件模板' };
  const queries: Record<string, unknown>[] = [];
  const page = issueHarness({
    listEmployeeCertTaskProfiles: async () => ({ data: [profile] }),
    pageEmployeeCertTasks: async (query: Record<string, unknown>) => {
      queries.push({ ...query });
      return { data: { records: [], total: 0 } };
    }
  });
  await page.handleTabChange('tasks');
  expect(page.taskProfiles.value).toEqual([profile]);
  Object.assign(page.taskQuery, { taskNo: 'EC123', profileId: profile.id, pageNum: 4 });
  await page.searchTasks();
  expect(queries.at(-1)).toMatchObject({ taskNo: 'EC123', profileId: profile.id, pageNum: 1 });
  await page.resetTaskQuery();
  expect(queries.at(-1)).toMatchObject({ taskNo: '', profileId: '', pageNum: 1 });
});

test('employee task requires explicit CA and template selection and resets it when CA changes', async () => {
  const rootA = '9007199254740993';
  const rootB = '9007199254740995';
  const profileId = '9007199254740997';
  const rsa = {
    rootId: rootA,
    rootName: 'CA A',
    profileId,
    profileName: '其他邮件模板',
    enabled: true,
    maxValidityYears: 2,
    supportedRsaKeySizes: [2048, 4096],
    templateValidity: '2y',
    issuerNotAfter: '2099-01-01T00:00:00Z'
  };
  const alternate = {
    ...rsa,
    rootId: rootB,
    rootName: 'CA B',
    profileName: '安全Internet邮件证书模板',
    issuerNotAfter: new Date(Date.now() + 540 * 86400000).toISOString()
  };
  let profiles = [rsa];
  const submissions: unknown[] = [];
  const page = issueHarness({
    listEmployeeEmailCertProfiles: async () => ({ data: profiles }),
    getEmployeeCertIssuanceDefault: async () => ({ data: { issuanceMode: 'RENEW' } }),
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
  expect(page.form.issuanceMode).toBe('NEW');
  expect(page.supportsRenewal.value).toBe(false);
  expect(page.form.validityAmount).toBe(2);
  expect(page.form.validityUnit).toBe('year');
  expect(Math.abs(page.form.notBefore.getTime() - Date.now())).toBeLessThan(10_000);
  expect(page.canCreateTask.value).toBe(true);
  page.form.rootId = rootB;
  expect(page.form.profileId).toBe('');
  expect(page.form.issuanceMode).toBeUndefined();
  expect(page.profilesForCa.value).toEqual([alternate]);
  await page.createTask();
  expect(submissions).toEqual([]);
  page.form.profileId = profileId;
  expect(page.canCreateTask.value).toBe(false);
  await page.loadIssuanceDefault();
  expect(page.form.issuanceMode).toBe('RENEW');
  expect(page.supportsRenewal.value).toBe(true);
  expect(page.validityPreview.value.error).toBe('有效期不能超过上级签发 CA 的到期时间');
  expect(page.canCreateTask.value).toBe(false);
  page.form.validityAmount = 3;
  expect(page.validityPreview.value.error).toBe('有效期不能超过模板允许的时间');
  const current = new Date();
  page.form.notBefore = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 9, 1, 2, 3));
  page.form.validityAmount = 2;
  page.form.validityUnit = 'month';
  const start = page.form.notBefore.toISOString().slice(0, 19);
  const end = new Date(page.form.notBefore);
  end.setUTCMonth(end.getUTCMonth() + 2);
  expect(page.canCreateTask.value).toBe(true);
  page.form.issuanceMode = 'NEW';
  await page.createTask();
  expect(submissions).toEqual([
    {
      employeeIds: ['1'],
      identityKeys: ['verified'],
      userIds: ['42'],
      rootId: rootB,
      profileId,
      issuanceMode: 'NEW',
      notBefore: start,
      notAfter: end.toISOString().slice(0, 19),
      rsaKeySize: 2048,
      productionChoices: [],
      pfxPasswordRule: null,
      remark: ''
    }
  ]);
  expect(page.taskCaName(page.taskDetail.value.task.rootId)).toBe('CA B');

  profiles = [rsa, { ...alternate, enabled: false }];
  await page.loadEmailProfiles();
  expect(page.form.rootId).toBe('');
  expect(page.form.profileId).toBe('');
  expect(page.canCreateTask.value).toBe(false);
  expect(page.taskCaName(rootB)).toBe('CA B');
});

test('employee issuance defaults follow CA authorization and fill the request', async () => {
  const rootA = '9007199254740993';
  const rootB = '9007199254740995';
  const profileA = '9007199254740997';
  const profileB = '9007199254740999';
  const options = { enabled: true, templateValidity: '2y', issuerNotAfter: '2099-01-01T00:00:00Z' };
  const safe = {
    ...options,
    rootId: rootA,
    rootName: 'CA A',
    profileId: profileA,
    profileName: '安全Internet邮件证书模板',
    supportedRsaKeySizes: [2048, 4096]
  };
  const other = { ...options, rootId: rootB, rootName: 'CA B', profileId: profileB, profileName: '其他模板', supportedRsaKeySizes: [2048] };
  let profiles = [safe, other];
  const initial = { rootId: rootA, profileId: profileA, rsaKeySize: 4096, issuanceMode: 'RENEW' };
  let saved: unknown = initial;
  const page = issueHarness({
    listEmployeeEmailCertProfiles: async () => ({ data: profiles }),
    getEmployeeCertIssuanceDefault: async () => ({ data: saved }),
    saveEmployeeCertIssuanceDefault: async (data: unknown) => {
      saved = data;
      return { data };
    }
  }, undefined, ['ra:employee-cert:issue']);
  expect(page.canEditProfilePolicy.value).toBe(false);
  await page.loadIssuanceDefault();
  expect(page.form.rootId).toBe('');
  await page.openProfilePolicy();
  expect(page.profilePolicyOpen.value).toBe(true);
  expect(page.form).toMatchObject(initial);
  page.form.rsaKeySize = 2048;
  page.form.rootId = rootB;
  page.form.profileId = profileB;
  expect(page.form).toMatchObject({ rootId: rootB, profileId: profileB, rsaKeySize: 2048, issuanceMode: 'NEW' });
  page.form.notBefore = new Date('2020-01-01T00:00:00Z');
  page.activeTab.value = 'tasks';
  page.activeTab.value = 'create';
  expect(page.form).toMatchObject(initial);
  expect(Math.abs(page.form.notBefore.getTime() - Date.now())).toBeLessThan(10_000);
  expect(page.form.validityAmount).toBe(2);
  page.form.rsaKeySize = 2048;
  await page.refreshOnReturn();
  expect(page.form).toMatchObject(initial);
  page.openIssuanceDefaults();
  expect(page.issuanceDefaultDraft).toMatchObject(initial);
  expect(page.draftSupportsRenewal.value).toBe(true);
  page.issuanceDefaultDraft.rootId = rootB;
  expect(page.issuanceDefaultDraft.profileId).toBe('');
  expect(page.defaultProfilesForCa.value).toEqual([other]);
  page.issuanceDefaultDraft.profileId = profileB;
  expect(page.issuanceDefaultDraft.rsaKeySize).toBe(2048);
  expect(page.issuanceDefaultDraft.issuanceMode).toBe('NEW');
  expect(page.draftSupportsRenewal.value).toBe(false);
  await page.saveIssuanceDefault();
  expect(saved).toEqual({ rootId: rootB, profileId: profileB, rsaKeySize: 2048, issuanceMode: 'NEW' });
  expect(page.form).toMatchObject(saved as object);

  profiles = [safe, { ...other, enabled: false }];
  await page.loadEmailProfiles();
  expect(page.form.rootId).toBe('');
  expect(page.form.profileId).toBe('');
  page.openIssuanceDefaults();
  expect(page.canSaveIssuanceDefault.value).toBeFalsy();
  page.form.rootId = rootA;
  page.form.profileId = profileA;
  page.form.rsaKeySize = 4096;
  await page.saveIssuanceDefault(true);
  expect(saved).toEqual({ issuanceMode: 'NEW' });
  expect(page.form).toMatchObject({ rootId: '', profileId: '', rsaKeySize: undefined });
  page.form.rootId = rootA;
  page.form.profileId = profileA;
  page.form.rsaKeySize = 4096;
  expect(page.form).toMatchObject({ rootId: rootA, profileId: profileA, rsaKeySize: 4096, issuanceMode: 'NEW' });
  page.activeTab.value = 'tasks';
  page.activeTab.value = 'create';
  expect(page.form).toMatchObject({ rootId: '', profileId: '', rsaKeySize: undefined });

  profiles = [{ ...safe, templateValidity: '12h' }];
  await page.loadEmailProfiles();
  page.form.rootId = rootA;
  page.form.profileId = profileA;
  expect(page.validityPreview.value.error).toBe('模板有效期不足 1 日，请核对 CA 模板');
});

test('employee production keeps a selected original only for the matching CA, profile and key length', async () => {
  const profile = { rootId: '20', rootName: 'CA', profileId: '21', profileName: '安全Internet邮件证书模板', enabled: true,
    maxValidityYears: 2, supportedRsaKeySizes: [2048, 4096] };
  const employee = { id: '1', identityKey: 'verified' };
  const certificateId = '9007199254740997';
  const calls: unknown[] = [];
  const detailCalls: unknown[] = [];
  const page = issueHarness({
    listEmployeeEmailCertProfiles: async () => ({ data: [profile] }),
    listEmployeeProductionCandidates: async (id: string, filters: Record<string, unknown>) => {
      calls.push({ id, ...filters });
      return { data: [{ id: certificateId, serialNumber: '12' }] };
    },
    getEmployeeProductionCandidateDetail: async (id: string, certId: string, filters: Record<string, unknown>) => {
      detailCalls.push({ id, certId, ...filters });
      return { data: { summary: { id: certId, serialNumber: '12' } } };
    }
  });
  await page.loadEmailProfiles();
  page.form.rootId = profile.rootId;
  page.form.profileId = profile.profileId;
  page.form.issuanceMode = 'RENEW';
  await page.openKeys(employee);
  expect(calls).toEqual([{ id: employee.id, rootId: '20', profileId: '21', rsaKeySize: 2048 }]);
  await page.loadCandidateCertificate(page.keys.value[0].id);
  expect(detailCalls).toEqual([{ id: employee.id, certId: certificateId, rootId: '20', profileId: '21', rsaKeySize: 2048 }]);
  expect(page.keyChoice.value).toBe('AUTO');
  page.keyChoice.value = certificateId;
  page.saveKeyChoice();
  expect(page.productionChoices.value).toEqual({
    '1': { employeeId: '1', mode: 'SELECTED', certId: '9007199254740997' }
  });
  page.form.rsaKeySize = 4096;
  await Promise.resolve();
  expect(page.productionChoices.value).toEqual({});
});

test('distribution sends only after the final confirmation and ignores double clicks', async () => {
  const source = readFileSync(new URL('../src/views/ra/employee-cert/DistributionDialog.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: 'distribution-confirm' });
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'DistributionDialog.vue', id: 'distribution-confirm' }).errors).toEqual([]);
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let resolveConfirm: () => void;
  let rejectConfirm: () => void;
  let retrying = false;
  const confirmations: string[] = [];
  const sent: any[] = [];
  const general = { id: 'GENERAL', name: 'General', messageType: 'MIXED', confirmation: 'general-version' };
  const alternate = { id: 'alternate', name: 'Alternate', messageType: 'MIXED', confirmation: 'alternate-version' };
  const notice = { id: 'notice', name: 'Notice', messageType: 'TEXT', confirmation: 'notice-version' };
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name === 'vue') return vue;
    if (name === 'element-plus') return {
      ElMessage: { info: () => {} },
      ElMessageBox: { confirm: (message: vue.VNode) => new Promise<void>((resolve, reject) => {
        confirmations.push(String((message.children as vue.VNode[])[0].children));
        resolveConfirm = resolve;
        rejectConfirm = reject;
      }) }
    };
    if (name === '@/api/ra/employeeCert') return {
      getEmployeeDistributionOptions: async (_, purpose: string) => ({
        data: purpose === 'NOTICE'
          ? { messageType: 'TEXT', maxAttachmentBytes: 1024, defaultSchemeId: notice.id, count: 2, schemes: [notice],
              recipients: [{domainAccount: 'first'}, {domainAccount: 'second'}] }
          : {
          messageType: 'MIXED', maxAttachmentBytes: 1024, defaultSchemeId: general.id, count: 2,
          retryDingtalkCount: retrying ? 2 : 0, schemes: retrying ? [general] : [general, alternate],
          recipients: [{domainAccount: 'first'}, {domainAccount: 'second'}]
        }
      }),
      submitEmployeeDistribution: async (...args: any[]) => {
        sent.push(args);
        return { data: { batchNo: 'batch-1' } };
      }
    };
    throw new Error(name);
  }, module, module.exports);
  const dialog = module.exports.default.setup({}, { expose: () => {}, emit: () => {} });
  const selection = { ids: [1, 2] };
  await dialog.open(selection, '2 employees');
  expect(dialog.schemeId.value).toBe(general.id);
  expect(dialog.messageType.value).toBe('MIXED');
  const cancelled = dialog.submit();
  expect(sent).toHaveLength(0);
  rejectConfirm!();
  await cancelled;
  expect(sent).toHaveLength(0);
  dialog.schemeId.value = alternate.id;
  expect(dialog.messageType.value).toBe('MIXED');
  const confirmed = dialog.submit();
  await dialog.submit();
  expect(sent).toHaveLength(0);
  resolveConfirm!();
  await confirmed;
  expect(sent).toEqual([[selection, 'MIXED', [], alternate]]);
  retrying = true;
  await dialog.open(selection, '2 employees');
  expect(dialog.retryOnly.value).toBe(true);
  expect(dialog.schemeId.value).toBe(general.id);
  dialog.attachments.value = [{ name: 'optional.txt', uid: 1, raw: { name: 'optional.txt', size: 7 } }];
  const retry = dialog.submit();
  expect(confirmations.at(-1)).toContain('补发钉钉，不重复发邮件');
  resolveConfirm!();
  await retry;
  expect(sent.at(-1)).toEqual([selection, 'MIXED', [], general]);

  await dialog.open(selection, '2 employees', undefined, 'NOTICE');
  expect(dialog.schemeId.value).toBe(notice.id);
  await dialog.submit();
  expect(sent).toHaveLength(2);
  dialog.noticeChannels.value = ['DINGTALK'];
  const notification = dialog.submit();
  expect(confirmations.at(-1)).toContain('通过钉钉发送通知');
  resolveConfirm!();
  await notification;
  expect(sent.at(-1)).toEqual([selection, 'TEXT', [], notice, ['DINGTALK']]);
});

test('distribution includes uploaded attachments unless removed', async ({ page }) => {
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
        getEmployeeDistributionOptions:async()=>({data:{messageType:type,maxAttachmentBytes:100,defaultSchemeId:'general',
          schemes:[{id:'general',name:'通用模板',messageType:type==='BOUND'?'MIXED':type,confirmation:'test-confirmation',
            groups:type==='BOUND'?[{name:'邮件证书模板',count:1,attachmentNames:['guide.pdf'],retryOnly:false}]:undefined}],
          recipients:[{name:'测试员工',domainAccount:'test.user'}]}}),
        submitEmployeeDistribution:async(selection,type,files)=>{
          window.sent={selection,type,names:files.map(file=>file.name)};
          return {data:{batchNo:'batch-1'}};
        }
      };
      const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:api;
      ${code}
      const Dialog=module.exports.default;
      Dialog.render=exports.render;
      Vue.createApp({setup(){
        const dialog=Vue.ref();
        window.openDistribution=(nextType,mode)=>{
          type=nextType;
          const selection=mode===true?{ids:[1],freshBatch:true}:mode?{ids:[1],certificateChannel:mode}:{ids:[1]};
          return dialog.value.open(selection,'测试任务');
        };
        return ()=>Vue.h(Dialog,{ref:dialog});
      }}).use(ElementPlus).mount('#app');
    })();`
  });
  await page.evaluate(() => (window as any).openDistribution('MIXED'));
  const dialog = page.getByRole('dialog', { name: '证书分发' });
  await expect(dialog.locator('.recipient-list')).toContainText('测试员工（test.user）');
  await dialog.locator('input[type=file]').setInputFiles([
    { name: 'guide.pdf', mimeType: 'application/pdf', buffer: Buffer.from('guide') },
    { name: 'oversize.zip', mimeType: 'application/zip', buffer: Buffer.alloc(120) },
    { name: 'removed.txt', mimeType: 'text/plain', buffer: Buffer.from('removed') }
  ]);
  await expect(dialog.getByText('已添加 3 个附件')).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(0);
  await dialog.getByRole('button', { name: '移除附件 oversize.zip' }).click();
  await dialog.getByRole('button', { name: '移除附件 removed.txt' }).click();
  await expect(dialog.getByText('已添加 1 个附件')).toBeVisible();
  await dialog.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText(/ZIP 内含证书及 1 个附件/)).toBeVisible();
  await page.getByRole('button', { name: '确认发送' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sent)).toEqual({
    selection: { ids: [1] }, type: 'MIXED', names: ['guide.pdf']
  });
  await expect(dialog).toBeHidden();
  await page.evaluate(() => (window as any).openDistribution('TEXT'));
  const textDialog = page.getByRole('dialog', { name: '发送纯文本通知' });
  await expect(textDialog).toBeVisible();
  await expect(textDialog.getByRole('button', { name: '上传附件' })).toBeDisabled();
  await expect(textDialog.getByText('当前为纯文本模板，不能随邮件发送附件。')).toBeVisible();
  await expect(textDialog.locator('input[type=file]')).toHaveCount(0);
  await textDialog.getByRole('button', { name: '取消' }).click();
  await page.evaluate(() => (window as any).openDistribution('BOUND'));
  await expect(dialog.getByText('分发模板', { exact: true })).toBeVisible();
  await expect(dialog.getByText('邮件附件', { exact: true })).toBeVisible();
  await expect(dialog.getByText('guide.pdf')).toBeVisible();
  await expect(dialog.getByText('邮件明确失败后，可按当前启用的分发模板重新发送。')).toBeVisible();
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await expect(dialog.locator('input[type=file]')).toHaveCount(0);
  await dialog.getByRole('button', { name: '下一步' }).click();
  const confirmation = page.locator('.el-message-box');
  await expect(confirmation.getByText('分发模板', { exact: true })).toBeVisible();
  await expect(confirmation.getByText('邮件附件', { exact: true })).toBeVisible();
  await expect(confirmation.getByText('模板附件与 PFX 一起打包为一个 ZIP。')).toBeVisible();
  await page.getByRole('button', { name: '确认发送' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sent)).toEqual({
    selection: { ids: [1] }, type: 'MIXED', names: []
  });
  await expect(dialog).toBeHidden();
  await page.evaluate(() => (window as any).openDistribution('BOUND', true));
  await expect(dialog.getByText(/本次新建分发批次.*邮件失败则跳过钉钉/)).toBeVisible();
  await dialog.getByRole('button', { name: '下一步' }).click();
  await expect(confirmation.getByText(/本次新建分发批次.*邮件失败则跳过钉钉/)).toBeVisible();
  await page.getByRole('button', { name: '确认发送' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sent)).toEqual({
    selection: { ids: [1], freshBatch: true }, type: 'MIXED', names: []
  });
  await expect(dialog).toBeHidden();
  for (const [channel, label, status] of [['EMAIL', '仅邮件', '保留钉钉状态'], ['DINGTALK', '仅钉钉', '保留邮件状态']]) {
    await page.evaluate((mode) => (window as any).openDistribution('BOUND', mode), channel);
    const single = page.getByRole('dialog', { name: '证书分发 · ' + label });
    await expect(single.getByText(status, { exact: false })).toBeVisible();
    await expect(single.getByText('guide.pdf')).toHaveCount(channel === 'EMAIL' ? 1 : 0);
    await single.getByRole('button', { name: '下一步' }).click();
    await expect(confirmation.getByText(status, { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '确认发送' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).sent)).toEqual({
      selection: { ids: [1], certificateChannel: channel }, type: 'MIXED', names: []
    });
    await expect(single).toBeHidden();
  }
});
