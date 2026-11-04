import { describe, expect, it } from 'vitest';
import { parseCertificateTime, responderStatusLabel, signerTypeLabel, summarizeOcspCertificate } from '../../src/utils/ocspPresentation';
describe('certificate time metadata', () => {
  it('uses the X.509 1950/2050 UTC time cutoff', () => {
    expect(parseCertificateTime('500101000000Z')?.getUTCFullYear()).toBe(1950);
    expect(parseCertificateTime('491231235959Z')?.getUTCFullYear()).toBe(2049);
  });
  it('accepts GeneralizedTime with UTC precision', () => {
    expect(parseCertificateTime('20261003013000Z')?.toISOString()).toBe('2026-10-03T01:30:00.000Z');
  });
  it('rejects invalid dates and timezone-less strings', () => {
    expect(parseCertificateTime('20260230000000Z')).toBeNull();
    expect(parseCertificateTime('20261003240000Z')).toBeNull();
    expect(parseCertificateTime('20261003000000')).toBeNull();
  });
  it('does not label missing or corrupt certificates valid', () => {
    expect(summarizeOcspCertificate().state).toBe('未配置证书');
    expect(summarizeOcspCertificate('not a certificate').state).toBe('证书无法解析');
  });
  it('preserves unknown signing backends and status codes', () => {
    expect(signerTypeLabel('SDF')).toBe('SDF 硬件签名');
    expect(signerTypeLabel('CUSTOM')).toBe('CUSTOM');
    expect(responderStatusLabel('ACTIVE')).toBe('已启用');
    expect(responderStatusLabel('CUSTOM')).toBe('CUSTOM');
  });
});
