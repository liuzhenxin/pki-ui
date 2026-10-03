import { describe, expect, it } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { buildOcspNavigation } from '../../src/utils/ocspNavigation';
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
