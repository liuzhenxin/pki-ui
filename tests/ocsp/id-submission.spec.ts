import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { normalizeOcspCaId, normalizeOptionalOcspId } from '../../src/utils/ocspIdentifier';

// Execute each real SFC submission handler with API calls replaced; no initialization occurs.
const loadSetup = (file: string, api: Record<string, unknown>) => {
  const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
  const script = compileScript(parse(source).descriptor, { id: 'id-submission' }).content;
  const code = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  const requireMock = (name: string) => {
    if (name === 'vue') return { ...vue, onMounted: () => {} };
    if (name === 'vue-router') return { useRouter: () => ({}) };
    if (name === 'element-plus') return { ElMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } };
    if (name === '@/utils/ocspIdentifier') return { normalizeOcspCaId, normalizeOptionalOcspId };
    if (name === '@/api/ocsp/common') return { assertSafeSignerCert: () => {}, assertSafeSignerConf: () => {} };
    if (name === '@/store/modules/user') return { useUserStore: () => ({ setTenantInitStatus: vi.fn() }) };
    if (name.startsWith('@/api/ocsp/')) return api;
    return { default: {} };
  };
  new Function('require', 'exports', code)(requireMock, exports);
  return exports.default.setup({}, { expose: () => {} });
};

const largeId = '99183839863111681';
describe('real OCSP ID submission handlers', () => {
  it('keeps log CA/responder IDs as text and omits cleared filters', async () => {
    const pageOcspRequestLogs = vi.fn().mockResolvedValue({ records: [], total: 0 });
    const page = loadSetup('views/ocsp/log/index.vue', { pageOcspRequestLogs });
    page.query.caId = largeId;
    page.query.responderId = '9223372036854775807';
    await page.getList();
    expect(pageOcspRequestLogs.mock.calls[0][0]).toMatchObject({ caId: largeId, responderId: '9223372036854775807' });
    page.query.caId = '';
    page.query.responderId = '  ';
    await page.getList();
    const serialized = JSON.parse(JSON.stringify(pageOcspRequestLogs.mock.calls[1][0]));
    expect(serialized).not.toHaveProperty('caId');
    expect(serialized).not.toHaveProperty('responderId');
    page.query.caId = '9223372036854775808';
    await page.getList();
    expect(pageOcspRequestLogs).toHaveBeenCalledTimes(2);
  });

  it('submits the full initialization CA ID and blocks invalid IDs', async () => {
    const initOcspResponder = vi.fn().mockResolvedValue({});
    const page = loadSetup('views/ocsp/init/index.vue', { initOcspResponder });
    page.formRef.value = { validate: vi.fn().mockResolvedValue(true) };
    page.form.signerCert = 'public certificate placeholder';
    page.form.caId = largeId;
    await page.submitInit();
    expect(initOcspResponder.mock.calls[0][0].caId).toBe(largeId);
    page.form.caId = '0';
    await page.submitInit();
    expect(initOcspResponder).toHaveBeenCalledTimes(1);
  });

  it('previews the full routing CA ID and blocks overflowing IDs', async () => {
    const previewOcspRouting = vi.fn().mockResolvedValue({});
    const page = loadSetup('views/ocsp/components/RoutingHistoryPanel.vue', {
      previewOcspRouting,
      pageOcspConfigHistory: vi.fn().mockResolvedValue({ records: [], total: 0 })
    });
    page.previewForm.caId = largeId;
    await page.preview();
    expect(previewOcspRouting.mock.calls[0][0].caId).toBe(largeId);
    page.previewForm.caId = '9223372036854775808';
    await page.preview();
    expect(previewOcspRouting).toHaveBeenCalledTimes(1);
  });
});
