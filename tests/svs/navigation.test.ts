import { expect, it, vi } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import Layout from '@/layout/index.vue';
import { svsConstantRoutes } from '@/router/svs';
import { svsRoutes } from '@/utils/svsNavigation';
import { menus } from '@/api/svs/product';
import { getSvsInitialization } from '@/api/svs/init';
vi.mock('@/api/svs/product', () => ({ menus: vi.fn() }));
vi.mock('@/api/svs/init', () => ({ getSvsInitialization: vi.fn(), getSvsInitPlan: vi.fn() }));
vi.mock('@/api/svs/system', () => ({ deviceInformation: vi.fn() }));
vi.mock('@/layout/index.vue', () => ({ default: {} }));
it('shows initialization navigation before business menus are loaded', async () => {
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: false, platformTenantValid: false, deviceReady: false, tenantId: 9, code: 'svs' });
  const routes = await svsRoutes();
  expect(routes).toHaveLength(1);
  expect(routes[0].children![0].path).toBe('init');
  expect(routes[0].hidden).not.toBe(true);
  expect(menus).not.toHaveBeenCalled();
});
it('only implemented two-level routes are accepted from the menu response', async () => {
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: true, platformTenantValid: true, deviceReady: true, tenantId: 9, code: 'svs' });
  vi.mocked(menus).mockResolvedValue([
    {
      title: '授权',
      path: '',
      mutable: false,
      children: [
        { title: '审批', path: '/svs/approvals', mutable: true, children: [] },
        { title: '恢复出厂', path: '/svs/factory-reset', mutable: true, children: [] }
      ]
    }
  ]);
  const routes = await svsRoutes();
  expect(routes[0].children).toHaveLength(1);
  expect(routes[0].children![0].path).toBe('/svs/approvals');
});

it('initialization lazily loads management Layout providing sidebar and user logout', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: svsConstantRoutes });
  const matched = router.resolve('/svs/init').matched;
  expect(matched).toHaveLength(2);
  const load = matched[0].components!.default as () => Promise<any>;
  expect((await load()).default).toBe(Layout);
  expect(matched[1].name).toBe('SvsInitialization');
});

it('registers business routes after initialization in the same router session', async () => {
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: false, platformTenantValid: true, deviceReady: true, tenantId: 9, code: 'svs' });
  const router = createRouter({ history: createMemoryHistory(), routes: svsConstantRoutes });
  (await svsRoutes()).forEach((route) => router.addRoute(route));
  expect(router.resolve('/svs/runtime').matched.at(-1)?.name).not.toBe('Svsruntime');
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: true, platformTenantValid: true, deviceReady: true, tenantId: 9, code: 'svs' });
  vi.mocked(menus).mockResolvedValue([
    { title: '系统管理', path: '', mutable: false, children: [{ title: '运行状态', path: '/svs/runtime', mutable: false, children: [] }] }
  ]);
  (await svsRoutes()).forEach((route) => router.addRoute(route));
  expect(router.resolve('/svs/runtime').matched.at(-1)?.name).toBe('Svsruntime');
});

it('opens the SVS home page from the shared layout home link', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: svsConstantRoutes });
  router.addRoute({ path: '/svs/home', name: 'Svshome', component: { template: '<div>Runtime</div>' } });
  await router.push('/index');
  expect(router.currentRoute.value.path).toBe('/svs/home');
  expect(router.currentRoute.value.name).toBe('Svshome');
});

it('system administrator information pages load dedicated read-only component and expanded menu metadata', async () => {
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: true } as any);
  vi.mocked(menus).mockResolvedValue([
    {
      title: '设备管理',
      path: '',
      mutable: false,
      children: [
        { title: '设备基本信息', path: '/svs/device', mutable: false, children: [] },
        { title: '网络配置', path: '/svs/network', mutable: false, children: [] },
        { title: '初始化信息', path: '/svs/initialization-info', mutable: false, children: [] }
      ]
    }
  ]);
  const routes = await svsRoutes();
  expect(routes[0].meta?.svsExpanded).toBe(true);
  const router = createRouter({ history: createMemoryHistory(), routes });
  expect(router.resolve('/svs/device').matched.at(-1)?.props.default).toEqual({ page: 'device', title: '设备基本信息', mutable: false });
  const load = routes[0].children![0].component as () => Promise<any>;
  expect((await load()).default.__name).toBe('index');
  expect(routes[0].children?.map((r) => r.path)).toEqual(['/svs/device', '/svs/network', '/svs/initialization-info']);
});
