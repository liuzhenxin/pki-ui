import { expect, test, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
vi.mock('@/api/hsm/ukeys', () => ({
  getUkeyStatus: vi.fn(),
  challengeUkey: vi.fn(),
  configureUkeys: vi.fn(),
  confirmUkey: vi.fn(),
  logoutUkey: vi.fn(),
  revokeUkey: vi.fn()
}));
import Page from '@/views/hsm/ukeys/index.vue';
import { getUkeyStatus } from '@/api/hsm/ukeys';
test('failed refresh clears previously displayed device and authorization', async () => {
  vi.mocked(getUkeyStatus).mockResolvedValueOnce({
    data: {
      device: 'device-before-failure',
      configuration: { administrators: 3, operators: 5, revision: 1 },
      bindings: [],
      hostCertificates: [],
      hostAvailable: true,
      authorization: null,
      auditEvents: []
    }
  } as any);
  const wrapper = shallowMount(Page, {
    global: {
      renderStubDefaultSlot: true,
      plugins: [ElementPlus],
      stubs: { ElTableColumn: { template: '<span />' } },
      directives: { loading: () => {}, hasPermi: () => {} }
    }
  });
  await flushPromises();
  expect(wrapper.text()).toContain('device-before-failure');
  vi.mocked(getUkeyStatus).mockRejectedValueOnce(new Error('disconnected'));
  await (wrapper.vm as any).refresh();
  await flushPromises();
  expect(wrapper.text()).not.toContain('device-before-failure');
  expect((wrapper.vm as any).status).toBeNull();
  wrapper.unmount();
});
