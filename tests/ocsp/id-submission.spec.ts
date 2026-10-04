import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { normalizeOcspCaId, normalizeOptionalOcspId } from '../../src/utils/ocspIdentifier';
import { signerPolicyLabel } from '../../src/utils/ocspSignerPolicy';
import * as presentation from '../../src/utils/ocspPresentation';

// Execute each real SFC submission handler with API calls replaced; no initialization occurs.
const loadSetup = (file: string, api: Record<string, unknown>) => {
  const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
  const script = compileScript(parse(source).descriptor, { id: 'id-submission' }).content;
  const code = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  const requireMock = (name: string) => {
    if (name === 'vue') return { ...vue, onMounted: () => {}, onBeforeUnmount: () => {}, watch: () => {} };
    if (name === '@/plugins/auth') return { default: { hasPermi: () => true } };
    if (name === '@/utils/ocspSignerPolicy') return { signerPolicyLabel };
    if (name === '@/utils/ocspPresentation') return presentation;
    if (name === 'vue-router') return { useRouter: () => ({}), useRoute: () => ({ query: {} }) };
    if (name === 'element-plus') return { ElMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } };
    if (name === '@/utils/ocspIdentifier') return { normalizeOcspCaId, normalizeOptionalOcspId };
    if (name === '@/api/ocsp/common') return { assertSafeSignerCert: () => {}, assertSafeSignerConf: () => {} };
    if (name === '@/store/modules/user') return { useUserStore: () => ({ setTenantInitStatus: vi.fn() }) };
    if (name.startsWith('@/api/ocsp/')) return api;
    return { default: {} };
  };
  new Function('require', 'exports', code)(requireMock, exports);
  return exports.default.setup({ id: 1 }, { expose: () => {}, emit: () => {} });
};

const largeId = '99183839863111681';
describe('real signer diagnostic handler', () => {
  it('clears stale verdict on failure and displays the subsequent explicit result', async () => {
    const diagnoseOcspResponderSigner = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ signerPolicyOk: true });
    const page = loadSetup('views/ocsp/components/ResponderDetail.vue', { diagnoseOcspResponderSigner });
    page.responder.value = { id: 1, signerPolicyOk: false, signerRejectionCode: 'EXPIRED' };
    await page.checkSigner();
    expect(page.signerCheckError.value).toBe(true);
    expect(page.responder.value.signerPolicyOk).toBeNull();
    expect(page.responder.value.signerRejectionCode).toBeUndefined();
    await page.checkSigner();
    expect(page.signerCheckError.value).toBe(false);
    expect(page.responder.value.signerPolicyOk).toBe(true);
    expect(diagnoseOcspResponderSigner).toHaveBeenCalledWith(1);
  });
});
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

describe('OCSP loading failures and recovery', () => {
  it('distinguishes log request failure from a successful empty result', async () => {
    const pageOcspRequestLogs = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ records: [], total: 0 });
    const page = loadSetup('views/ocsp/log/index.vue', { pageOcspRequestLogs });
    await page.getList();
    expect(page.loadError.value).toBe(true);
    expect(page.loading.value).toBe(false);
    await page.getList();
    expect(page.loadError.value).toBe(false);
    expect(page.rows.value).toEqual([]);
  });
  it('does not display zero monitoring counts or no-alert success when reads fail', async () => {
    const getOcspMonitoringSummary = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ openAlertCount: 0 });
    const listOcspAlerts = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([]);
    const page = loadSetup('views/ocsp/components/MonitoringPanel.vue', { getOcspMonitoringSummary, listOcspAlerts });
    await page.load();
    expect(page.summaryError.value).toBe(true);
    expect(page.alertsError.value).toBe(true);
    expect(page.cards.value[0].value).toBe('-');
    await page.load();
    expect(page.summaryError.value).toBe(false);
    expect(page.alertsError.value).toBe(false);
    expect(page.cards.value[0].value).toBe(0);
  });
  it('distinguishes a failed status query from a real UNKNOWN certificate result', async () => {
    const queryOcspCertStatus = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ status: 'UNKNOWN' });
    const page = loadSetup('views/ocsp/status/index.vue', { queryOcspCertStatus });
    page.form.caId = largeId;
    page.form.serialNumber = 'abcdef';
    await page.queryStatus();
    expect(page.queryError.value).toBe(true);
    expect(page.result.value).toBeNull();
    await page.queryStatus();
    expect(page.queryError.value).toBe(false);
    expect(page.result.value.status).toBe('UNKNOWN');
  });
});
