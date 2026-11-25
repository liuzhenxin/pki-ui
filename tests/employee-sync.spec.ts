import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

test('synchronization records expose the old and new employee numbers', () => {
  const filename = 'employee/index.vue';
  const source = readFileSync(new URL('../src/views/ra/employee/index.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source, { filename });
  expect(errors).toEqual([]);
  const template = descriptor.template!.content;
  expect(compileTemplate({ source: template, id: 'employee-sync-number-changes', filename }).errors).toEqual([]);
  expect(template).toContain('@click="openNumberChanges(row.taskNo)"');
  expect(template).toContain('label="原工号" prop="previousEmployeeNo"');
  expect(template).toContain('label="新工号" prop="employeeNo"');
});

test('employee details order profile fields and keep AD history below certificates', () => {
  const source = readFileSync(new URL('../src/views/ra/employee/index.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const template = descriptor.template!.content;
  const profile = template.match(/name="profile">([\s\S]*?)<\/el-tab-pane>/)?.[1];
  const qualification = template.match(/name="qualification">([\s\S]*?)<\/el-tab-pane>/)?.[1];
  expect(profile).toMatch(/label="姓名"[^\n]*\n\s*<el-descriptions-item label="性别">\{\{ detail.genderName/);
  expect(profile).toMatch(/label="入职时间">\{\{ detail.enterTime[^\n]*\n\s*<el-descriptions-item label="生日"/);
  expect(profile).toContain('优先按工号匹配');
  expect(profile).toContain('label-width="9rem"');
  expect(qualification).toContain('label-width="9rem"');
  expect(qualification).toMatch(/名下证书[\s\S]*?<EmployeeCertificateInventory[\s\S]*?AD 上传记录[\s\S]*?<el-table/);
});

function pageHarness(initial: any = { status: 'RUNNING', taskNo: 'EMP-test' }) {
  const source = readFileSync(new URL('../src/views/ra/employee/index.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  const compiled = compileScript(descriptor, { id: 'employee-sync-test' });
  const code = ts.transpileModule(compiled.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const messages: Array<{ type: string; text: string }> = [];
  let result = initial;
  let submissions = 0;
  let timer: (() => Promise<void>) | undefined;
  let unmount: (() => void) | undefined;
  const exportQueries: unknown[] = [];
  const downloadedFiles: string[] = [];
  const api = new Proxy(
    {
      syncFawvwEmployees: async () => {
        submissions++;
        return { data: { status: 'RUNNING', taskNo: 'EMP-test' } };
      },
      getFawvwSyncTask: async () => {
        if (result instanceof Error) throw result;
        return { data: result };
      },
      exportEmployeeDirectory: async (query: unknown) => {
        exportQueries.push(query);
        return new Blob(['员工信息'], { type: 'text/csv' });
      }
    },
    { get: (target, key) => target[key as keyof typeof target] || (async () => ({ data: {} })) }
  );
  const message = Object.fromEntries(['success', 'warning', 'error', 'info'].map((type) => [type, (text: string) => messages.push({ type, text })]));
  const module = { exports: {} as any };
  const requireMock = (name: string) => {
    if (name === 'vue') return { ...vue, onMounted: () => {}, onUnmounted: (callback: () => void) => (unmount = callback) };
    if (name === 'vue-router') return { useRouter: () => ({}), useRoute: () => ({ path: '', query: {} }) };
    if (name === '@/hooks/useRaListRefreshOnReturn') return { useRaListRefreshOnReturn: () => {} };
    if (name === 'element-plus') return { ElMessage: message };
    if (name === '@/api/ra/employee') return api;
    if (name === 'file-saver') return { default: { saveAs: (_blob: Blob, filename: string) => downloadedFiles.push(filename) } };
    if (name === '@/utils/raCertificateDownload') return { certificateDownloadBlob: async (blob: Blob) => blob };
    if (name === '@/plugins/auth') return { default: { hasPermi: () => false } };
    if (name === '@/utils/fawvwEmployeeNavigation') return { directoryQueryId: () => undefined };
    if (
      name === '@/api/ra/dept' ||
      name === '@/api/ra/user' ||
      name === '@/api/ra/cert' ||
      name === '@/utils/raCertificateSubject' ||
      name === './LocalDirectoryDialogs.vue' ||
      name === './EmployeeCertificateInventory.vue' ||
      name === '@/utils/fawvwEmployeeStatus'
    ) {
      return {};
    }
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', code)(
    requireMock,
    module,
    module.exports,
    (callback: () => Promise<void>) => {
      timer = callback;
      return 1;
    },
    () => (timer = undefined)
  );
  const bindings = module.exports.default.setup({}, { expose: () => {} });
  return {
    bindings,
    messages,
    exportQueries,
    downloadedFiles,
    submissions: () => submissions,
    setResult: (value: any) => (result = value),
    poll: async () => {
      expect(timer).toBeDefined();
      await timer!();
    },
    unmount: () => unmount!(),
    pendingPoll: () => timer
  };
}

test('employee pagination keeps the first two and last pages at narrow and wide widths', () => {
  const h = pageHarness();
  h.bindings.total.value = 1000;
  h.bindings.queryParams.pageSize = 10;
  for (const size of [5, 7]) {
    h.bindings.employeePagerCount.value = size;
    for (const page of [1, 2, 20, 99, 100]) {
      h.bindings.queryParams.pageNum = page;
      const items = h.bindings.employeePageItems.value;
      const pages = items.map((item: { page: number | null }) => item.page);
      expect(pages).toContain(1);
      expect(pages).toContain(2);
      expect(pages).toContain(100);
      expect(pages).toContain(page);
      expect(pages.filter((item: number | null) => item === null).length).toBeLessThanOrEqual(2);
    }
  }
  h.bindings.queryParams.pageNum = 1;
  h.bindings.changeEmployeePagination(2, 10);
  expect(h.bindings.queryParams.pageNum).toBe(2);
  h.bindings.changeEmployeePagination(100, 50);
  expect(h.bindings.queryParams.pageNum).toBe(1);
  expect(h.bindings.queryParams.pageSize).toBe(50);
  h.unmount();
});

test('employee information export uses the last applied directory filters', async () => {
  const page = pageHarness();
  Object.assign(page.bindings.queryParams, { keyword: '张三', source: 'API', status: 'A', foreignFlag: false, pageNum: 3 });
  page.bindings.selectedDirectoryNode.value = '321';
  await page.bindings.loadEmployees();
  await page.bindings.downloadEmployeeInfo();
  expect(page.exportQueries).toHaveLength(0);

  page.bindings.summary.exportAllowed = true;
  page.bindings.queryParams.keyword = '尚未执行的搜索';
  await page.bindings.downloadEmployeeInfo();
  expect(page.exportQueries).toEqual([expect.objectContaining({
    keyword: '张三', source: 'API', status: 'A', foreignFlag: false, departmentId: '321'
  })]);
  expect(page.downloadedFiles).toEqual(['员工信息.csv']);
});

test('the employee detail keeps an unmapped department blank while the directory exposes its grouping', () => {
  const { bindings, unmount } = pageHarness();
  const unmapped = { id: 1, recordSource: 'API', cnName: '张三', domainAccount: 'zhangsan' };
  expect(bindings.toEmployeeListRow({ employee: unmapped, applicant: { deptName: '其他' } }).departmentName).toBeUndefined();
  expect(bindings.toEmployeeListRow({
    employee: { ...unmapped, departmentId: 'ABC' },
    applicant: { deptName: '系统科室' }
  }).departmentName).toBe('系统科室');
  unmount();
});

test('the directory flags a misclassified local account for recovery in the existing account form', () => {
  const { bindings, unmount } = pageHarness();
  bindings.detail.value = bindings.toEmployeeListRow({
    employee: { id: 1, raUserId: 12, recordSource: 'API', sourceStatus: 'A', identityStatus: 'VALID' },
    applicant: { id: 12, status: 0 },
    localRecoveryRequired: true
  });
  expect(bindings.detail.value.localRecoveryRequired).toBe(true);
  expect(bindings.canStartBusiness.value).toBe(false);
  const directory = readFileSync(new URL('../src/views/ra/employee/index.vue', import.meta.url), 'utf8');
  expect(directory).not.toContain('value="LOCAL_RECOVERY"');
  expect(bindings.canViewLocalRecovery.value).toBe(false);
  bindings.summary.canViewLocalRecovery = true;
  bindings.summary.canRestoreLocalAccounts = false;
  expect(bindings.canViewLocalRecovery.value).toBe(true);
  expect(bindings.canRecoverLocalAccounts.value).toBe(false);
  bindings.summary.canRestoreLocalAccounts = true;
  expect(bindings.canRecoverLocalAccounts.value).toBe(true);
  expect(directory).toContain('openAccount(undefined, detail.raUserId, detail, true)');
  const filename = 'LocalDirectoryDialogs.vue';
  const account = readFileSync(new URL('../src/views/ra/employee/LocalDirectoryDialogs.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(account, { filename });
  expect(errors).toEqual([]);
  expect(compileTemplate({ source: descriptor.template!.content, id: 'local-account-recovery', filename }).errors).toEqual([]);
  expect(compileScript(descriptor, { id: 'local-account-recovery' }).content).toContain('restoreLocalOrigin: true');
  unmount();
});

test('employee synchronization follows the background task and blocks duplicate clicks', async () => {
  const page = pageHarness();
  await page.bindings.handleSync();
  expect(page.bindings.syncing.value).toBe(true);
  await page.bindings.handleSync();
  expect(page.submissions()).toBe(1);
  expect(page.messages.some((m) => m.type === 'success')).toBe(false);
  page.setResult({ status: 'SUCCESS', taskNo: 'EMP-test', totalEmployees: 35060, invalidCount: 1 });
  await page.poll();
  expect(page.bindings.syncing.value).toBe(false);
  expect(page.messages.some((m) => m.type === 'success' && m.text.includes('35060'))).toBe(true);
  expect(page.messages.some((m) => m.type === 'warning')).toBe(false);
});

test('failed tasks and polling failures are not reported as successful synchronization', async () => {
  const failed = pageHarness({ status: 'FAILED', errorMessage: 'Incomplete snapshot' });
  await failed.bindings.handleSync();
  expect(failed.messages.some((m) => m.type === 'error' && m.text === 'Incomplete snapshot')).toBe(true);
  const disconnected = pageHarness(new Error('network failure'));
  await disconnected.bindings.handleSync();
  expect(disconnected.messages.some((m) => m.type === 'warning')).toBe(true);
  expect(disconnected.messages.some((m) => m.type === 'success')).toBe(false);
});

test('warnings remain visible and polling stops when the page is unmounted', async () => {
  const page = pageHarness();
  await page.bindings.handleSync();
  const warning = '同步完成，1 条员工记录未写入或更新，请查看无效记录';
  page.setResult({ status: 'SUCCESS', invalidCount: 2, errorMessage: warning });
  await page.poll();
  expect(page.messages.some((m) => m.type === 'warning' && m.text === warning)).toBe(true);
  page.unmount();
  const pending = pageHarness();
  await pending.bindings.handleSync();
  const latePoll = pending.pendingPoll()!;
  pending.unmount();
  expect(pending.pendingPoll()).toBeUndefined();
  const count = pending.messages.length;
  pending.setResult({ status: 'SUCCESS' });
  await latePoll();
  expect(pending.messages.length).toBe(count);
});
