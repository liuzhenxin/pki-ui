import { describe, it, expect } from 'vitest';
import { sidebarDestination } from '../../src/utils/sidebarPath';
describe('sidebar destination', () => {
  it('keeps authorized absolute URL beneath a synthetic menu group', () =>
    expect(sidebarDestination('/ocsp-navigation/1', '/ocsp/ocsp-responder')).toBe('/ocsp/ocsp-responder'));
  it('retains relative nested menu destinations', () => expect(sidebarDestination('/system', 'user')).toBe('/system/user'));
  it('supports an empty monitoring child', () => expect(sidebarDestination('/ocsp/monitoring', '')).toBe('/ocsp/monitoring/'));
});
