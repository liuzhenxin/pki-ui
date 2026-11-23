import { describe, expect, it } from 'vitest';
import { formatProfileValidity, MAX_PROFILE_VALIDITY, parseProfileValidity } from '@/utils/ca/profile-validity';

describe('CA profile maximum validity syntax', () => {
  it.each(['10y', '50y', '600m', '21900d', '104w', '24h', '365', '40Y'])('accepts the CA syntax without a template-type ceiling: %s', (value) => {
    expect(parseProfileValidity(value)).not.toBeNull();
  });

  it('keeps the backend meaning of minutes and does not treat m as months', () => {
    expect(parseProfileValidity('12m')).toEqual({ value: 12, unit: 'm' });
    expect(formatProfileValidity('12m')).toBe('12 分钟');
    expect(formatProfileValidity('365')).toBe('365 天');
  });

  it.each(['', '0y', '-1y', '1.5y', 'NaNy', 'Infinityy', '1month', '9007199254740992d', null, undefined, {}])(
    'rejects invalid or unsafe durations: %s',
    (value) => expect(parseProfileValidity(value)).toBeNull()
  );

  it('honors the backend integer range without imposing a certificate policy', () => {
    expect(parseProfileValidity(`${MAX_PROFILE_VALIDITY}m`)).toEqual({ value: MAX_PROFILE_VALIDITY, unit: 'm' });
    expect(parseProfileValidity(`${MAX_PROFILE_VALIDITY + 1}m`)).toBeNull();
  });
});
