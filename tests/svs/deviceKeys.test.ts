import { beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus, { ElMessageBox } from 'element-plus';
import DeviceKeys from '@/views/svs/product/DeviceKeys.vue';
import * as api from '@/api/svs/product';
import * as certApi from '@/api/svs/certificates';
import { listDeviceKeys } from '@/api/svs/deviceKeys';
vi.mock('@/api/svs/product', () => ({ resources: vi.fn(), maintain: vi.fn(), history: vi.fn() }));
vi.mock('@/api/svs/certificates', () => ({ list: vi.fn() }));
vi.mock('@/api/svs/deviceKeys', () => ({ listDeviceKeys: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ push: vi.fn() }) }));
const device = {
  alias: 'primary',
  algorithm: 'SM2',
  usage: 'SIGNING',
  fingerprint: 'abc',
  state: 'READABLE',
  observedAt: '2026-10-11',
  referenceIds: [],
  referenceMismatch: false
};
const key = {
  id: 'abcdefghijklmnopqrstuvwxyz012345',
  kind: 'KEY_REFERENCE' as const,
  version: 4,
  fields: { alias: 'primary', algorithm: 'SM2', fingerprint: 'abc', enabled: 'true' }
};
const create = (mode: 'keys' | 'device-keys' | 'key-associations' = 'keys', manage = true) =>
  mount(DeviceKeys, { props: { mode, manage }, global: { plugins: [ElementPlus] } });
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(listDeviceKeys).mockResolvedValue({ rows: [device], total: 1, page: 1, size: 20 });
  vi.mocked(api.resources).mockImplementation(async (kind) => ({
    rows: kind === 'KEY_REFERENCE' ? [key] : [],
    total: kind === 'KEY_REFERENCE' ? 1 : 0,
    page: 1,
    size: 20
  }));
  vi.mocked(certApi.list).mockResolvedValue({ rows: [], total: 0, page: 1, size: 20 });
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm');
});
it('registers a selected public device reference with reason and confirmation', async () => {
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  vm.draft.fields.alias = 'primary';
  vm.selectAlias('primary');
  await flushPromises();
  expect(vm.valid).toBe(false);
  vm.reason = '登记已有签名密钥';
  await flushPromises();
  expect(vm.valid).toBe(true);
  vi.mocked(api.maintain).mockResolvedValue(key);
  await vm.save();
  expect(ElMessageBox.confirm).toHaveBeenCalled();
  expect(api.maintain).toHaveBeenCalledWith(
    expect.objectContaining({ version: 0, fields: { alias: 'primary', algorithm: 'SM2', fingerprint: 'abc', enabled: 'true' } }),
    '登记已有签名密钥'
  );
  w.unmount();
});
it('retains version and dialog on conflict and cannot register an unreadable device', async () => {
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit(key);
  vm.reason = '停用引用';
  vm.draft.fields.enabled = 'false';
  vi.mocked(api.maintain).mockRejectedValue(new Error('版本冲突'));
  await vm.save();
  expect(vm.dialog).toBe(true);
  expect(vm.error).toBe('版本冲突');
  expect(api.maintain).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }), '停用引用');
  vm.edit();
  vm.options = [{ ...device, state: 'UNAVAILABLE', fingerprint: '' }];
  vm.draft.fields.alias = 'primary';
  vm.selectAlias('primary');
  vm.reason = '尝试登记';
  await flushPromises();
  expect(vm.valid).toBe(false);
  w.unmount();
});
it('fails closed when directory loading fails and hides registration from read-only callers', async () => {
  vi.mocked(listDeviceKeys).mockRejectedValue(new Error('设备目录不可用'));
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  expect(vm.dialog).toBe(false);
  expect(vm.ready).toBe(false);
  w.unmount();
  const readonly = create('device-keys', false);
  await flushPromises();
  expect(readonly.text()).not.toContain('登记引用');
  readonly.unmount();
});
it('includes unbound certificates and resources beyond the first page in associations', async () => {
  vi.mocked(api.resources).mockImplementation(async (kind, page = 1) => ({
    rows: kind === 'KEY_REFERENCE' ? [{ ...key, id: page === 1 ? key.id : 'second-key' }] : [],
    total: kind === 'KEY_REFERENCE' ? 2 : 0,
    page,
    size: 1
  }));
  vi.mocked(certApi.list).mockResolvedValue({
    rows: [{ id: 'cert', keyId: key.id, subject: 'CN=unbound signer', serial: '123', status: 'ACTIVE', notAfter: '2099-01-01', version: 2 }],
    total: 1,
    page: 1,
    size: 20
  });
  const w = create('key-associations');
  await flushPromises();
  expect(api.resources).toHaveBeenCalledWith('KEY_REFERENCE', 2);
  expect(w.text()).toContain('CN=unbound signer');
  expect((w.vm as any).associations).toHaveLength(2);
  w.unmount();
});
