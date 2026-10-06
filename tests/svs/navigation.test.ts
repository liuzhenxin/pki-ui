import { expect, it, vi } from 'vitest';
import { svsRoutes } from '@/utils/svsNavigation';
import { menus } from '@/api/svs/product';
import { getSvsInitialization } from '@/api/svs/init';
vi.mock('@/api/svs/product', () => ({ menus: vi.fn() }));
vi.mock('@/api/svs/init', () => ({ getSvsInitialization: vi.fn() }));
vi.mock('@/layout/index.vue', () => ({ default: {} }));
it('initialization must complete before menus are loaded', async () => { vi.mocked(getSvsInitialization).mockResolvedValue({ locked: false, platformTenantValid: false, deviceReady: false, tenantId: 9, code: 'svs' });expect(await svsRoutes()).toEqual([]);expect(menus).not.toHaveBeenCalled(); });
it('only implemented two-level routes are accepted from the menu response', async () => {
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: true, platformTenantValid: true, deviceReady: true, tenantId: 9, code: 'svs' });
  vi.mocked(menus).mockResolvedValue([{ title: '授权', path: '', mutable: false, children: [{ title: '审批', path: '/svs/approvals', mutable: true, children: [] }, { title: '恢复出厂', path: '/svs/factory-reset', mutable: true, children: [] }] }]);
  const routes = await svsRoutes();expect(routes[0].children).toHaveLength(1);expect(routes[0].children![0].path).toBe('/svs/approvals');
});
