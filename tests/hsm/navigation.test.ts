import { expect, test, vi } from 'vitest';
vi.mock('@/layout/index.vue', () => ({ default: {} }));
import { buildHsmRoutes } from '@/utils/hsmNavigation';

test('without permissions only the overview is reachable', () => {
  expect(buildHsmRoutes(() => false)[0].children?.map((route) => route.path)).toEqual(['home']);
});
test('read-only auditor receives queries without invented write permissions', () => {
  const granted = new Set(['hsm:init:view', 'hsm:ukey:view']);
  expect(buildHsmRoutes((permission) => granted.has(permission))[0].children?.map((route) => route.path)).toEqual([
    'home',
    'initialization',
    'ukeys',
    'audit'
  ]);
});
test('UKey-only permission does not grant initialization route', () => {
  expect(buildHsmRoutes((permission) => permission === 'hsm:ukey:view')[0].children?.map((route) => route.path)).toEqual(['home', 'ukeys', 'audit']);
});
