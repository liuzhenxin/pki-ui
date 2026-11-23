// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import UserDingTalkChannelPane from '@/views/ops/alert/UserDingTalkChannelPane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

function input(wrapper: VueWrapper, label: string) {
  const field = wrapper.findAll('.el-form-item').find((item) => item.get('.el-form-item__label').text() === label);
  if (!field) throw new Error('Missing field ' + label);
  return field.get('input');
}

beforeEach(() => mocks.request.mockReset());

it('updates an existing robot without redisplaying or replacing its saved credentials', async () => {
  const robot = { id: 7, name: '值班群', enabled: true, accessToken: '已配置', secret: '已配置', remark: '' };
  const updated = { ...robot, remark: '演练联系人' };
  mocks.request.mockResolvedValueOnce([robot]).mockResolvedValueOnce(updated).mockResolvedValueOnce([updated]);
  const wrapper = mount(UserDingTalkChannelPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    expect(input(wrapper, '机器人名称').element.value).toBe(robot.name);
    expect(input(wrapper, 'Webhook Access Token').element.value).toBe('');
    expect(input(wrapper, '加签 Secret').element.value).toBe('');
    await input(wrapper, '备注').setValue(updated.remark);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'put',
        url: '/v1/alert/channels/7',
        data: { name: robot.name, enabled: true, accessToken: undefined, secret: undefined, remark: updated.remark }
      })
    );
  } finally {
    wrapper.unmount();
  }
});

it('allows a first user robot to be saved with notifications off', async () => {
  const robot = { id: 2, name: '新群', enabled: false, accessToken: '已配置', remark: '' };
  mocks.request.mockResolvedValueOnce([]).mockResolvedValueOnce(robot).mockResolvedValueOnce([robot]);
  const wrapper = mount(UserDingTalkChannelPane, { global: { plugins: [ElementPlus] } });
  try {
    await flushPromises();
    await input(wrapper, '机器人名称').setValue(robot.name);
    await input(wrapper, 'Webhook Access Token').setValue('mock-robot-token');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'post',
        url: '/v1/alert/channels',
        headers: { sensitive: true, repeatSubmit: false },
        data: { name: robot.name, enabled: false, accessToken: 'mock-robot-token', secret: undefined, remark: '' }
      })
    );
    expect(input(wrapper, 'Webhook Access Token').element.value).toBe('');
  } finally {
    wrapper.unmount();
  }
});
