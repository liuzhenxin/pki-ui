import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { normalizeOcspCaId, normalizeOptionalOcspId } from '../../src/utils/ocspIdentifier';
import { signerPolicyLabel } from '../../src/utils/ocspSignerPolicy';
import * as presentation from '../../src/utils/ocspPresentation';

// Execute each real SFC handler with API calls replaced; no initialization occurs.
const loadSetup = (
  file: string,
  api: Record<string, unknown>,
  props: Record<string, unknown> = { id: 1 },
  hasPermi: (permission: string) => boolean = () => true
) => {
  const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
  const script = compileScript(parse(source).descriptor, { id: 'id-submission' }).content;
  const code = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  const requireMock = (name: string) => {
    if (name === 'vue') return { ...vue, onMounted: () => {}, onBeforeUnmount: () => {}, onUnmounted: () => {}, watch: () => {} };
    if (name === '@/plugins/auth') return { default: { hasPermi } };
    if (name === '@/utils/ocspSignerPolicy') return { signerPolicyLabel };
    if (name === '@/utils/ocspPresentation') return presentation;
    if (name === 'vue-router') return { useRouter: () => ({}), useRoute: () => ({ query: {} }) };
    if (name === 'element-plus')
      return { ElMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn() }, ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) } };
    if (name === '@/utils/ocspIdentifier') return { normalizeOcspCaId, normalizeOptionalOcspId };
    if (name === '@/api/ocsp/common')
      return { assertSafeSignerCert: (value: string) => value, assertSafeSignerConf: () => {}, unwrapOcspData: (value: unknown) => value };
    if (name === '@/store/modules/user') return { useUserStore: () => ({ setTenantInitStatus: vi.fn() }) };
    if (name.startsWith('@/api/ocsp/')) return api;
    return { default: {} };
  };
  new Function('require', 'exports', code)(requireMock, exports);
  return exports.default.setup(props, { expose: () => {}, emit: () => {} });
};

const largeId = '99183839863111681';

describe('real OCSP dashboard loading', () => {
  const empty = {
    range: '24h',
    requestCount: 0,
    successCount: 0,
    unknownCount: 0,
    activeResponderCount: 1,
    series: [],
    statusPie: {},
    responders: []
  };

  it.each([0, '0'])('shows a zero request count (%s) without fabricating a success rate', async (requestCount) => {
    const page = loadSetup('views/ocsp/dashboard/index.vue', {
      getOcspDashboardSummary: vi.fn().mockResolvedValue({ ...empty, requestCount })
    });
    expect(page.statCards.value.map(({ value }) => value)).toEqual(['—', '—', '—', '—']);
    await page.loadSummary();
    expect(page.statCards.value.map(({ value }) => value)).toEqual([requestCount, '—', 0, 1]);
    expect(page.statCards.value[1].unit).toBeUndefined();
    expect(page.hasTrend.value).toBe(false);
    expect(page.hasStatusBreakdown.value).toBe(false);
    expect(page.loadError.value).toBe(false);
  });

  it('clears stale statistics on failure and shows fresh data after retry', async () => {
    const ready = { ...empty, requestCount: 4, successCount: 3, unknownCount: 1, statusPie: { GOOD: 2, UNKNOWN: 1 } };
    const getOcspDashboardSummary = vi.fn().mockResolvedValueOnce(ready).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(empty);
    const page = loadSetup('views/ocsp/dashboard/index.vue', { getOcspDashboardSummary });
    await page.loadSummary();
    expect(page.successRatio.value).toBe(75);
    expect(page.hasStatusBreakdown.value).toBe(true);
    page.range.value = '1h';
    await page.loadSummary();
    expect(page.loadError.value).toBe(true);
    expect(page.loading.value).toBe(false);
    expect(page.summary.value).toBeUndefined();
    expect(page.hasStatusBreakdown.value).toBe(false);
    await page.loadSummary();
    expect(page.loadError.value).toBe(false);
    expect(page.summary.value.requestCount).toBe(0);
    expect(getOcspDashboardSummary).toHaveBeenLastCalledWith('1h');
  });

  it('keeps results from the latest window when an older request resolves later', async () => {
    let finishOlder!: (data: typeof empty) => void;
    const older = new Promise<typeof empty>((resolve) => {
      finishOlder = resolve;
    });
    const getOcspDashboardSummary = vi
      .fn()
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce({ ...empty, range: '7d', requestCount: 10 });
    const page = loadSetup('views/ocsp/dashboard/index.vue', { getOcspDashboardSummary });
    const firstLoad = page.loadSummary();
    page.range.value = '7d';
    await page.loadSummary();
    finishOlder(empty);
    await firstLoad;
    expect(page.summary.value).toMatchObject({ range: '7d', requestCount: 10 });
    expect(page.loading.value).toBe(false);
  });
});

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
  it('generates and imports signing material without a CA or responder ID', async () => {
    const generateOcspResponderCsr = vi.fn().mockResolvedValue({ csrPending: true, csrPem: 'certificate request' });
    const importOcspResponderCertificate = vi.fn().mockResolvedValue({ signerCert: 'public certificate' });
    const panel = loadSetup(
      'views/ocsp/components/ResponderCsrPanel.vue',
      { generateOcspResponderCsr, importOcspResponderCertificate },
      { name: 'prepared', signerType: 'SOFTWARE', certSource: 'CSR', unassignedOnly: true }
    );
    await panel.generateCsr();
    expect(generateOcspResponderCsr.mock.calls[0][0]).toMatchObject({ name: 'prepared', unassignedOnly: true });
    expect(generateOcspResponderCsr.mock.calls[0][0]).not.toHaveProperty('caId');
    panel.issuedPem.value = 'public certificate';
    await panel.importCertificate();
    expect(importOcspResponderCertificate).toHaveBeenCalledExactlyOnceWith({
      name: 'prepared',
      certificatePem: 'public certificate',
      certificateChainPem: undefined,
      unassignedOnly: true
    });
  });

  it('opens the standalone material drawer without loading service CAs', async () => {
    const listServiceCaDrafts = vi.fn();
    const listUnassignedOcspSignerMaterials = vi.fn().mockResolvedValue([{ name: 'prepared', status: 'PENDING' }]);
    const page = loadSetup('views/ocsp/responder/index.vue', { listServiceCaDrafts, listUnassignedOcspSignerMaterials });
    await page.loadSigningMaterials();
    page.openSigningMaterial('prepared');
    expect(page.materialVisible.value).toBe(true);
    expect(page.materialName.value).toBe('prepared');
    expect(page.materialNameLocked.value).toBe(true);
    expect(listServiceCaDrafts).not.toHaveBeenCalled();
  });

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
        { caId: largeId, version: 3, publishedVersion: 2, sourceConfigured: true, sampleConfigured: true, responderId: '9223372036854775807' },
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
      expect(rows.map(page.draftState)).toEqual(['validate', 'configure', 'publish', 'published']);
      expect(rows.map(page.managedAction)).toEqual(['验证草稿', '继续配置', '启用已验证草稿', '查看配置']);
      page.caSearch.value = '9223372036854775807';
      page.progressFilter.value = 'validate';
      expect(page.filteredRows.value.map(({ caId }) => caId)).toEqual([largeId]);
      page.progressFilter.value = 'publish';
      expect(page.filteredRows.value).toEqual([]);
      page.caSearch.value = '';
      expect(page.filteredRows.value.map(({ caId }) => caId)).toEqual(['43']);
      page.openWizard(largeId);
      expect(page.wizardCaId.value).toBe(largeId);
      page.caSearch.value = '找不到';
      expect(page.filteredRows.value).toEqual([]);
    } finally {
      certificate.mockRestore();
    }
  });

  it('offers viewing a draft when the operator cannot validate or publish it', () => {
    const page = loadSetup('views/ocsp/ca-source/index.vue', {}, { id: 1 }, (permission) => permission === 'ocsp:source:save');
    const ready = { caId: largeId, version: 2, publishedVersion: 1, sourceConfigured: true, sampleConfigured: true };
    expect(page.managedAction(ready)).toBe('查看草稿');
    expect(page.managedAction({ ...ready, verifiedVersion: 2 })).toBe('查看草稿');
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
  it('keeps the current alert tab when an older alert request resolves later', async () => {
    let finishOpen!: (alerts: { code: string }[]) => void;
    const older = new Promise<{ code: string }[]>((resolve) => {
      finishOpen = resolve;
    });
    const getOcspMonitoringSummary = vi.fn().mockResolvedValue({ openAlertCount: 1 });
    const listOcspAlerts = vi
      .fn()
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce([{ code: 'RESOLVED_ALERT' }]);
    const page = loadSetup('views/ocsp/components/MonitoringPanel.vue', { getOcspMonitoringSummary, listOcspAlerts });
    const openLoad = page.load();
    page.tab.value = 'history';
    await page.load();
    finishOpen([{ code: 'OPEN_ALERT' }]);
    await openLoad;
    expect(listOcspAlerts.mock.calls).toEqual([[false], [true]]);
    expect(page.alerts.value).toEqual([{ code: 'RESOLVED_ALERT' }]);
  });
  it('reports a failed source check separately from the status of reading monitoring data', async () => {
    const getOcspMonitoringSummary = vi.fn().mockResolvedValue({ openAlertCount: 2 });
    const listOcspAlerts = vi.fn().mockResolvedValue([]);
    const runOcspMonitoring = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({});
    const page = loadSetup('views/ocsp/components/MonitoringPanel.vue', { getOcspMonitoringSummary, listOcspAlerts, runOcspMonitoring });
    await page.load();
    const sourceCheck = page.run(page.actions[0]);
    expect(page.running.value).toBe('source-health');
    await page.run(page.actions[1]);
    expect(runOcspMonitoring).toHaveBeenCalledExactlyOnceWith('source-health');
    await sourceCheck;
    expect(page.checkError.value).toContain('检查来源失败');
    expect(page.summaryError.value).toBe(false);
    expect(page.cards.value[0].value).toBe(2);
    await page.run(page.actions[0]);
    expect(page.checkError.value).toBe('');
    expect(page.running.value).toBeUndefined();
    expect(getOcspMonitoringSummary).toHaveBeenCalledTimes(2);
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
    page.form.serialNumber = 'deff';
    await page.retryQuery();
    expect(queryOcspCertStatus).toHaveBeenLastCalledWith({ caId: largeId, serialNumber: 'abcdef', bypassCache: false });
    expect(page.queryError.value).toBe(false);
    expect(page.result.value.status).toBe('UNKNOWN');
  });

  it('requeries the displayed certificate directly at its source when bypassing cache', async () => {
    const queryOcspCertStatus = vi.fn().mockResolvedValue({ status: 'GOOD', sourceType: 'DB', cacheHit: true });
    const page = loadSetup('views/ocsp/status/index.vue', { queryOcspCertStatus });
    page.form.caId = largeId;
    page.form.serialNumber = ' ab ';
    await page.queryStatus();
    expect(page.lastQuery.value.bypassCache).toBe(false);
    expect(page.sourceLabel(page.result.value.sourceType)).toBe('数据库 (DB)');
    page.form.caId = '42';
    page.form.serialNumber = 'ff';
    await page.retryWithoutCache();
    const params = { caId: largeId, serialNumber: 'ab', bypassCache: true };
    expect(queryOcspCertStatus).toHaveBeenLastCalledWith(params);
    expect(page.lastQuery.value).toEqual(params);
    expect(page.form).toEqual(params);
    const source = readFileSync(new URL('../../src/views/ocsp/status/index.vue', import.meta.url), 'utf8');
    expect(source).not.toContain('result.cacheHit');
  });
});
