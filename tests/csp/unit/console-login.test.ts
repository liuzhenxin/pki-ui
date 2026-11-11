import { afterEach, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

afterEach(() => vi.unstubAllGlobals());

test('service administrator restores a session without calling installation APIs', async () => {
  setActivePinia(createPinia());
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ csrf: 'test', authenticated: true, initialized: true, canInitialize: false })));
  vi.stubGlobal('fetch', fetcher);
  const store = useCspConsoleStore();
  await store.restore();
  expect(store.signedIn).toBe(true);
  expect(store.canInitialize).toBe(false);
  expect(store.destination).toBe('/csp/management');
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/console-api/session']);
});

test('service administrator login clears password and goes directly to management', async () => {
  setActivePinia(createPinia());
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true, initialized: true, canInitialize: false })));
  vi.stubGlobal('fetch', fetcher);
  const store = useCspConsoleStore();
  store.username = 'service-manager';
  store.password = 'test-only';
  await store.login();
  expect(store.signedIn).toBe(true);
  expect(store.password).toBe('');
  expect(store.busy).toBe(false);
  expect(store.destination).toBe('/csp/management');
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/console-api/login']);
});

test.each([
  [false, '/csp/setup'],
  [true, '/csp/overview']
] as const)('installer login with initialized=%s does not depend on the removed activation wizard', async (initialized, destination) => {
  setActivePinia(createPinia());
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true, canInitialize: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ initialized })));
  vi.stubGlobal('fetch', fetcher);
  const store = useCspConsoleStore();
  store.username = 'installer';
  store.password = 'test-only';
  await store.login();
  expect(store.signedIn).toBe(true);
  expect(store.password).toBe('');
  expect(store.destination).toBe(destination);
  expect(store.allows('/csp/setup')).toBe(!initialized);
  expect(store.allows('/csp/applications')).toBe(initialized);
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/console-api/login', '/console-api/installation']);
});

test('overview clears stale service status on failure without redirecting back to setup', async () => {
  setActivePinia(createPinia());
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ csrf: 'test', authenticated: true, canInitialize: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ initialized: true })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workflow: 'SERVICE_ACTIVATION_V3',
          initialized: true,
          draftVersion: 1,
          step: 3,
          checks: Array.from({ length: 9 }, () => ({ ready: true })),
          enabledCapabilities: ['RANDOM'],
          checkedAt: '2026-11-11T00:00:00Z'
        })
      )
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: '服务状态暂不可用' }), { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  const store = useCspConsoleStore();
  await store.restore();
  await store.refresh();
  expect(store.setup?.enabledCapabilities).toEqual(['RANDOM']);
  await store.refresh();
  expect(store.setup).toBeNull();
  expect(store.checkedAt).toBe('');
  expect(store.error).not.toBe('');
  expect(store.signedIn).toBe(true);
  expect(store.destination).toBe('/csp/overview');
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    '/console-api/session',
    '/console-api/installation',
    '/console-api/setup',
    '/console-api/setup'
  ]);
});

test.each([
  [{ canManageAuditors: true }, '/csp/auditors', ['/csp/auditors']],
  [{ canReadLoginLogs: true, canReadOperationLogs: true }, '/csp/login-logs', ['/csp/login-logs', '/csp/operation-logs']]
] as const)('audit role can access only its assigned pages', async (permissions, destination, allowed) => {
  setActivePinia(createPinia());
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          csrf: 'test',
          authenticated: true,
          initialized: true,
          canInitialize: false,
          canManageServices: false,
          ...permissions
        })
      )
    )
  );
  const store = useCspConsoleStore();
  await store.restore();
  expect(store.destination).toBe(destination);
  const paths = ['/csp/setup', '/csp/overview', '/csp/management', '/csp/auditors', '/csp/login-logs', '/csp/operation-logs'];
  expect(paths.filter(store.allows)).toEqual(allowed);
});

test('personnel without installation permission cannot enter management before installation', async () => {
  setActivePinia(createPinia());
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ csrf: 'test', authenticated: true, initialized: false, canInitialize: false, canManageServices: true }))
      )
  );
  const store = useCspConsoleStore();
  await store.restore();
  expect(store.signedIn).toBe(true);
  expect(store.destination).toBe('/csp/unavailable');
  expect(store.allows('/csp/setup')).toBe(false);
  expect(store.allows('/csp/management')).toBe(false);
});
