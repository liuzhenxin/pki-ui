import { describe, expect, it } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { buildOcspNavigation, isOcspTenantContext } from '../../src/utils/ocspNavigation';
const route = (component: string, path: string, hidden = false) =>
  ({ path, component, hidden, name: path, meta: { title: path } }) as unknown as RouteRecordRaw;
const fixture = () =>
  [
    {
      path: '/ocsp',
      children: [route('ocsp/dashboard/index', 'overview'), route('ocsp/responder/index', 'responders'), route('ocsp/status/index', 'status')]
    },
    {
      path: '/config',
      children: [route('ocsp/source/index', 'default'), route('ocsp/ca-source/index', 'ca'), route('ocsp/config/index', 'runtime')]
    },
    { path: '/security', children: [route('ocsp/user/index', 'users')] },
    route('ocsp/init/index', '/setup', true),
    route('ca/root/index', '/ca/root')
  ] as RouteRecordRaw[];
describe('OCSP navigation permission and URL boundaries', () => {
  it('preserves every authorized leaf URL, name and hidden flag without mutating input', () => {
    const input = fixture();
    const snapshot = JSON.stringify(input);
    const output = buildOcspNavigation(input, false);
    const leaves = output.flatMap((item) => item.children || [item]);
    expect(leaves.find((item) => item.name === 'responders')?.path).toBe('/ocsp/responders');
    expect(leaves.find((item) => item.name === 'ca')?.path).toBe('/config/ca');
    expect(leaves.find((item) => item.path === '/setup')?.hidden).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('does not synthesize source or user routes absent from the authorized server response', () => {
    const output = buildOcspNavigation([{ path: '/ocsp', children: [route('ocsp/responder/index', 'responders')] }] as RouteRecordRaw[], false);
    expect(output.map((item) => item.meta?.title)).toEqual(['响应者管理']);
  });
  it('removes the user management menu and route while preserving other settings', () => {
    const output = buildOcspNavigation(fixture(), false);
    const leaves = output.flatMap((item) => item.children || [item]);
    expect(leaves.find((item) => item.name === 'users')).toBeUndefined();
    expect(leaves.find((item) => item.name === 'runtime')?.hidden).not.toBe(true);
    expect(buildOcspNavigation([{ path: '/security', children: [route('ocsp/user/index', 'users')] }] as RouteRecordRaw[], false)).toEqual([]);
  });
  it('exposes monitoring only with its permission', () => {
    expect(buildOcspNavigation(fixture(), false).some((item) => item.path === '/ocsp/monitoring')).toBe(false);
    expect(buildOcspNavigation(fixture(), true).some((item) => item.path === '/ocsp/monitoring')).toBe(true);
  });
  it('leaves other product route trees unchanged', () => {
    const input = [route('ca/root/index', '/ca/root')];
    expect(buildOcspNavigation(input, true)).toBe(input);
  });
  it('keeps hidden ancestor restrictions on descendant menu items', () => {
    const output = buildOcspNavigation(
      [{ path: '/ocsp', hidden: true, children: [route('ocsp/responder/index', 'responders')] }] as RouteRecordRaw[],
      false
    );
    expect(output[0].hidden).toBe(true);
  });
});

describe('OCSP visual tenant context', () => {
  it('uses explicit tenant identity before build target', () => {
    expect(isOcspTenantContext('6', '4')).toBe(true);
    expect(isOcspTenantContext('4', '6')).toBe(false);
  });
  it('keeps OCSP branding after a restored session omits tenant metadata', () => {
    expect(isOcspTenantContext('', '6')).toBe(true);
  });
  it('does not infer OCSP for a generic or multi-tenant build', () => {
    expect(isOcspTenantContext('')).toBe(false);
    expect(isOcspTenantContext('', '4,6')).toBe(false);
  });
});
