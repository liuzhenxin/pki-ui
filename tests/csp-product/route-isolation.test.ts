import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/layout/index.vue', () => ({ default: {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each([
  { product: '', tenants: '1', includesCsp: false },
  { product: '', tenants: '4', includesCsp: false },
  { product: 'csp', tenants: '10', includesCsp: true },
  { product: '', tenants: '', includesCsp: true },
  { product: '', tenants: '1, 10', includesCsp: true },
  { product: 'ucsp', tenants: '10', includesCsp: false }
])('registers only the routes allowed for $product/$tenants', async ({ product, tenants, includesCsp }) => {
  vi.stubEnv('VITE_APP_PRODUCT', product);
  vi.stubEnv('VITE_APP_TENANT_IDS', tenants);
  const { default: router, constantRoutes } = await import('@/router');

  // The sidebar uses these static routes before appending the server response.
  expect(constantRoutes.some(({ path }) => path === '/csp')).toBe(includesCsp);
  expect(router.getRoutes().some(({ path }) => path === '/csp/management')).toBe(includesCsp);
  expect(router.getRoutes().some(({ path }) => path === '/index')).toBe(true);
});
