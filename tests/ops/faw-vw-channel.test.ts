// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ElementPlus, { ElMessageBox, ElSelect } from 'element-plus';
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
  from: null,
  to: 'test.user',
  app: 'fawvw',
  dingTalkTarget: 'ACCOUNT',
  smtpServer: null,
  messageType: 'markdown',
  credentialsConfigured: true
};

describe('OPS FAW-VW channel form', () => {
  beforeEach(() => mocks.request.mockReset());

  it('saves enterprise recipients without per-channel credentials or an endpoint override', async () => {
    mocks.request.mockResolvedValueOnce({ settings: null }).mockResolvedValueOnce({ settings: saved });
    const wrapper = mount(FawVwChannelPane, {
      props: { kind: 'FAW_VW_DINGTALK', editable: true, gatewayConfigured: true },
      global: { plugins: [ElementPlus] }
    });
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: 'get', url: '/v1/alert/faw-vw-channels/FAW_VW_DINGTALK' }));
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '发送测试消息')
        ?.attributes('disabled')
    ).toBeDefined();

    await input(wrapper, '钉钉收件人').setValue(saved.to);
    const typeSelect = wrapper.findAllComponents(ElSelect).at(-1)!;
    expect(typeSelect.props('modelValue')).toBe('markdown');
    typeSelect.vm.$emit('update:modelValue', 'text');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'put',
        url: '/v1/alert/faw-vw-channels/FAW_VW_DINGTALK',
        headers: { sensitive: true, repeatSubmit: false },
        data: {
          revision: null,
          enabled: false,
          from: null,
          to: saved.to,
          app: 'fawvw',
          dingTalkTarget: 'ACCOUNT',
          smtpServer: null,
          messageType: 'text'
        }
      })
    );
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('requires a refresh on a stale edit and keeps targets encoding out of the form', async () => {
    const email: FawVwChannelSettings = {
      ...saved,
      from: 'alerts@example.test',
      to: 'oncall@example.test',
      app: null,
      dingTalkTarget: null,
      messageType: 'MIXED'
    };
    mocks.request
      .mockResolvedValueOnce({ settings: email })
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValueOnce({ settings: { ...email, revision: 'other-revision' } });
    const wrapper = mount(FawVwChannelPane, {
      props: { kind: 'FAW_VW_EMAIL', editable: true, gatewayConfigured: true },
      global: { plugins: [ElementPlus] }
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('targets 编码');
    expect(input(wrapper, '发件邮箱').element.value).toBe(email.from);
    expect(wrapper.text()).toContain('TEXT（纯文本）');
    expect(wrapper.findAllComponents(ElSelect)).toHaveLength(1);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'put',
        data: expect.objectContaining({ revision: email.revision, from: email.from, to: email.to, messageType: 'TEXT' })
      })
    );
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刷新配置')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('probes and explicitly confirms a test send to the saved enterprise DingTalk recipients', async () => {
    mocks.request
      .mockResolvedValueOnce({ settings: saved })
      .mockResolvedValueOnce({ message: '企业钉钉网关已响应（HTTP 405），未验证凭据' })
      .mockResolvedValueOnce({ message: '企业钉钉网关已接受测试消息' });
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm');
    const wrapper = mount(FawVwChannelPane, {
      props: { kind: 'FAW_VW_DINGTALK', editable: true, gatewayConfigured: true },
      global: { plugins: [ElementPlus] }
    });
    const button = (text: string) => wrapper.findAll('button').find((candidate) => candidate.text() === text)!;
    try {
      await flushPromises();
      await input(wrapper, '钉钉收件人').setValue('unsaved.user');
      expect(button('测试连接').attributes('disabled')).toBeDefined();
      expect(button('发送测试消息').attributes('disabled')).toBeDefined();
      expect(mocks.request).toHaveBeenCalledTimes(1);

      await input(wrapper, '钉钉收件人').setValue(saved.to);
      await button('测试连接').trigger('click');
      await flushPromises();
      expect(mocks.request).toHaveBeenCalledTimes(2);
      expect(mocks.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/v1/alert/faw-vw-channels/FAW_VW_DINGTALK/test-connection',
          data: { revision: saved.revision }
        })
      );
      expect(wrapper.text()).toContain('企业钉钉网关已响应（HTTP 405），未验证凭据');
      await button('发送测试消息').trigger('click');
      await flushPromises();
      expect(mocks.request).toHaveBeenCalledTimes(2);
      await button('发送测试消息').trigger('click');
      await flushPromises();
      expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining(saved.to), '试发企业钉钉', expect.any(Object));
      expect(mocks.request).toHaveBeenLastCalledWith(
        expect.objectContaining({ method: 'post', url: '/v1/alert/faw-vw-channels/FAW_VW_DINGTALK/test-send', data: { revision: saved.revision } })
      );
      expect(wrapper.text()).toContain('企业钉钉网关已接受测试消息');
      expect(wrapper.text()).toContain('未启用');
    } finally {
      wrapper.unmount();
      confirm.mockRestore();
    }
  });

  it('probes and sends only with saved enterprise mail settings and explicit send confirmation', async () => {
    const email: FawVwChannelSettings = {
      ...saved,
      from: 'alerts@example.test',
      to: 'oncall@example.test',
      app: null,
      dingTalkTarget: null,
      messageType: 'TEXT'
    };
    mocks.request
      .mockResolvedValueOnce({ settings: email })
      .mockResolvedValueOnce({ message: '网关已响应' })
      .mockResolvedValueOnce({ message: '网关已接受测试邮件' });
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm');
    const wrapper = mount(FawVwChannelPane, {
      props: { kind: 'FAW_VW_EMAIL', editable: true, gatewayConfigured: true },
      global: { plugins: [ElementPlus] }
    });
    const button = (text: string) => wrapper.findAll('button').find((candidate) => candidate.text() === text)!;
    try {
      await flushPromises();
      await input(wrapper, '收件邮箱').setValue('unsaved@example.test');
      expect(button('测试连接').attributes('disabled')).toBeDefined();
      expect(button('试发邮件').attributes('disabled')).toBeDefined();
      await input(wrapper, '收件邮箱').setValue(email.to);

      await button('测试连接').trigger('click');
      await flushPromises();
      expect(mocks.request).toHaveBeenLastCalledWith(
        expect.objectContaining({ method: 'post', url: '/v1/alert/faw-vw-channels/FAW_VW_EMAIL/test-connection', data: { revision: email.revision } })
      );
      expect(wrapper.text()).toContain('网关已响应');

      await button('试发邮件').trigger('click');
      await flushPromises();
      expect(mocks.request).toHaveBeenCalledTimes(2);
      await button('试发邮件').trigger('click');
      await flushPromises();

      expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining(email.to), '试发企业邮件', expect.any(Object));
      expect(mocks.request).toHaveBeenLastCalledWith(
        expect.objectContaining({ method: 'post', url: '/v1/alert/faw-vw-channels/FAW_VW_EMAIL/test-send', data: { revision: email.revision } })
      );
      expect(wrapper.text()).toContain('网关已接受测试邮件');
      expect(wrapper.text()).toContain('未启用');
    } finally {
      wrapper.unmount();
      confirm.mockRestore();
    }
  });
});
