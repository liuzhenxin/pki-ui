import { beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, ref } from 'vue';
import ElementPlus from 'element-plus';
import KmsConsole from '@/views/kms/index.vue';
import CryptoPanel from '@/views/kms/components/CryptoPanel.vue';
import * as api from '@/api/kms';
const session = vi.hoisted(() => ({ tenantId: '2', permissions: ['*:*:*'] }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => session }));
vi.mock('@/plugins/auth', () => ({
  default: {
    hasPermi: (p: string) => session.permissions.includes('*:*:*') || session.permissions.includes(p),
    hasPermiOr: (ps: string[]) => session.permissions.includes('*:*:*') || ps.some((p) => session.permissions.includes(p))
  }
}));
vi.mock('@/api/kms', () => ({
  createKey: vi.fn(),
  describeKey: vi.fn(),
  changeKeyState: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  generateDataKey: vi.fn()
}));
const id = '11111111-1111-4111-8111-111111111111';
const key = {
  keyId: id,
  alias: 'orders/demo',
  arn: `arn:liuzx:kms::2:key/${id}`,
  algorithm: 'SM4_128',
  keyUsage: 'ENCRYPT_DECRYPT',
  state: 'ENABLED',
  currentVersion: 1,
  createdAt: '2026-10-11',
  updatedAt: '2026-10-11',
  versions: [{ version: 1, state: 'ACTIVE', provider: 'sdf', createdAt: '2026-10-11' }]
} as const;
const create = () => mount(KmsConsole, { global: { plugins: [ElementPlus] } });
const crypto = () => mount(CryptoPanel, { props: { selectedKeyId: id }, global: { plugins: [ElementPlus] } });
beforeEach(() => {
  vi.clearAllMocks();
  session.tenantId = '2';
  session.permissions = ['*:*:*'];
  vi.mocked(api.describeKey).mockResolvedValue({ ...key, versions: [...key.versions] });
});
it('shows KMS only for tenant 2 and does not dispatch a request for another product', async () => {
  session.tenantId = '3';
  const w = create();
  expect(w.text()).toContain('仅适用于');
  expect(w.text()).not.toContain('创建主密钥');
  await (w.vm as any).lookup();
  expect(api.describeKey).not.toHaveBeenCalled();
  w.unmount();
});
it('loads actual version metadata, preserves state on lifecycle failure, and clears stale lookup details', async () => {
  const w = create();
  const vm = w.vm as any;
  vm.queryId = id;
  await vm.lookup();
  await flushPromises();
  expect(w.text()).toContain('orders/demo');
  expect(w.text()).toContain('sdf');
  vm.openAction('disable');
  vi.mocked(api.changeKeyState).mockRejectedValue(new Error('操作失败'));
  await vm.runAction();
  expect(vm.detail.state).toBe('ENABLED');
  expect(vm.actionVisible).toBe(true);
  expect(vm.actionError).toBe('操作失败');
  vi.mocked(api.describeKey).mockRejectedValue(new Error('无权访问'));
  await vm.lookup();
  expect(vm.detail).toBeUndefined();
  expect(vm.error).toBe('无权访问');
  w.unmount();
});
it('hides unauthorized operations and enforces the same check before dispatch', async () => {
  session.permissions = ['kms:key:detail'];
  const w = create();
  const vm = w.vm as any;
  vm.queryId = id;
  await vm.lookup();
  await flushPromises();
  expect(w.text()).not.toContain('创建主密钥');
  expect(w.text()).not.toContain('轮换密钥');
  expect(w.text()).not.toContain('密码操作');
  vm.openAction('rotate');
  expect(vm.actionVisible).toBe(false);
  await vm.runAction();
  expect(api.changeKeyState).not.toHaveBeenCalled();
  w.unmount();
});
it('defaults plaintext output to masked, clears on operation change and never writes browser storage', async () => {
  const local = vi.spyOn(Storage.prototype, 'setItem');
  const w = crypto();
  const vm = w.vm as any;
  vm.operation = 'decrypt';
  await flushPromises();
  vm.input = 'dGVzdA==';
  vi.mocked(api.decrypt).mockResolvedValue({ keyId: id, keyVersion: 1, plaintext: 'c2VjcmV0' });
  await vm.submit();
  await flushPromises();
  expect(vm.result.plaintext).toBe('c2VjcmV0');
  expect(vm.reveal).toBe(false);
  expect(w.html()).not.toContain('c2VjcmV0');
  vm.reveal = true;
  await flushPromises();
  expect((w.get('[aria-label="明文结果"]').element as HTMLTextAreaElement).value).toBe('c2VjcmV0');
  vm.operation = 'encrypt';
  await flushPromises();
  expect(vm.result).toBeUndefined();
  expect(vm.input).toBe('');
  expect(vm.context).toBe('');
  expect(local).not.toHaveBeenCalled();
  local.mockRestore();
  w.unmount();
});
it('cannot restore a cleared secret when an in-flight request completes', async () => {
  let resolve: (value: any) => void;
  vi.mocked(api.decrypt).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const w = crypto();
  const vm = w.vm as any;
  vm.operation = 'decrypt';
  await flushPromises();
  vm.input = 'dGVzdA==';
  const pending = vm.submit();
  expect(vm.busy).toBe(true);
  vm.clear();
  resolve!({ keyId: id, keyVersion: 1, plaintext: 'late-secret' });
  await pending;
  expect(vm.result).toBeUndefined();
  expect(vm.busy).toBe(false);
  w.unmount();
});
it('requires operation permission even if submit is invoked programmatically', async () => {
  session.permissions = [];
  const w = crypto();
  const vm = w.vm as any;
  vm.input = 'dGVzdA==';
  await vm.submit();
  expect(api.encrypt).not.toHaveBeenCalled();
  expect(vm.error).toContain('权限');
  w.unmount();
});

it('creates a key with the existing contract and keeps duplicate alias errors visible', async () => {
  const w = create();
  const vm = w.vm as any;
  vm.createVisible = true;
  await flushPromises();
  vm.createForm.alias = 'orders/demo';
  vi.mocked(api.createKey).mockRejectedValueOnce(new Error('密钥别名已存在'));
  await vm.create();
  expect(vm.createError).toBe('密钥别名已存在');
  expect(vm.createVisible).toBe(true);
  vi.mocked(api.createKey).mockResolvedValue({ ...key });
  await vm.create();
  await flushPromises();
  expect(api.createKey).toHaveBeenLastCalledWith({ alias: 'orders/demo', algorithm: 'SM4_128', keyUsage: 'ENCRYPT_DECRYPT', description: '' });
  expect(vm.queryId).toBe(id);
  expect(vm.detail.keyId).toBe(id);
  expect(vm.createVisible).toBe(false);
  w.unmount();
});
it('sends a bounded deletion wait and then exposes cancellation instead of unsafe actions', async () => {
  const w = create();
  const vm = w.vm as any;
  vm.queryId = id;
  await vm.lookup();
  vm.openAction('schedule-deletion');
  vm.deletionDays = 30;
  vi.mocked(api.changeKeyState).mockResolvedValue({
    keyId: id,
    state: 'PENDING_DELETION',
    currentVersion: 1,
    pendingDeletionAt: '2026-11-10',
    updatedAt: '2026-10-11'
  });
  await vm.runAction();
  await flushPromises();
  expect(api.changeKeyState).toHaveBeenCalledWith(id, 'schedule-deletion', 30);
  expect(vm.detail.state).toBe('PENDING_DELETION');
  expect(w.text()).toContain('取消删除');
  expect(w.text()).not.toContain('轮换密钥');
  expect(w.text()).not.toContain('停用密钥');
  w.unmount();
});
it('clears generated plaintext when its cached page is deactivated', async () => {
  const shown = ref(true);
  const host = mount(
    defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => (shown.value ? h(CryptoPanel, { selectedKeyId: id }) : null) }) }),
    { global: { plugins: [ElementPlus] } }
  );
  const vm = host.getComponent(CryptoPanel).vm as any;
  vm.operation = 'data-key';
  await flushPromises();
  vi.mocked(api.generateDataKey).mockResolvedValue({ keyId: id, keyVersion: 1, plaintext: 'ZGF0YQ==', ciphertextBlob: 'dGVzdA==' });
  await vm.submit();
  expect(vm.result.plaintext).toBe('ZGF0YQ==');
  shown.value = false;
  await flushPromises();
  expect(vm.result).toBeUndefined();
  expect(vm.context).toBe('');
  host.unmount();
});
