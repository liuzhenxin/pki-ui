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
  for (const name of ['cert/index.vue', 'issue/index.vue', 'intranet-cert/index.vue']) {
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
