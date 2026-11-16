import { beforeEach, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import request from '@/utils/request';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ logout }) }));

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
});

test.each([
  [{ initialized: false, canInitialize: true }, '/csp/setup'],
  [{ initialized: true, canInitialize: true }, '/csp/overview'],
  [{ initialized: true, canInitialize: false, canManageServices: true }, '/csp/management'],
  [{ initialized: false, canInitialize: false, canManageServices: true }, '/csp/unavailable']
] as const)('uses CSP permissions and installation status from the gateway', async (permissions, destination) => {
  vi.mocked(request).mockResolvedValue({ code: 'OK', data: { authenticated: true, ...permissions } });
  const store = useCspConsoleStore();
  await store.restore();

  expect(store.signedIn).toBe(true);
  expect(store.destination).toBe(destination);
  expect(store.allows('/')).toBe(false);
  expect(request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ method: 'get', url: '/csp/v1/console/session' }));
});

test('denies access and clears previous permissions if CSP refuses the platform session', async () => {
  vi.mocked(request)
    .mockResolvedValueOnce({ data: { authenticated: true, initialized: true, canInitialize: true } })
    .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, data: { code: 'Forbidden' } } });
  const store = useCspConsoleStore();
  await store.restore();
  await store.restore();

  expect(store.signedIn).toBe(false);
  expect(store.allows('/csp/setup')).toBe(false);
  expect(store.allows('/csp/overview')).toBe(false);
  expect(store.destination).toBe('/csp/unavailable');
  expect(logout).not.toHaveBeenCalled();
});

test('invalid platform token ends the shared session', async () => {
  vi.mocked(request).mockRejectedValueOnce({ isAxiosError: true, response: { status: 401, data: {} } });
  const store = useCspConsoleStore();
  await store.restore();

  expect(store.signedIn).toBe(false);
  expect(logout).toHaveBeenCalledOnce();
});

test.each([
  [{ canManageAuditors: true }, '/csp/auditors', ['/csp/auditors']],
  [{ canReadLoginLogs: true, canReadOperationLogs: true }, '/csp/login-logs', ['/csp/login-logs', '/csp/operation-logs']]
] as const)('audit role can access only its assigned pages', async (permissions, destination, allowed) => {
  vi.mocked(request).mockResolvedValue({ data: { authenticated: true, initialized: true, canInitialize: false, ...permissions } });
  const store = useCspConsoleStore();
  await store.restore();
  expect(store.destination).toBe(destination);
  const paths = ['/csp/setup', '/csp/overview', '/csp/management', '/csp/auditors', '/csp/login-logs', '/csp/operation-logs'];
  expect(paths.filter(store.allows)).toEqual(allowed);
});
