import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  token: 'test-token',
  initialized: true,
  initializationUnavailable: false,
  user: {
    tenantId: '2',
    permissions: [] as string[],
    tenantInitStatus: undefined as number | undefined,
    getInfo: vi.fn(),
    logout: vi.fn(),
    setTenantInitStatus: vi.fn()
  },
  router: { beforeEach: vi.fn(), afterEach: vi.fn(), addRoute: vi.fn() },
  permission: { generateRoutes: vi.fn(), generateInitRoutes: vi.fn() },
  settings: { setAppTitle: vi.fn(), setTitle: vi.fn() }
}));
vi.mock('@/router', () => ({ default: state.router }));
vi.mock('@/utils/auth', () => ({ getToken: () => state.token }));
vi.mock('@/utils/request', () => ({ isRelogin: { show: false }, resetSessionGuard: vi.fn() }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => state.user }));
vi.mock('@/store/modules/settings', () => ({ useSettingsStore: () => state.settings }));
vi.mock('@/store/modules/permission', () => ({ usePermissionStore: () => state.permission }));
vi.mock('@/api/system/tenant', () => ({ getTenant: async () => ({ data: { name: '产品', status: 0 } }) }));
vi.mock('@/api/kms/initialization', () => ({
  getKmsInitialization: vi.fn(async () => {
    if (state.initializationUnavailable) throw new Error('unavailable');
    return { locked: state.initialized };
  })
}));
vi.mock('@/api/svs/init', () => ({ getSvsInitialization: vi.fn() }));
vi.mock('nprogress', () => ({ default: { configure: vi.fn(), start: vi.fn(), done: vi.fn() } }));
import '@/permission';
const guard = state.router.beforeEach.mock.calls[0][0];
const route = { path: '/index', fullPath: '/index', params: {}, query: {}, hash: '', meta: {} };
beforeEach(() => {
  vi.clearAllMocks();
  state.token = 'test-token';
  state.initialized = true;
  state.initializationUnavailable = false;
  state.user.tenantId = '2';
  state.user.permissions = [];
  state.user.tenantInitStatus = undefined;
  state.user.getInfo.mockResolvedValue(undefined);
  state.permission.generateRoutes.mockResolvedValue([]);
  state.permission.generateInitRoutes.mockResolvedValue([]);
});
it('loads normal menus on first KMS login without redirecting status-0 tenant to CA setup', async () => {
  const next = vi.fn();
  await guard(route, route, next);
  expect(state.permission.generateRoutes).toHaveBeenCalledOnce();
  expect(state.permission.generateInitRoutes).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ path: '/index' }));
  expect(state.settings.setAppTitle).toHaveBeenCalledWith('产品 (KMS)');
});
it('keeps the existing CA initialization guard for other products', async () => {
  state.user.tenantId = '4';
  const next = vi.fn();
  await guard(route, route, next);
  expect(state.permission.generateInitRoutes).toHaveBeenCalledOnce();
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ path: '/ca/setup' }));
});
it('still requires authentication before opening a KMS page', async () => {
  state.token = '';
  const next = vi.fn();
  const kms = { ...route, path: '/kms/console', fullPath: '/kms/console' };
  await guard(kms, route, next);
  expect(next).toHaveBeenCalledWith('/login?redirect=%2Fkms%2Fconsole');
  expect(state.permission.generateRoutes).not.toHaveBeenCalled();
});
it('allows an authenticated KMS tenant to revisit the console without CA initialization', async () => {
  state.user.permissions = ['kms:key:detail'];
  const next = vi.fn();
  await guard(route, route, next);
  expect(next).toHaveBeenCalledWith();
});

it('redirects uninitialized KMS to its own nine-step route on first login', async () => {
  state.initialized = false;
  const next = vi.fn();
  await guard(route, route, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ path: '/kms/init' }));
  expect(state.permission.generateRoutes).not.toHaveBeenCalled();
});
it('fails closed when initialization status cannot be read and keeps the wizard reachable', async () => {
  state.initializationUnavailable = true;
  state.user.permissions = ['kms:initialize'];
  const next = vi.fn();
  await guard(route, route, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ path: '/kms/init' }));
  next.mockClear();
  await guard({ ...route, path: '/kms/init' }, route, next);
  expect(next).toHaveBeenCalledWith();
});
it('returns initialized KMS from the wizard to the management home', async () => {
  state.user.permissions = ['kms:initialize'];
  const next = vi.fn();
  await guard({ ...route, path: '/kms/init' }, route, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ path: '/index' }));
});
