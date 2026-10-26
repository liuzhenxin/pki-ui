import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

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
  const api = new Proxy({
    distributeEmployeeCert: async () => ({ data: { distributionStatus: 'SENDING' } }),
    pageEmployeeCerts: async (query: any) => ({ data: { total: query.distributionStatus === 'SENDING' && status !== 'SENDING' ? 0 : 1,
      records: [{ id: 1, issueStatus: 'ISSUED', distributionStatus: status }] } })
  }, { get: (target, name) => target[name as keyof typeof target] || (async () => ({ data: {} })) });
  const module = { exports: {} as any };
  const message = Object.fromEntries(['success', 'warning', 'error', 'info'].map((type) => [type, (text: string) => messages.push({ type, text })]));
  new Function('require', 'module', 'exports', 'ElMessage', 'ElMessageBox', 'setTimeout', 'clearTimeout', code)(
    (name: string) => {
      if (name === 'vue') return { ...vue, onMounted: () => {}, onUnmounted: (callback: () => void) => (unmount = callback) };
      if (name === 'file-saver') return { default: { saveAs: () => {} } };
      if (name === '@/api/ra/employeeCert') return api;
      throw new Error(name);
    }, module, module.exports, message, { confirm: async () => {} },
    (callback: () => Promise<void>) => { timer = callback; return 1; }, () => (timer = undefined)
  );
  return { page: module.exports.default.setup({}, { expose: () => {} }), messages,
    finish: () => (status = 'SENT'), poll: () => timer!(), stop: () => unmount!(), pending: () => timer };
}

test('distribution submission is tracked without claiming completed delivery', async () => {
  const h = harness();
  await h.page.distribute({ id: 1, employeeName: 'Employee', distributionStatus: 'PENDING' });
  expect(h.messages).toContainEqual({ type: 'info', text: '分发任务已提交' });
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
  expect(source).toContain('distributionConfig.guideHtml');
  const taskSource = readFileSync(new URL('../src/views/ra/employee-cert/issue.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(taskSource);
  expect(errors).toEqual([]);
  compileScript(descriptor, { id: 'distribution-task' });
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'issue.vue', id: 'distribution-task' }).errors).toEqual([]);
  expect(taskSource).toContain('distributeEmployeeCertTask');
  expect(taskSource).toContain('prop="issueMessage"');
  expect(taskSource).toContain('prop="distributionMessage"');
});
