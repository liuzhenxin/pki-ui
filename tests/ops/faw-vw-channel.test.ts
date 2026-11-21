// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FawVwChannelPane from '@/views/ops/alert/FawVwChannelPane.vue';
import type { FawVwChannelSettings } from '@/api/ops/types';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

function input(wrapper: VueWrapper, label: string) {
  const field = wrapper.findAll('.el-form-item').find((item) => item.find('.el-form-item__label').text() === label);
  if (!field) throw new Error('Missing field ' + label);
  return field.get('input');
}

const saved: FawVwChannelSettings = {
  revision: 'updated-revision',
  enabled: false,
  endpointUrl: 'https://mock.invalid/notify',
  from: null,
  to: 'test.user',
  app: 'fawvw',
  dingTalkTarget: 'ACCOUNT',
  smtpServer: null,
  targetsFormat: null,
  credentialsConfigured: true
};

describe('OPS FAW-VW channel form', () => {
  beforeEach(() => mocks.request.mockReset());

  it('saves new credentials in a sensitive request and clears password fields after save', async () => {
    mocks.request.mockResolvedValueOnce({ settings: null }).mockResolvedValueOnce({ settings: saved });
    const wrapper = mount(FawVwChannelPane, { props: { kind: 'FAW_VW_DINGTALK' }, global: { plugins: [ElementPlus] } });
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: 'get', url: '/v1/alert/faw-vw-channels/FAW_VW_DINGTALK' }));
    expect(wrapper.text()).not.toContain('试发');

    await input(wrapper, '接口 URL').setValue(saved.endpointUrl);
    await input(wrapper, '钉钉收件人').setValue(saved.to);
    await input(wrapper, 'Access Key').setValue('dummy-access');
    await input(wrapper, 'Secret Key').setValue('dummy-secret');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'put',
        url: '/v1/alert/faw-vw-channels/FAW_VW_DINGTALK',
        headers: { sensitive: true, repeatSubmit: false },
        data: {
          settings: expect.objectContaining({ endpointUrl: saved.endpointUrl, to: saved.to, enabled: false, revision: null }),
          accessKey: 'dummy-access',
          secretKey: 'dummy-secret'
        }
      })
    );
    expect(input(wrapper, 'Access Key').element.value).toBe('');
    expect(input(wrapper, 'Secret Key').element.value).toBe('');
    expect(input(wrapper, 'Secret Key').attributes('placeholder')).toBe('已配置，留空保留');
    wrapper.unmount();
  });

  it('keeps configured credentials blank and requires a refresh on a stale edit', async () => {
    const email: FawVwChannelSettings = {
      ...saved,
      from: 'alerts@example.test',
      to: 'oncall@example.test',
      app: null,
      dingTalkTarget: null,
      targetsFormat: 'JSON_ARRAY_STRING'
    };
    mocks.request
      .mockResolvedValueOnce({ settings: email })
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValueOnce({ settings: { ...email, revision: 'other-revision' } });
    const wrapper = mount(FawVwChannelPane, { props: { kind: 'FAW_VW_EMAIL' }, global: { plugins: [ElementPlus] } });
    await flushPromises();
    expect(wrapper.text()).toContain('targets 编码');
    expect(input(wrapper, '发件邮箱').element.value).toBe(email.from);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'put',
        data: {
          settings: expect.objectContaining({ revision: email.revision, targetsFormat: 'JSON_ARRAY_STRING' }),
          accessKey: undefined,
          secretKey: undefined
        }
      })
    );
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刷新配置')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    expect(input(wrapper, 'Access Key').element.value).toBe('');
    wrapper.unmount();
  });
});
