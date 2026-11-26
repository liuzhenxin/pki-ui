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
  const queries: Record<string, unknown>[] = [];
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
      if (name === 'vue') return { ...vue, onMounted: () => {}, onActivated: () => {} };
      if (name === '@/api/ra/businessNoticeSettings' || name === '@/utils/businessCertificateNotice') return {};
      if (name === '@/utils/raCertificateSubject') return { formatCertificateSubject: (value: string) => value };
      if (name === '../components/CertRowAction.vue' || name === '../components/BusinessNoticeSettingsDialog.vue') return { default: {} };
      if (name === '@/hooks/useRaListRefreshOnReturn') return { useRaListRefreshOnReturn: () => {} };
      if (name === 'file-saver') return { saveAs: (_blob: Blob, filename: string) => downloaded.push(filename) };
      if (name === 'element-plus') return { ElMessage: { error: (message: string) => messages.push(message) }, ElMessageBox: {} };
      if (name === '@/api/ra/fawvwCaCert')
        return {
          getFawvwCaChain: async () => ({ data: entries }),
          pageFawvwCaCertificateTree: async (query: Record<string, unknown>) => {
            queries.push(query);
            return { data: { records: [entries], total: 1 } };
          },
          getFawvwCaCertificateDetail: async (id: number) => ({
            data: { certificate: { id }, version: 3, signatureAlgorithm: 'SHA256withRSA', keyUsages: ['证书签名'] }
          }),
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
    queries,
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
});

test('only entirely manual CA chains can be removed', () => {
  const { page } = harness();
  const historical = { sourceType: 'RA_SYNC', sourceActive: false, certificateType: 'ROOT', children: [] };
  expect(page.canRemoveCertificate(historical)).toBe(false);
  expect(page.canRemoveCertificate({ ...historical, sourceActive: true })).toBe(false);
  const imported = { sourceType: 'IMPORTED', certificateType: 'ROOT', children: [] };
  expect(page.canRemoveCertificate(imported)).toBe(true);
  expect(page.canRemoveCertificate({ ...imported, children: [historical] })).toBe(false);
  expect(page.canRemoveCertificate({ ...imported, sourceRootId: '1' })).toBe(false);
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

test('CA main list loads whole families as an expanded tree by default', async () => {
  const h = harness();
  const expanded: number[] = [];
  h.page.treeTable.value = {
    toggleRowExpansion: (row: any, open: boolean) => {
      if (open) expanded.push(row.id);
    }
  };
  await h.page.loadList();
  expect(h.page.rows.value[0].children[0].children[0].id).toBe(3);
  expect(h.page.rows.value[1].id).toBe(4);
  expect(h.page.total.value).toBe(1);
  expect(expanded).toEqual([1, 2]);
  expanded.length = 0;
  await h.page.expandTree();
  expect(expanded).toEqual([1, 2]);
  const mainTable = h.source.match(/<el-table\s[^>]*>/)?.[0] || '';
  expect(mainTable).toContain('row-key="id"');
  expect(mainTable).toContain('default-expand-all');
});

test('CA filters send issuer, source and expiry dates and reset to the first page', async () => {
  const h = harness();
  Object.assign(h.page.queryParams, { pageNum: 3, issuer: 'CA1', sourceType: 'IMPORTED' });
  h.page.expiryRange.value = ['2030-05-06', '2030-06-01'];
  await h.page.loadList();
  expect(h.queries.at(-1)).toMatchObject({
    pageNum: 3,
    issuer: 'CA1',
    sourceType: 'IMPORTED',
    expiresFrom: '2030-05-06',
    expiresTo: '2030-06-01'
  });
  h.page.resetQuery();
  expect(h.queries.at(-1)).toMatchObject({ pageNum: 1, issuer: '', sourceType: '', expiresFrom: undefined, expiresTo: undefined });
});

test('CA details display parsed metadata and the selected node chain state', async () => {
  const h = harness();
  await h.page.openDetail({ id: 2, linked: false, warning: '证书链不完整' });
  expect(h.page.detailOpen.value).toBe(true);
  expect(h.page.detail.value).toMatchObject({ certificate: { id: 2 }, signatureAlgorithm: 'SHA256withRSA', keyUsages: ['证书签名'] });
  expect(h.page.detailChain.value).toEqual({ linked: false, warning: '证书链不完整' });
});
