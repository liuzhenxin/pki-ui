// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import OpsAlertCenter from '@/views/ops/alert/index.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

it('shows enterprise and user DingTalk alongside the mail and existing alert-rule workflows', async () => {
  mocks.request.mockImplementation(async ({ url }) => {
    switch (url) {
      case '/v1/alert/incidents':
        return { enabled: true, items: [] };
      case '/v1/alert/channels':
        return [{ id: 1, name: '值班群机器人', enabled: false }];
      case '/v1/alert/rules':
        return [];
      case '/v1/alert/faw-vw-channels/gateway':
        return { settings: { origin: 'https://mock.invalid', revision: null }, editable: false };
      default:
        return { settings: null };
    }
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: OpsAlertCenter }] });
  await router.push('/');
  const wrapper = mount(OpsAlertCenter, { global: { plugins: [ElementPlus, router] } });
  const requested = (url: string) => expect.objectContaining({ url, method: 'get' });
  const tab = (name: string) => wrapper.get(`#tab-${name}`);

  try {
    await flushPromises();
    expect(wrapper.find('#tab-faw-vw').exists()).toBe(false);
    expect(tab('channels').text()).toBe('钉钉渠道');
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_DINGTALK'));
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('channels').trigger('click');
    await flushPromises();
    const dingTalk = wrapper.get('#pane-channels');
    expect(dingTalk.findAll('form')).toHaveLength(2);
    expect(dingTalk.text()).toContain('企业钉钉');
    expect(dingTalk.text()).toContain('用户钉钉');
    expect(dingTalk.text()).toContain('Webhook Access Token');
    expect(dingTalk.text()).not.toContain('新建渠道');
    expect(dingTalk.text()).not.toContain('企业邮件');
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/channels'));
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_DINGTALK'));
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('mail').trigger('click');
    await flushPromises();
    const mail = wrapper.get('#pane-mail');
    expect(mail.text()).toContain('SMTP 主机');
    expect(mail.text()).toContain('企业邮件');
    expect(mail.text()).not.toContain('企业钉钉');
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/mail-channel'));
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('enterprise-gateway').trigger('click');
    await flushPromises();
    const gateway = wrapper.get('#pane-enterprise-gateway');
    expect(gateway.get('input').element.value).toBe('https://mock.invalid');
    expect(gateway.get('input').attributes('readonly')).toBeDefined();
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/gateway'));

    await tab('rules').trigger('click');
    await flushPromises();
    await wrapper.get('#pane-rules .toolbar button').trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/channels'));
    const ruleDialog = wrapper.findAll('[role="dialog"]').find((dialog) => dialog.text().includes('新建规则'));
    expect(ruleDialog?.text()).toContain('值班群机器人');
    expect(mocks.request.mock.calls.every(([request]) => request.method === 'get')).toBe(true);
  } finally {
    wrapper.unmount();
  }
});
