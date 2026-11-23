import { describe, expect, it } from 'vitest';
import { rsaKmcKeyRequest, rsaKmcKeySizes } from '../../src/utils/raKmcKeyRequest';

describe('RA RSA KMC key selection', () => {
  const mixed = JSON.stringify({ keyAlgorithms: ['RSA-2048', 'RSA-4096'] });

  it('carries the selected 4096-bit size when both sizes are allowed', () => {
    expect(rsaKmcKeyRequest(mixed, 4096)).toEqual({ keyAlgorithm: 'RSA', keySize: 4096 });
    expect(rsaKmcKeyRequest(mixed, 2048)).toEqual({ keyAlgorithm: 'RSA', keySize: 2048 });
  });

  it('defaults a 4096-only profile to its sole allowed option', () => {
    expect(rsaKmcKeySizes('{"keyAlgorithms":["RSA-4096"]}')).toEqual([4096]);
  });

  it('reads structured modulus constraints', () => {
    const profile = JSON.stringify({
      keyAlgorithms: [{ algorithms: [{ oid: '1.2.840.113549.1.1.1', description: 'RSA' }], parameters: { rsa: { modulus: [4096] } } }]
    });
    expect(rsaKmcKeySizes(profile)).toEqual([4096]);
    expect(() => rsaKmcKeyRequest(profile, 2048)).toThrow('模板允许');
  });

  it('rejects unsupported sizes instead of silently substituting 2048', () => {
    expect(() => rsaKmcKeyRequest(mixed, 3072)).toThrow();
    expect(rsaKmcKeySizes('{"keyAlgorithms":["RSA-3072"]}')).toEqual([]);
  });

  it('keeps legacy profiles without key constraints usable', () => {
    expect(rsaKmcKeySizes(undefined)).toEqual([2048, 4096]);
    expect(rsaKmcKeySizes('{"keyAlgorithms":[{"description":"RSA"}]}')).toEqual([2048, 4096]);
  });
});
