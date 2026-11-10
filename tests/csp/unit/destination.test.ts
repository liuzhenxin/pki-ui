import { describe, expect, it } from 'vitest';
import { cspDestination } from '@/config/csp';

describe('CSP authenticated destination', () => {
  it('routes service administrators directly to management without installation rights', () => {
    expect(cspDestination(null, false)).toBe('/csp/management');
  });
  it.each([
    [null, '/csp/setup'],
    [false, '/csp/setup'],
    [true, '/csp/overview']
  ] as const)('routes installation=%s to %s without requiring service activation', (installation, expected) => {
    expect(cspDestination(installation)).toBe(expected);
  });
});
