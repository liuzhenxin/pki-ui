import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

function harness() {
  const source = readFileSync(new URL('../src/views/ra/fawvw-ca-cert/index.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'index.vue', id: 'ca-ledger' }).errors).toEqual([]);
  const compiled = compileScript(descriptor, { id: 'ca-ledger' });
  const code = ts.transpileModule(compiled.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const downloaded: string[] = [];
  const messages: string[] = [];
  let blob = new Blob(['certificate'], { type: 'application/pkix-cert' });
  const entries = [
    { certificate: { id: 1, displayName: 'Root', certificateType: 'ROOT' }, linked: true },
    { certificate: { id: 2, displayName: 'Sub', certificateType: 'INTERMEDIATE' }, issuerId: 1, linked: true },
    { certificate: { id: 3, displayName: 'Sub2', certificateType: 'INTERMEDIATE' }, issuerId: 2, linked: true },
    { certificate: { id: 4, displayName: 'Broken', certificateType: 'INTERMEDIATE' }, linked: false, warning: '链路异常' }
  ];
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)(
    (name: string) => {
      if (name === 'vue') return { ...vue, onMounted: () => {} };
      if (name === 'file-saver') return { saveAs: (_blob: Blob, filename: string) => downloaded.push(filename) };
      if (name === 'element-plus') return { ElMessage: { error: (message: string) => messages.push(message) }, ElMessageBox: {} };
      if (name === '@/api/ra/fawvwCaCert')
        return {
          getFawvwCaChain: async () => ({ data: entries }),
          downloadFawvwCaCertificate: async () => blob
        };
      throw new Error(name);
    },
    module,
    module.exports
  );
  return {
    page: module.exports.default.setup({}, { expose: () => {} }),
    source,
    downloaded,
    messages,
    failDownload: () => {
      blob = new Blob([JSON.stringify({ msg: '链路不完整' })], { type: 'application/json' });
    }
  };
}

test('CA chain renders real issuer hierarchy and keeps broken entries visible', async () => {
  const h = harness();
  await h.page.openChain({ id: 1 });
  expect(h.page.chainRows.value.map((row: any) => row.id)).toEqual([1, 4]);
  expect(h.page.chainRows.value[0].children[0].children[0].id).toBe(3);
  expect(h.page.chainOpen.value).toBe(true);
  expect(h.source).toContain("row.sourceType === 'IMPORTED' && !row.sourceRootId");
});

test('CA downloads use CER/P7B names and never save JSON failures as certificates', async () => {
  const h = harness();
  await h.page.downloadCertificate({ id: 1 }, 'cer');
  await h.page.downloadCertificate({ id: 2 }, 'p7b');
  expect(h.downloaded).toEqual(['ca-1.cer', 'ca-2.p7b']);
  h.failDownload();
  await h.page.downloadCertificate({ id: 1 }, 'p7b');
  expect(h.downloaded).toHaveLength(2);
  expect(h.messages).toEqual(['链路不完整']);
});
