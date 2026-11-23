import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, compileScript, compileStyle, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { employeeCertLedgerPath } from '../src/utils/fawvwEmployeeNavigation';
import * as certificateSubject from '../src/utils/raCertificateSubject';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

const submittedBatchNo = '11111111-1111-4111-8111-111111111111';
const mixedBatchNo = '22222222-2222-4222-8222-222222222222';

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
      data: () => ({ managementTab: 'ledger', showSearch: true, queryParams: {}, certificateStatuses: [], ledgerProfiles: [], ledgerProfilesLoading: false }),
      methods: { handleQuery() {}, resetQuery() {}, switchManagementTab() {} }
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

function harness(overrides: Record<string, unknown> = {}, permissions?: string[], initialQuery: Record<string, string | undefined> = {},
  confirm: (message: string) => Promise<void> = async () => {}) {
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
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'setTimeout', 'clearTimeout', code)(
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
      if (name === '@/utils/raCertificateDownload') return { certificateDownloadBlob: async (blob: Blob) => blob };
      if (name === '@/plugins/auth') return { default: { hasPermi, hasPermiOr: (entries: string[]) => entries.some(hasPermi) } };
      if (name.endsWith('.vue')) return { default: {} };
      throw new Error(name);
    }, module, module.exports, message, { confirm },
    (callback: () => Promise<void>) => { timer = callback; return 1; }, () => (timer = undefined)
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
  const { page } = harness({ testEmployeeCertDistributionConfig: async (request: { send: boolean }) => {
    requests.push(request);
    if (!request.send && failProbe) throw new Error('unreachable');
    return { data: request.send ? 'ok' : '网关已响应（HTTP 405）' };
  } }, undefined, {}, (message) => new Promise<void>((resolve, reject) => {
    confirmations.push(message);
    confirmSend = resolve;
    cancelSend = reject;
  }));

  page.distributionConfigOpen.value = true;
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
    config: { emailAccount: 'cybersec@faw-vw.com', smtpServer: 'CC', dingtalkApp: 'fawvw' }
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
  h.page.distribute(first);
  h.page.selectedRows.value = [first];
  h.page.distributeSelected();
  h.page.selectedRows.value = [first, second];
  h.page.distributeSelected();
  expect(selections).toEqual([
    { selection: { ids: [1], resend: false }, taskNo: 'EC-001' },
    { selection: { ids: [1] }, taskNo: 'EC-001' },
    { selection: { ids: [1, 2] }, taskNo: undefined }
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
    page.issueSelection.value = [{ id: 1 }];
    await page.distributeTask(task);
    expect(locations).toEqual([]);
    expect(opened).toEqual(expectedOpens ? [{ ids: ['1'] }] : []);
    expect(page.taskOpen.value).toBe(true);
  }
});

test('AD preview requires an entirely eligible selection and does not submit a distribution', () => {
  const h = harness({ distributeEmployeeCert: () => { throw new Error('AD preview must not send'); } });
  h.page.selectedRows.value = [{ id: 1, adUploadEligible: true }, { id: 2, adUploadEligible: false }];
  expect(h.page.adUploadSelectionReady.value).toBe(false);
  h.page.previewAdUpload();
  expect(h.messages).toHaveLength(0);
  h.page.selectedRows.value = [{ id: 1, adUploadEligible: true }];
  expect(h.page.adUploadSelectionReady.value).toBe(true);
  h.page.previewAdUpload();
  expect(h.messages).toEqual([expect.objectContaining({ type: 'info', text: expect.stringContaining('本次未上传') })]);
  h.stop();
});

test('distribution submission is tracked without claiming completed delivery', async () => {
  const h = harness();
  const selections: any[] = [];
  h.page.distributionDialog.value = { open: (selection: any) => selections.push(selection) };
  h.page.distribute({ id: 1, employeeName: 'Employee', distributionStatus: 'PENDING', issueStatus: 'ISSUED', raCertId: 1, certStatus: 'VALID' });
  expect(selections).toEqual([{ ids: [1], resend: false }]);
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

test('ledger reveals all current-page passwords and hides them on page changes', async () => {
  const ids = ['9007199254740993', '9007199254740994'];
  const requests: string[][] = [];
  const { page, stop } = harness({
    getEmployeeCertPasswords: async (selected: string[]) => {
      requests.push(selected);
      return { data: { [ids[0]]: 'fixture password', [ids[1]]: '' } };
    }
  });
  page.rows.value = ids.map(id => ({ id, certPassword: '******' }));
  expect(page.ledgerPasswords.value).toBeUndefined();
  await page.toggleLedgerPasswords();
  expect(requests).toEqual([ids]);
  expect(page.ledgerPasswords.value).toEqual({ [ids[0]]: 'fixture password', [ids[1]]: '' });
  expect(page.rows.value.map(row => row.certPassword)).toEqual(['******', '******']);
  page.queryParams.pageNum++;
  expect(page.ledgerPasswords.value).toBeUndefined();
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
  for (const certStatus of ['EXPIRED', 'EXPIRING', 'REVOKED', 'NOT_YET_VALID', 'UNKNOWN']) {
    const invalid = { ...row, certStatus };
    page.distribute(invalid);
    page.selectedRows.value = [invalid];
    page.distributeSelected();
  }
  expect(selections).toHaveLength(0);
  expect(page.certificateStatusLabel({ ...row, certStatus: 'EXPIRING', remainingDays: 0 })).toBe('剩余 0 天');
  page.selectedRows.value = [{ ...row, id: 2, certStatus: 'EXPIRED' }, { ...row, certStatus: 'VALID' }];
  page.distributeSelected();
  expect(selections).toHaveLength(0);
  page.selectedRows.value = [{ ...row, certStatus: 'VALID' }];
  page.distributeSelected();
  expect(selections).toEqual([{ ids: [1] }]);
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
  expect(source).toContain('distributionConfig.smtpServer');
  expect(source).not.toContain('v-model="distributionConfig.guideHtml"');
  expect(source).toContain('label="存量证书导入"');
  expect(source).toContain('label="证书台账"');
  expect(source).toContain('label="发送记录"');
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
  expect(taskActions).toContain('label="下载证书 ZIP"');
  expect(taskActions).toContain(`v-hasPermi="['ra:employee-cert:distribute']"`);
  expect(taskActions).toContain(':disabled="row.successCount <= 0 || Boolean(downloadingTask)"');
  expect(taskActions).toContain('@click="downloadTaskPackage(row)"');
  expect(taskSource).toContain('@click="issueSelectedCerts">签发</el-button>');
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
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'onMounted', 'watch', 'ref', 'reactive', 'computed', code)(
    (name: string) => {
      if (name === 'vue') return { ...vue, onUnmounted: () => {} };
      if (name === '@/hooks/useRaListRefreshOnReturn') return { useRaListRefreshOnReturn: () => {} };
      if (name === 'vue-router') return {
        useRoute: () => ({ query: {}, fullPath: '/', path: '/' }),
        useRouter: () => ({ push, resolve: () => ({ matched: routeRegistered ? [{ path: employeeCertLedgerPath }] : [{ path: '/:pathMatch(.*)*' }] }) })
      };
      if (name === '@/plugins/auth') return { default: { hasPermi: (permission: string) => permissions?.includes(permission) ?? true } };
      if (name === '@/utils/fawvwEmployeeNavigation') return { employeeCertLedgerPath };
      if (name === '@/utils/raCertificateSubject') return certificateSubject;
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

test('employee task requires explicit CA and template selection and resets it when CA changes', async () => {
  const rootA = '9007199254740993';
  const rootB = '9007199254740995';
  const profileId = '9007199254740997';
  const rsa = { rootId: rootA, rootName: 'CA A', profileId, profileName: 'Mail', enabled: true, maxValidityYears: 2, supportedRsaKeySizes: [2048, 4096] };
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
  expect(submissions).toEqual([{ employeeIds: ['1'], identityKeys: ['verified'], userIds: ['42'], rootId: rootB, profileId, validityYears: 2, rsaKeySize: 2048, productionChoices: [], pfxPasswordRule: null, remark: '' }]);
  expect(page.taskCaName(page.taskDetail.value.task.rootId)).toBe('CA B');

  profiles = [rsa, { ...alternate, enabled: false }];
  await page.loadEmailProfiles();
  expect(page.form.rootId).toBe('');
  expect(page.form.profileId).toBe('');
  expect(page.canCreateTask.value).toBe(false);
  expect(page.taskCaName(rootB)).toBe('CA B');
});

test('employee production keeps a selected original only for the matching CA, profile and key length', async () => {
  const profile = { rootId: '20', rootName: 'CA', profileId: '21', profileName: 'Mail', enabled: true,
    maxValidityYears: 2, supportedRsaKeySizes: [2048, 4096] };
  const employee = { id: '1', identityKey: 'verified' };
  const calls: unknown[] = [];
  const page = issueHarness({
    listEmployeeEmailCertProfiles: async () => ({ data: [profile] }),
    listEmployeeProductionCandidates: async (id: string, filters: Record<string, unknown>) => {
      calls.push({ id, ...filters });
      return { data: [{ id: '9007199254740997', serialNumber: '12' }] };
    }
  });
  await page.loadEmailProfiles();
  page.form.rootId = profile.rootId;
  page.form.profileId = profile.profileId;
  await page.openKeys(employee);
  expect(calls).toEqual([{ id: employee.id, rootId: '20', profileId: '21', rsaKeySize: 2048 }]);
  page.keyChoice.value = '9007199254740997';
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
        window.openDistribution=(nextType)=>{type=nextType;return dialog.value.open({ids:[1]},'测试任务');};
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
  await expect(dialog.getByText('guide.pdf')).toBeVisible();
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await expect(dialog.locator('input[type=file]')).toHaveCount(0);
  await dialog.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '确认发送' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sent)).toEqual({
    selection: { ids: [1] }, type: 'MIXED', names: []
  });
});
