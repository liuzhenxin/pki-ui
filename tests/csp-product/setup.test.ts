import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
import type { SetupView } from '@/api/csp/console';

const view: SetupView = {
  workflow: 'SERVICE_ACTIVATION_V3',
  initialized: false,
  draftVersion: 3,
  step: 3,
  attempted: false,
  serviceVersion: 'v3',
  environment: 'test',
  checkedAt: new Date().toISOString(),
  checks: [
    ...['PLATFORM_SCHEMA', 'HARDWARE_PROTECTION', 'EXECUTION_ENTRY'].map((code) => ({ group: 'ENVIRONMENT' as const, code, ready: true })),
    ...['SDF_RANDOM_RESOURCE', 'SDF_SM3_RESOURCE'].map((code) => ({ group: 'RESOURCES' as const, code, ready: true })),
    ...['APPLICATION_MAPPING', 'RANDOM_AUTHORIZATION', 'SM3_AUTHORIZATION', 'FOUR_DIMENSION_QUOTAS'].map((code) => ({
      group: 'POLICY' as const,
      code,
      ready: true
    }))
  ],
  enabledCapabilities: []
};
afterEach(() => vi.unstubAllGlobals());
function storeWith(responses: { data: unknown; status?: number }[]) {
  vi.stubGlobal('location', new URL('http://localhost'));
  setActivePinia(createPinia());
  const fetcher = vi.fn();
  for (const response of responses) fetcher.mockResolvedValueOnce(new Response(JSON.stringify(response.data), { status: response.status || 200 }));
  vi.stubGlobal('fetch', fetcher);
  return { store: useCspConsoleStore(), fetcher };
}
describe('资源接入与服务启用持久状态', () => {
  it('拒绝旧安装回执冒充服务启用', async () => {
    const { store } = storeWith([{ data: { ...view, workflow: 'LEGACY_SETUP', initialized: true } }]);
    await store.refresh();
    expect(store.initialized).toBeNull();
  });
  it('刷新恢复服务端进度，最终确认需要重新勾选', async () => {
    const { store } = storeWith([{ data: view }]);
    store.confirmed = true;
    await store.refresh();
    expect(store.setupStep).toBe(3);
    expect(store.confirmed).toBe(false);
    expect(store.environmentReady).toBe(true);
  });
  it('恢复持久提交尝试后只允许查询', async () => {
    const { store, fetcher } = storeWith([{ data: { ...view, attempted: true } }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    await store.advanceSetup('CHECK_ENV');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.initializationAttempted).toBe(true);
  });
  it('提交超时不自动重发，刷新后继续遵守持久尝试', async () => {
    const { store, fetcher } = storeWith([{ data: view }, { data: { message: '结果未知' }, status: 502 }, { data: { ...view, attempted: true } }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    await store.initialize();
    await store.refresh();
    await store.initialize();
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/console-api/setup', '/console-api/setup-complete', '/console-api/setup']);
    expect(store.initializationAttempted).toBe(true);
  });
  it('非破坏性自检结果未知后先查询，服务端确认可重试才允许手动提交', async () => {
    const { store, fetcher } = storeWith([
      { data: view },
      { data: { message: '结果未知' }, status: 502 },
      { data: view },
      { data: { ...view, initialized: true, enabledCapabilities: ['RANDOM'] } }
    ]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    expect(store.initializationAttempted).toBe(false);
    expect(store.initialized).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('明确拒绝后先刷新并核验持久状态，再恢复环境检查', async () => {
    const { store, fetcher } = storeWith([{ data: view }, { data: { message: '核验过期' }, status: 412 }, { data: { ...view, step: 1 } }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    expect(store.initialized).toBeNull();
    await store.initialize();
    await store.refresh();
    expect(store.initializationAttempted).toBe(false);
    expect(store.setupStep).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('过期或配置变化后恢复环境检查，不能提交', async () => {
    const { store, fetcher } = storeWith([{ data: { ...view, step: 1, checkedAt: null } }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    expect(store.setupStep).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('服务端异常状态保持未知并禁止提交', async () => {
    const { store, fetcher } = storeWith([{ data: { ...view, initialized: 'unknown' } }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    expect(store.initialized).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('缺少资源或策略检查时不能启用', async () => {
    const { store, fetcher } = storeWith([{ data: { ...view, checks: view.checks.map((row) => ({ ...row, ready: row.group !== 'RESOURCES' })) } }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    expect(store.environmentReady).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('资源核验仅发送固定动作和CAS版本', async () => {
    const { store, fetcher } = storeWith([{ data: { ...view, step: 1 } }, { data: { ...view, step: 2, draftVersion: 4 } }]);
    await store.refresh();
    await store.advanceSetup('CHECK_RESOURCES');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ draftVersion: 3, action: 'CHECK_RESOURCES' });
  });
});
