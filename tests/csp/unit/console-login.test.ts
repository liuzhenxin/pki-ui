import { afterEach, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

afterEach(() => vi.unstubAllGlobals());

test('service administrator restores a session without calling installation APIs', async () => {
  setActivePinia(createPinia());
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ csrf: 'test', authenticated: true, canInitialize: false })));
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
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true, canInitialize: false })));
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
