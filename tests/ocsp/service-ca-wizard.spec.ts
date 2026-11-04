import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { normalizeOcspCaId, normalizeOptionalOcspId } from '../../src/utils/ocspIdentifier';
import { unwrapNullableOcspData } from '../../src/api/ocsp/common';

const largeCaId = '9007199254740993';
const responderId = '9223372036854775807';
const issuerPem = '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----';
const draft = (version: number, extras: Record<string, unknown> = {}) => ({
  caId: largeCaId,
  version,
  issuerPem,
  sourceConfigured: version > 1,
  sampleConfigured: version > 1,
  ...extras
});

const setupWizard = (api: Record<string, unknown>) => {
  const path = new URL('../../src/views/ocsp/components/ServiceCaWizard.vue', import.meta.url);
  const script = compileScript(parse(readFileSync(path, 'utf8')).descriptor, { id: 'service-ca-wizard' }).content;
  const compiled = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  const requireMock = (name: string) => {
    if (name === 'vue') return { ...vue, watch: () => {} };
    if (name === 'element-plus') return { ElMessage: { error: vi.fn(), success: vi.fn(), info: vi.fn() } };
    if (name === '@/utils/ocspIdentifier') return { normalizeOcspCaId, normalizeOptionalOcspId };
    if (name === '@/api/ocsp/serviceCa') return api;
    return { default: {} };
  };
  new Function('require', 'exports', compiled)(requireMock, exports);
  return exports.default.setup({ modelValue: true }, { expose: () => {}, emit: () => {} });
};

describe('service CA onboarding', () => {
  it('treats a missing or null response payload as no draft', () => {
    expect(unwrapNullableOcspData({ code: 'OK', data: null })).toBeNull();
    expect(unwrapNullableOcspData({ code: 'OK' })).toBeNull();
    expect(unwrapNullableOcspData({ code: 'OK', data: { caId: largeCaId } })).toEqual({ caId: largeCaId });
  });
  it('saves issuer first, then source and sample, validates and publishes the exact version', async () => {
    const saveServiceCaDraft = vi.fn().mockResolvedValueOnce(draft(1)).mockResolvedValueOnce(draft(2, { responderId }));
    const validateServiceCaDraft = vi.fn().mockResolvedValue(draft(2, { responderId, verifiedVersion: 2 }));
    const publishServiceCaDraft = vi.fn().mockResolvedValue(draft(2, { responderId, verifiedVersion: 2, publishedVersion: 2 }));
    const wizard = setupWizard({ saveServiceCaDraft, validateServiceCaDraft, publishServiceCaDraft });
    wizard.form.caId = largeCaId;
    wizard.form.issuerPem = issuerPem;
    await wizard.saveCertificate();
    expect(wizard.step.value).toBe(1);
    expect(saveServiceCaDraft.mock.calls[0][0]).toEqual({ caId: undefined, expectedVersion: 0, issuerPem });
    expect(wizard.form.caId).toBe(largeCaId);
    wizard.form.sourceCaId = 'external-ca';
    wizard.form.responderId = responderId;
    Object.assign(wizard.form.db, { url: 'jdbc:mysql://example.invalid/ca', username: 'reader', passwordRef: 'fixture.ref' });
    wizard.form.sampleSerialHex = 'ab';
    await wizard.saveSource();
    expect(wizard.step.value).toBe(2);
    expect(saveServiceCaDraft.mock.calls[1][0]).toMatchObject({
      caId: largeCaId,
      responderId,
      expectedVersion: 1,
      sampleSerialHex: 'AB',
      expectedStatus: 'GOOD'
    });
    expect(saveServiceCaDraft.mock.calls[1][0].source.sourceCaId).toBe('external-ca');
    expect(saveServiceCaDraft.mock.calls[1][0].source.ldap).toBeUndefined();
    await wizard.validate();
    expect(validateServiceCaDraft).toHaveBeenCalledWith(largeCaId, 2);
    expect(wizard.step.value).toBe(3);
    await wizard.publish();
    expect(publishServiceCaDraft).toHaveBeenCalledWith(largeCaId, 2);
    expect(wizard.isPublished.value).toBe(true);
  });

  it('does not publish when verification fails or the returned version differs', async () => {
    const validateServiceCaDraft = vi.fn().mockResolvedValue(draft(2, { verifiedVersion: 1 }));
    const publishServiceCaDraft = vi.fn();
    const wizard = setupWizard({ validateServiceCaDraft, publishServiceCaDraft });
    wizard.form.caId = largeCaId;
    wizard.draft.value = draft(2);
    wizard.step.value = 2;
    await wizard.validate();
    expect(wizard.step.value).toBe(2);
    await wizard.publish();
    expect(publishServiceCaDraft).not.toHaveBeenCalled();
  });

  it('requires the external source CA identifier before saving a data source', async () => {
    const saveServiceCaDraft = vi.fn();
    const wizard = setupWizard({ saveServiceCaDraft });
    wizard.form.caId = largeCaId;
    wizard.draft.value = draft(1);
    wizard.form.responderId = responderId;
    wizard.form.sourceCaId = '  ';
    await wizard.saveSource();
    expect(saveServiceCaDraft).not.toHaveBeenCalled();
  });

  it('loads a stored draft without recovering connection credentials', async () => {
    const getServiceCaDraft = vi.fn().mockResolvedValue(draft(2, { responderId, verifiedVersion: '2', sourceType: 'DB' }));
    const wizard = setupWizard({ getServiceCaDraft });
    wizard.form.caId = largeCaId;
    await wizard.loadDraft();
    expect(wizard.step.value).toBe(3);
    expect(wizard.form.responderId).toBe(responderId);
    expect(wizard.form.sourceCaId).toBe(largeCaId);
    expect(wizard.form.db.passwordRef).toBe('');
    expect(wizard.form.db.url).toBe('');
  });

  it('accepts serialized version strings without changing the exact CA ID', async () => {
    const validateServiceCaDraft = vi.fn().mockResolvedValue(draft(2, { verifiedVersion: '2' }));
    const publishServiceCaDraft = vi.fn().mockResolvedValue(draft(2, { verifiedVersion: '2', publishedVersion: '2' }));
    const wizard = setupWizard({ validateServiceCaDraft, publishServiceCaDraft });
    wizard.form.caId = largeCaId;
    wizard.draft.value = { ...draft(2), version: '2' };
    wizard.step.value = 2;
    await wizard.validate();
    await wizard.publish();
    expect(publishServiceCaDraft).toHaveBeenCalledWith(largeCaId, 2);
    expect(wizard.isPublished.value).toBe(true);
  });
});
