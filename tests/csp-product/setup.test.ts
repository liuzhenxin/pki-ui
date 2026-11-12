import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCspInstallationStore } from '@/store/modules/cspInstallation';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

const installation = {
  initialized: false,
  draftVersion: 3,
  step: 3,
  attempted: false,
  accounts: [
    { role: 'SYSTEM_ADMIN', valid: true },
    { role: 'AUDIT_ADMIN', valid: true }
  ]
};
const admin = { password: 'fixture-admin-password' };
const auditor = { password: 'fixture-auditor-password', certPem: 'test certificate placeholder' };

function storeWith(...replies: (Response | Error)[]) {
  setActivePinia(createPinia());
  const fetcher = vi.fn();
  for (const reply of replies) {
    if (reply instanceof Error) fetcher.mockRejectedValueOnce(reply);
    else fetcher.mockResolvedValueOnce(reply);
  }
  vi.stubGlobal('fetch', fetcher);
  useCspConsoleStore().csrf = 'installation-fixture';
  return { store: useCspInstallationStore(), fetcher };
}

afterEach(() => vi.unstubAllGlobals());

describe('两员安装初始化', () => {
  it('最终确认一次性提交两员凭据并读取初始化回执', async () => {
    const { store, fetcher } = storeWith(Response.json(installation), Response.json({ ...installation, initialized: true, accounts: [] }));
    await store.refresh();
    expect(store.environmentReady).toBe(true);
    store.confirmed = true;
    await store.initialize(admin, auditor);
    expect(fetcher.mock.calls[1][0]).toBe('/console-api/installation-complete');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ draftVersion: 3, confirm: true, admin, auditor });
    expect(store.completion).toBe(true);
  });

  it('已持久化提交尝试后只查询结果', async () => {
    const { store, fetcher } = storeWith(Response.json({ ...installation, attempted: true }));
    await store.refresh();
    store.confirmed = true;
    await store.initialize(admin, auditor);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('拒绝只有一员或者含旧安全管理员的核验响应', async () => {
    const { store, fetcher } = storeWith(
      Response.json({ ...installation, accounts: [installation.accounts[0]] }),
      Response.json({ ...installation, accounts: [installation.accounts[0], { role: 'SECURITY_ADMIN', valid: true }] })
    );
    for (let i = 0; i < 2; i++) {
      await store.refresh();
      store.confirmed = true;
      await store.initialize(admin, auditor);
      expect(store.environmentReady).toBe(false);
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('提交超时后通过状态查询恢复，且不会自动提交', async () => {
    const { store, fetcher } = storeWith(
      Response.json(installation),
      new Error('connection lost'),
      Response.json({ ...installation, attempted: true })
    );
    await store.refresh();
    store.confirmed = true;
    await store.initialize(admin, auditor);
    await store.refresh();
    expect(store.initializationAttempted).toBe(true);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      '/console-api/installation',
      '/console-api/installation-complete',
      '/console-api/installation'
    ]);
  });
});
