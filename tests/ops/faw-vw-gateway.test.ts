// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import FawVwGatewayPane from '@/views/ops/alert/FawVwGatewayPane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

const gatewayUrl = '/v1/alert/faw-vw-channels/gateway';
const defaults = { origin: 'https://compose.example.test', revision: null, credentialsConfigured: false };

beforeEach(() => {
  mocks.request.mockReset();
});

it('uses the Compose default, displays the saved address, and prevents stale saves until refresh', async () => {
  const saved = { origin: 'https://managed.example.test', revision: 'saved-revision', credentialsConfigured: true };
  mocks.request
    .mockResolvedValueOnce({ settings: defaults, editable: true })
    .mockResolvedValueOnce({ settings: saved, editable: true })
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValueOnce({
      settings: { origin: 'https://latest.example.test', revision: 'latest-revision', credentialsConfigured: true },
      editable: true
    });
  const wrapper = mount(FawVwGatewayPane, { global: { plugins: [ElementPlus], stubs: { FawVwChannelPane: true } } });
  try {
    await flushPromises();
    const field = wrapper.get('input');
    expect(field.element.value).toBe(defaults.origin);
    expect(wrapper.text()).toContain('Compose 默认值');
    const keys = wrapper.findAll('input[type="password"]');
    expect(keys).toHaveLength(2);
    await field.setValue(saved.origin + '/');
    await keys[0].setValue('test-access');
    await wrapper.get('form').trigger('submit');
    expect(mocks.request).toHaveBeenCalledTimes(1);
    await keys[1].setValue('test-secret');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: gatewayUrl,
        method: 'put',
        headers: { sensitive: true, repeatSubmit: false },
        data: { origin: saved.origin + '/', revision: null, accessKey: 'test-access', secretKey: 'test-secret' }
      })
    );
    expect(field.element.value).toBe(saved.origin);
    expect(keys.map((key) => key.element.value)).toEqual(['', '']);
    expect(wrapper.text()).not.toContain('Compose 默认值');

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: 'put', data: { origin: saved.origin, revision: saved.revision, accessKey: undefined, secretKey: undefined } })
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
  const wrapper = mount(FawVwGatewayPane, { global: { plugins: [ElementPlus], stubs: { FawVwChannelPane: true } } });
  try {
    await flushPromises();
    expect(wrapper.get('input').attributes('readonly')).toBeDefined();
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    await wrapper.get('form').trigger('submit');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  } finally {
    wrapper.unmount();
  }
});

it('keeps unsaved DingTalk recipients when switching enterprise channel tabs without writing or sending', async () => {
  mocks.request.mockImplementation(async ({ url }) =>
    url === gatewayUrl ? { settings: defaults, editable: true } : { settings: { revision: null, enabled: false, to: '' } }
  );
  const wrapper = mount(FawVwGatewayPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    const recipient = wrapper.get('input[placeholder="多个账号或工号用英文逗号分隔"]');
    await recipient.setValue('mock-user');
    const tab = (name: string) => wrapper.findAll('[role="tab"]').find((item) => item.text() === name)!;
    await tab('企业邮件').trigger('click');
    expect(tab('企业邮件').attributes('aria-selected')).toBe('true');
    await tab('企业钉钉').trigger('click');
    expect((recipient.element as HTMLInputElement).value).toBe('mock-user');
    expect(mocks.request.mock.calls.every(([request]) => request.method === 'get')).toBe(true);
  } finally {
    wrapper.unmount();
  }
});
