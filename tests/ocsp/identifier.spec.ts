import { describe, it, expect } from 'vitest';
import { normalizeOcspCaId } from '../../src/utils/ocspIdentifier';
describe('lossless CA ID', () => {
  it('preserves the real deployed large ID', () => expect(normalizeOcspCaId('99183839863111681')).toBe('99183839863111681'));
  it('supports Java Long maximum', () => expect(normalizeOcspCaId('9223372036854775807')).toBe('9223372036854775807'));
  it('rejects already rounded numbers', () => expect(() => normalizeOcspCaId(99183839863111681)).toThrow());
  it('rejects invalid or overflowing IDs', () => {
    for (const value of ['0', '-1', '1.1', 'abc', '9223372036854775808']) expect(() => normalizeOcspCaId(value)).toThrow();
  });
});
