import { describe, expect, it } from 'vitest';
import { cspDestination } from '@/config/csp';

describe('CSP authenticated destination', () => {
  it('routes service administrators directly to management without installation rights', () => {
    expect(cspDestination(null, null, false, false)).toBe('/csp/management');
  });
  it.each([
    [null, null, false, '/csp/installation'],
    [false, null, false, '/csp/installation'],
    [true, null, false, '/csp/setup'],
    [true, false, false, '/csp/setup'],
    [true, true, true, '/csp/setup'],
    [true, true, false, '/csp/overview']
  ] as const)('routes installation=%s service=%s completion=%s to %s', (installation, service, completion, expected) => {
    expect(cspDestination(installation, service, completion)).toBe(expected);
  });
});
