import { describe, it, expect } from 'vitest';
import { normalizeOcspCaId, normalizeOptionalOcspId } from '../../src/utils/ocspIdentifier';
describe('lossless CA ID', () => {
  it('preserves the real deployed large ID', () => expect(normalizeOcspCaId('99183839863111681')).toBe('99183839863111681'));
  it('supports Java Long maximum', () => expect(normalizeOcspCaId('9223372036854775807')).toBe('9223372036854775807'));
  it('rejects already rounded numbers', () => expect(() => normalizeOcspCaId(99183839863111681)).toThrow());
  it('rejects invalid or overflowing IDs', () => {
    for (const value of ['0', '-1', '1.1', 'abc', '9223372036854775808']) expect(() => normalizeOcspCaId(value)).toThrow();
  });
});

describe('optional OCSP query IDs', () => {
  it('omits empty filters from the request body', () => {
    for (const value of [undefined, null, '', '  ']) {
      expect(JSON.parse(JSON.stringify({ caId: normalizeOptionalOcspId(value) }))).toEqual({});
    }
  });
  it('serializes CA and responder IDs as lossless text', () => {
    const body = { caId: normalizeOptionalOcspId(' 99183839863111681 '), responderId: normalizeOptionalOcspId('9223372036854775807') };
    expect(JSON.parse(JSON.stringify(body))).toEqual({ caId: '99183839863111681', responderId: '9223372036854775807' });
  });
  it('accepts safe numeric values without changing their ID', () => expect(normalizeOptionalOcspId(1)).toBe('1'));
  it('rejects invalid nonempty filters and rounded numbers', () => {
    for (const value of ['0', '-1', '1.5', '1e3', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => normalizeOptionalOcspId(value)).toThrow();
    }
  });
});
