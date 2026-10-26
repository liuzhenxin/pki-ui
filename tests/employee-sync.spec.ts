import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

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
  const api = new Proxy(
    {
      syncFawvwEmployees: async () => {
        submissions++;
        return { data: { status: 'RUNNING', taskNo: 'EMP-test' } };
      },
      getFawvwSyncTask: async () => {
        if (result instanceof Error) throw result;
        return { data: result };
      }
    },
    { get: (target, key) => target[key as keyof typeof target] || (async () => ({ data: {} })) }
  );
  const message = Object.fromEntries(['success', 'warning', 'error', 'info'].map((type) => [type, (text: string) => messages.push({ type, text })]));
  const module = { exports: {} as any };
  const requireMock = (name: string) => {
    if (name === 'vue') return { ...vue, onMounted: () => {}, onUnmounted: (callback: () => void) => (unmount = callback) };
    if (name === 'element-plus') return { ElMessage: message };
    if (name === '@/api/ra/employee') return api;
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

test('employee synchronization follows the background task and blocks duplicate clicks', async () => {
  const page = pageHarness();
  await page.bindings.handleSync();
  expect(page.bindings.syncing.value).toBe(true);
  await page.bindings.handleSync();
  expect(page.submissions()).toBe(1);
  expect(page.messages.some((m) => m.type === 'success')).toBe(false);
  page.setResult({ status: 'SUCCESS', taskNo: 'EMP-test', totalEmployees: 35060 });
  await page.poll();
  expect(page.bindings.syncing.value).toBe(false);
  expect(page.messages.some((m) => m.type === 'success' && m.text.includes('35060'))).toBe(true);
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
  page.setResult({ status: 'SUCCESS', errorMessage: 'Departure marking skipped' });
  await page.poll();
  expect(page.messages.some((m) => m.type === 'warning' && m.text === 'Departure marking skipped')).toBe(true);
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
