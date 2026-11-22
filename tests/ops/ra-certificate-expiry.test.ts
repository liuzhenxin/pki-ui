// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { expect, it, vi } from 'vitest';
import RaCertificateExpiryPane from '@/views/ops/alert/RaCertificateExpiryPane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

it('renders upcoming and closed RA reminders through the dedicated read API', async () => {
  const initial = {
    sourceId: 'cluster-a',
    certId: '912345678987654321',
    expiresAt: '2026-12-01T07:00:00Z',
    stageDays: 7,
    updatedAt: '2026-11-24T07:00:00Z'
  };
  mocks.request
    .mockResolvedValueOnce({ total: 1, items: [{ ...initial, status: 'OPEN' }] })
    .mockResolvedValueOnce({ total: 1, items: [{ ...initial, status: 'RENEWED' }] });
  const wrapper = mount(RaCertificateExpiryPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain(initial.certId);
    expect(wrapper.text()).toContain('7 天');
    expect(wrapper.text()).toContain('待续期');

    await wrapper.findAll('input[type=radio]')[1].setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain('已续期');
    expect(mocks.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'get',
        url: '/v1/alert/certificate-expiry',
        params: { closed: true, offset: 0, limit: 50 }
      })
    );
  } finally {
    wrapper.unmount();
  }
});
