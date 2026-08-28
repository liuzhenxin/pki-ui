import { expect, test } from '@playwright/test';
import { localCertificateTimeToUtc } from '../src/utils/certificateTime';

test.describe('CA certificate validity time conversion', () => {
  test('converts an Asia/Shanghai picker value to the UTC API contract', () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = 'Asia/Shanghai';
    try {
      expect(localCertificateTimeToUtc('20260824211311')).toBe('20260824131311');
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }
  });

  test('keeps empty and unrecognized values unchanged', () => {
    expect(localCertificateTimeToUtc(undefined)).toBeUndefined();
    expect(localCertificateTimeToUtc('2026-08-24T21:13:11+08:00')).toBe('2026-08-24T21:13:11+08:00');
  });
});
