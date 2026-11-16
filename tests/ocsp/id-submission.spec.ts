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
    if (name === 'element-plus')
      return { ElMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn() }, ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) } };
    if (name === '@/utils/ocspIdentifier') return { normalizeOcspCaId, normalizeOptionalOcspId };
    if (name === '@/api/ocsp/common')
      return { assertSafeSignerCert: () => {}, assertSafeSignerConf: () => {}, unwrapOcspData: (value: unknown) => value };
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
  it('offers registered service CA IDs when creating a responder without defaulting to CA 1', async () => {
    const listServiceCaDrafts = vi.fn().mockResolvedValue([{ caId: largeId }, { caId: '42' }, { caId: largeId }]);
    const page = loadSetup('views/ocsp/responder/index.vue', { listServiceCaDrafts });
    await page.openEdit();
    expect(page.form.caId).toBe('');
    expect(page.caOptions.value).toEqual([largeId, '42']);
    expect(page.editVisible.value).toBe(true);
  });

  it('retains the existing CA for an older responder when editing', async () => {
    const listServiceCaDrafts = vi.fn().mockResolvedValue([]);
    const getOcspResponder = vi.fn().mockResolvedValue({ id: '7', caId: largeId, signerType: 'SOFTWARE' });
    const page = loadSetup('views/ocsp/responder/index.vue', { listServiceCaDrafts, getOcspResponder });
    await page.openEdit({ id: '7' });
    expect(page.form.caId).toBe(largeId);
    expect(page.caOptions.value).toContain(largeId);
  });
  it('loads service CA drafts without requesting legacy sources', async () => {
    const listServiceCaDrafts = vi.fn().mockResolvedValue([{ caId: largeId, version: 1 }]);
    const listOcspCaStatusSources = vi.fn();
    const page = loadSetup('views/ocsp/ca-source/index.vue', { listServiceCaDrafts, listOcspCaStatusSources });
    await page.refresh();
    expect(page.managedRows.value[0].caId).toBe(largeId);
    expect(listServiceCaDrafts).toHaveBeenCalledOnce();
    expect(listOcspCaStatusSources).not.toHaveBeenCalled();
    page.openWizard(largeId);
    expect(page.wizardCaId.value).toBe(largeId);
    expect(page.wizardVisible.value).toBe(true);
    const source = readFileSync(new URL('../../src/views/ocsp/ca-source/index.vue', import.meta.url), 'utf8');
    expect(source).not.toContain('旧数据源');
  });
  it('finds service CAs by certificate subject and full ID and keeps the enabled version visible', async () => {
    const certificate = vi.spyOn(presentation, 'summarizeOcspCertificate');
    certificate.mockReturnValueOnce({ state: '有效期内', subject: '/CN=测试签发 CA', issuer: '-', serial: '-', algorithm: '-', validity: '-' });
    try {
      const rows = [
        { caId: largeId, version: 3, publishedVersion: 2 },
        { caId: '42', version: 1 },
        { caId: '43', version: 5, verifiedVersion: '5', publishedVersion: 4 },
        { caId: '44', version: 6, publishedVersion: '6' }
      ];
      const page = loadSetup('views/ocsp/ca-source/index.vue', { listServiceCaDrafts: vi.fn().mockResolvedValue(rows) });
      await page.refresh();
      page.caSearch.value = ' 测试签发 ca ';
      expect(page.filteredRows.value.map(({ caId }) => caId)).toEqual([largeId]);
      page.caSearch.value = largeId;
      expect(page.filteredRows.value[0].publishedVersion).toBe(2);
      expect(page.managedStatus(rows[0])).toBe('已启用，有未发布草稿');
      expect(rows.map(page.managedAction)).toEqual(['继续配置', '继续配置', '启用已验证草稿', '查看配置']);
      page.openWizard(largeId);
      expect(page.wizardCaId.value).toBe(largeId);
      page.caSearch.value = '找不到';
      expect(page.filteredRows.value).toEqual([]);
    } finally {
      certificate.mockRestore();
    }
  });

  it('clears stale service CA drafts when refresh fails', async () => {
    const listServiceCaDrafts = vi
      .fn()
      .mockResolvedValueOnce([{ caId: largeId, version: 1 }])
      .mockRejectedValueOnce(new Error('unavailable'));
    const page = loadSetup('views/ocsp/ca-source/index.vue', { listServiceCaDrafts });
    await page.refresh();
    expect(page.managedRows.value).toHaveLength(1);
    await page.refresh();
    expect(page.managedRows.value).toEqual([]);
    expect(page.managedError.value).toBe(true);
    expect(page.managedLoading.value).toBe(false);
  });
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

  it('completes system initialization only after both environment checks pass', async () => {
    const completeOcspInitialization = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ initialized: true });
    const page = loadSetup('views/ocsp/init/index.vue', { completeOcspInitialization });
    page.activeStep.value = 1;
    await page.complete();
    expect(completeOcspInitialization).not.toHaveBeenCalled();
    page.envRows.value = [
      { name: 'OCSP业务库', ok: true },
      { name: '平台租户', ok: true }
    ];
    await page.complete();
    expect(page.activeStep.value).toBe(1);
    await page.complete();
    expect(page.activeStep.value).toBe(2);
    expect(completeOcspInitialization).toHaveBeenCalledTimes(2);
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
  it('registers issuer certificates for the selected CA and rejects private keys and unsafe IDs', async () => {
    const listOcspIssuerCerts = vi.fn().mockResolvedValue([{ id: '9007199254740999', caId: largeId, hashAlgorithm: 'SHA1' }]);
    const saveOcspIssuerCert = vi.fn().mockResolvedValue([]);
    const removeOcspIssuerCert = vi.fn().mockResolvedValue(true);
    const page = loadSetup('views/ocsp/components/IssuerCertPanel.vue', { listOcspIssuerCerts, saveOcspIssuerCert, removeOcspIssuerCert });
    page.caId.value = largeId;
    await page.load();
    expect(listOcspIssuerCerts).toHaveBeenCalledWith(largeId);
    page.certificatePem.value = '-----BEGIN PRIVATE KEY-----';
    await page.enroll();
    expect(saveOcspIssuerCert).not.toHaveBeenCalled();
    page.certificatePem.value = '-----BEGIN CERTIFICATE-----\npublic\n-----END CERTIFICATE-----';
    await page.enroll();
    expect(saveOcspIssuerCert).toHaveBeenCalledWith(largeId, expect.stringContaining('BEGIN CERTIFICATE'));
    await page.remove({ id: 9007199254740992, caId: largeId, hashAlgorithm: 'SHA1' });
    expect(removeOcspIssuerCert).not.toHaveBeenCalled();
    await page.remove({ id: '9007199254740999', caId: largeId, hashAlgorithm: 'SHA1' });
    expect(removeOcspIssuerCert).toHaveBeenCalledWith('9007199254740999');
  });
  it('clears issuer records on CA change and does not show old results after a failed read', async () => {
    const listOcspIssuerCerts = vi
      .fn()
      .mockResolvedValueOnce([{ id: '1', caId: largeId }])
      .mockRejectedValueOnce(new Error('unavailable'));
    const page = loadSetup('views/ocsp/components/IssuerCertPanel.vue', { listOcspIssuerCerts });
    page.caId.value = largeId;
    await page.load();
    expect(page.rows.value).toHaveLength(1);
    page.caId.value = '42';
    page.clearResults();
    expect(page.queriedCaId.value).toBe('');
    expect(page.rows.value).toEqual([]);
    await page.load();
    expect(page.loadError.value).toBe(true);
    expect(page.queriedCaId.value).toBe('');
  });
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
  it('loads named issuing CA options, deduplicates IDs and submits the selected ID intact', async () => {
    const listServiceCaDrafts = vi.fn().mockResolvedValue([{ caId: largeId }]);
    const listOcspCaStatusSources = vi.fn().mockResolvedValue([{ caId: largeId }, { caId: Number(largeId) }]);
    const pageOcspResponders = vi.fn().mockResolvedValue({ records: [{ caId: largeId }], total: 1 });
    const listOcspIssuerCerts = vi.fn().mockResolvedValue([{ subjectDn: 'CN=签发 CA', enabled: true }]);
    const queryOcspCertStatus = vi.fn().mockResolvedValue({ status: 'GOOD' });
    const page = loadSetup('views/ocsp/status/index.vue', {
      listServiceCaDrafts,
      listOcspCaStatusSources,
      pageOcspResponders,
      listOcspIssuerCerts,
      queryOcspCertStatus
    });
    expect(page.form.caId).toBe('');
    await page.loadCaOptions();
    expect(listOcspIssuerCerts).toHaveBeenCalledExactlyOnceWith(largeId);
    expect(page.caOptions.value).toEqual([{ id: largeId, label: `CN=签发 CA · ${largeId}` }]);
    const source = readFileSync(new URL('../../src/views/ocsp/status/index.vue', import.meta.url), 'utf8');
    expect(source).toMatch(/<el-select[\s\S]*?filterable/);
    expect(source).toContain(':label="ca.label"');
    page.form.caId = largeId;
    page.form.serialNumber = ' ab ';
    await page.queryStatus();
    expect(queryOcspCertStatus).toHaveBeenCalledWith({ caId: largeId, serialNumber: 'ab', bypassCache: false });
  });

  it('keeps manual lookup available if CA lists fail and requires an explicit ID', async () => {
    const unavailable = vi.fn().mockRejectedValue(new Error('unavailable'));
    const queryOcspCertStatus = vi.fn().mockResolvedValue({ status: 'UNKNOWN' });
    const page = loadSetup('views/ocsp/status/index.vue', {
      listServiceCaDrafts: unavailable,
      listOcspCaStatusSources: unavailable,
      pageOcspResponders: unavailable,
      queryOcspCertStatus
    });
    await page.loadCaOptions();
    expect(page.caLoadError.value).toBe(true);
    page.form.serialNumber = 'ab';
    await page.queryStatus();
    expect(queryOcspCertStatus).not.toHaveBeenCalled();
    page.toggleManualEntry();
    expect(page.manualEntry.value).toBe(true);
    page.form.caId = '9223372036854775807';
    await page.queryStatus();
    expect(queryOcspCertStatus).toHaveBeenCalledWith({ caId: '9223372036854775807', serialNumber: 'ab', bypassCache: false });
    page.toggleManualEntry();
    expect(page.form.caId).toBe('');
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
