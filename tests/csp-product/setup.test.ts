import { createHash } from 'node:crypto';
import agreementSource from '@/components/Agreement/index.vue?raw';
import { CSP_AGREEMENT_VERSION } from '@/products/csp/agreement';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
import type { SetupView } from '@/api/csp/console';

const view: SetupView = {
  initialized: false,
  draftVersion: 3,
  step: 3,
  agreed: true,
  attempted: false,
  agreementVersion: 'test',
  companyName: 'Company',
  serviceVersion: 'v2',
  environment: 'test',
  checkedAt: new Date().toISOString(),
  accounts: ['SYSTEM_ADMIN', 'SECURITY_ADMIN', 'AUDIT_ADMIN'].map((role) => ({ role, valid: true })) as SetupView['accounts']
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
describe('四步初始化持久状态', () => {
  it('公共协议源文件与同意版本摘要一致', () => {
    expect(CSP_AGREEMENT_VERSION).toBe('public-v1-sha256-' + createHash('sha256').update(agreementSource).digest('hex'));
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
  it('结果未知时，即使当前查询尚无持久尝试，也不在本会话再次提交', async () => {
    const { store, fetcher } = storeWith([{ data: view }, { data: { message: '结果未知' }, status: 502 }, { data: view }]);
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    await store.refresh();
    store.confirmed = true;
    await store.initialize();
    expect(store.initializationAttempted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
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
});
