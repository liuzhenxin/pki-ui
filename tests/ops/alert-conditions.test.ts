// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import AlertConditionPane from '@/views/ops/alert/AlertConditionPane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

const url = '/v1/alert/conditions';
const cpu = { type: 'SERVER_CPU', target: '', triggerPercent: 85, recoveryPercent: 70, triggerSeconds: 300, recoverySeconds: 300 };

beforeEach(() => mocks.request.mockReset());

it('saves a default rule with its revision and handles concurrent modifications', async () => {
  mocks.request
    .mockResolvedValueOnce({ settings: { revision: 0, rules: [] }, servers: ['uat'], editable: true })
    .mockResolvedValueOnce({ revision: 1, rules: [cpu] })
    .mockRejectedValueOnce({ response: { status: 409 } })
    .mockResolvedValueOnce({ settings: { revision: 2, rules: [] }, servers: ['uat'], editable: true });

  const wrapper = mount(AlertConditionPane, { global: { plugins: [ElementPlus] } });
  const button = (label: string) => wrapper.findAll('button').find((node) => node.text() === label)!;
  try {
    await flushPromises();
    await button('新增条件').trigger('click');
    await flushPromises();
    await button('保存').trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ url, method: 'put', data: { revision: 0, rules: [cpu] } }));
    expect(wrapper.text()).toContain('≥ 85% 持续 300 秒');

    await button('编辑').trigger('click');
    await flushPromises();
    await button('保存').trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(3, expect.objectContaining({ url, method: 'put', data: { revision: 1, rules: [cpu] } }));
    expect(button('新增条件').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('请刷新后重新编辑');
    await button('刷新').trigger('click');
    await flushPromises();
    expect(button('新增条件').attributes('disabled')).toBeUndefined();
  } finally {
    wrapper.unmount();
  }
});

it('renders configured thresholds for an operator with read access only', async () => {
  mocks.request.mockResolvedValueOnce({ settings: { revision: 1, rules: [cpu] }, servers: ['uat'], editable: false });
  const wrapper = mount(AlertConditionPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain('≤ 70% 持续 300 秒');
    expect(wrapper.text()).not.toContain('新增条件');
    expect(wrapper.text()).not.toContain('删除');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  } finally {
    wrapper.unmount();
  }
});

it('shows CA and KMC password-device conditions separately', async () => {
  const settings = {
    revision: 1,
    rules: [
      { type: 'CA_HSM', target: 'ca-a/primary', triggerSamples: 2, recoverySamples: 2, timeoutSeconds: 90 },
      { type: 'KMC_HSM', target: 'kmc-a/primary', triggerSamples: 1, recoverySamples: 2, timeoutSeconds: 90 }
    ]
  };
  mocks.request.mockResolvedValueOnce({ settings, servers: [], editable: false });
  const wrapper = mount(AlertConditionPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    const rows = wrapper.findAll('tbody tr').map((row) => row.text());
    expect(rows[0]).toContain('CA 密码机');
    expect(rows[0]).toContain('ca-a/primary');
    expect(rows[1]).toContain('KMC 密码机');
    expect(rows[1]).toContain('kmc-a/primary');
  } finally {
    wrapper.unmount();
  }
});
