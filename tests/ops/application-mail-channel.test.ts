// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { expect, it, vi } from 'vitest';
import ApplicationMailChannelPane from '@/views/ops/alert/ApplicationMailChannelPane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

it('manages the RA SMTP grant without making a send request', async () => {
  const settings = {
    revision: 'fixture-1',
    host: 'smtp.example.invalid',
    port: 465,
    tls: 'TLS',
    username: 'ra',
    from: 'ra@example.invalid',
    enabled: false
  };
  mocks.request.mockResolvedValueOnce({ settings, identityConfigured: true }).mockResolvedValueOnce({
    settings: { ...settings, revision: 'fixture-2', enabled: true },
    identityConfigured: true
  });
  const wrapper = mount(ApplicationMailChannelPane, { global: { plugins: [ElementPlus] } });

  try {
    await flushPromises();
    await wrapper.get('[role="switch"]').trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'put',
        url: '/v1/application-notifications/ra/mail',
        data: { settings: { ...settings, enabled: true }, password: '' }
      })
    );
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('RA 邮件渠道与授权已保存');
  } finally {
    wrapper.unmount();
  }
});
