// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import FawVwGatewayPane from '@/views/ops/alert/FawVwGatewayPane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

const gatewayUrl = '/v1/alert/faw-vw-channels/gateway';
const defaults = { origin: 'https://compose.example.test', revision: null };

beforeEach(() => mocks.request.mockReset());

it('uses the Compose default, displays the saved address, and prevents stale saves until refresh', async () => {
  const saved = { origin: 'https://managed.example.test', revision: 'saved-revision' };
  mocks.request
    .mockResolvedValueOnce({ settings: defaults, editable: true })
    .mockResolvedValueOnce({ settings: saved, editable: true })
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValueOnce({ settings: { origin: 'https://latest.example.test', revision: 'latest-revision' }, editable: true });
  const wrapper = mount(FawVwGatewayPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    const field = wrapper.get('input');
    expect(field.element.value).toBe(defaults.origin);
    expect(wrapper.text()).toContain('Compose 默认值');
    await field.setValue(saved.origin + '/');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ url: gatewayUrl, method: 'put', data: { origin: saved.origin + '/', revision: null } })
    );
    expect(field.element.value).toBe(saved.origin);
    expect(wrapper.text()).not.toContain('Compose 默认值');

    await field.setValue(defaults.origin);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: 'put', data: { origin: defaults.origin, revision: saved.revision } })
    );
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刷新配置')!
      .trigger('click');
    await flushPromises();
    expect(field.element.value).toBe('https://latest.example.test');
  } finally {
    wrapper.unmount();
  }
});

it('shows the current origin read-only and never saves for a viewer', async () => {
  mocks.request.mockResolvedValueOnce({ settings: defaults, editable: false });
  const wrapper = mount(FawVwGatewayPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    expect(wrapper.get('input').attributes('readonly')).toBeDefined();
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
    await wrapper.get('form').trigger('submit');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  } finally {
    wrapper.unmount();
  }
});
