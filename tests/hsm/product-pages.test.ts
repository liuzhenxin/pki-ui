import { beforeEach, expect, test, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
vi.mock('@/plugins/auth', () => ({ default: { hasPermi: vi.fn() } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api/hsm/initialization', () => ({ getInitializationStatus: vi.fn() }));
vi.mock('@/api/hsm/ukeys', () => ({ getUkeyStatus: vi.fn() }));
import auth from '@/plugins/auth';
import { getInitializationStatus } from '@/api/hsm/initialization';
import { getUkeyStatus } from '@/api/hsm/ukeys';
import Home from '@/views/hsm/home/index.vue';
import Audit from '@/views/hsm/audit/index.vue';
const global = {
  renderStubDefaultSlot: true,
  plugins: [ElementPlus],
  stubs: { ElTableColumn: { template: '<span />' } },
  directives: { loading: () => {} }
};
const status = {
  device: 'hsm',
  hostAvailable: true,
  configuration: { administrators: 3, operators: 5, revision: 1 },
  bindings: [],
  authorization: null,
  hostCertificates: [],
  auditEvents: []
};
beforeEach(() => {
  vi.resetAllMocks();
});

test('overview without query grants never calls device endpoints', async () => {
  vi.mocked(auth.hasPermi).mockReturnValue(false);
  const wrapper = shallowMount(Home, { global });
  await flushPromises();
  expect(getInitializationStatus).not.toHaveBeenCalled();
  expect(getUkeyStatus).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain('无查询权限');
  wrapper.unmount();
});
test('partial refresh failure clears stale UKey data while keeping successful initialization', async () => {
  vi.mocked(auth.hasPermi).mockReturnValue(true);
  vi.mocked(getInitializationStatus).mockResolvedValue({ data: { state: 'READY', attemptCount: 1 } } as any);
  vi.mocked(getUkeyStatus).mockResolvedValueOnce({ data: status } as any);
  const wrapper = shallowMount(Home, { global });
  await flushPromises();
  expect(wrapper.text()).toContain('可访问');
  vi.mocked(getUkeyStatus).mockRejectedValueOnce(new Error('offline'));
  await (wrapper.vm as any).refresh();
  expect((wrapper.vm as any).ukeys).toBeNull();
  expect(wrapper.text()).toContain('已就绪');
  expect(wrapper.findComponent({ name: 'ElAlert' }).props('title')).toContain('UKey 身份查询失败');
  expect(wrapper.text()).not.toContain('可访问');
  wrapper.unmount();
});
test('audit filters loaded records, resets pagination and clears records on error', async () => {
  vi.mocked(getUkeyStatus).mockResolvedValueOnce({
    data: {
      ...status,
      auditEvents: [
        { id: 1, operation: 'LOGIN', outcome: 'SUCCESS', userId: 101, occurredAt: '2026-10-11', summary: '操作员登录' },
        { id: 2, operation: 'APPOINT', outcome: 'DENIED', userId: 102, occurredAt: '2026-10-11', summary: '任命拒绝' }
      ]
    }
  } as any);
  const wrapper = shallowMount(Audit, { global });
  await flushPromises();
  const vm = wrapper.vm as any;
  vm.page = 3;
  vm.query = '102';
  await flushPromises();
  expect(vm.page).toBe(1);
  expect(vm.filtered.map((row: any) => row.id)).toEqual([2]);
  vm.outcome = 'SUCCESS';
  await flushPromises();
  expect(vm.filtered).toEqual([]);
  vi.mocked(getUkeyStatus).mockRejectedValueOnce(new Error('offline'));
  await vm.refresh();
  expect(vm.events).toEqual([]);
  expect(wrapper.findComponent({ name: 'ElAlert' }).props('title')).toContain('身份审计查询失败');
  wrapper.unmount();
});
