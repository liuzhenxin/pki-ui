// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import OpsAlertCenter from '@/views/ops/alert/index.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

it('keeps standard channels on their tabs and loads both enterprise channels only in the enterprise gateway', async () => {
  mocks.request.mockImplementation(async ({ url }) => {
    switch (url) {
      case '/v1/alert/incident-template-rules':
        return { notificationsEnabled: false, sources: [], channels: [], bindings: [], editable: true };
      case '/v1/alert/incidents':
        return { enabled: true, items: [] };
      case '/v1/alert/conditions':
        return { settings: { revision: 0, rules: [] }, servers: [], editable: true };
      case '/v1/alert/channels':
        return [{ id: 1, name: '值班群机器人', enabled: false }];
      case '/v1/alert/logs':
      case '/v1/alert/rules':
        return [];
      case '/v1/alert/faw-vw-channels/gateway':
        return {
          settings: {
            emailServerUrl: 'https://mock.invalid/mail',
            dingtalkServerUrl: 'https://mock.invalid/dingtalk',
            revision: null,
            credentialsConfigured: false
          },
          editable: false
        };
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
    expect(wrapper.get('.workspace-header').text()).toContain('自动通知已关闭');
    expect(wrapper.get('.record-actions').text()).toContain('管理通知规则');
    expect(wrapper.find('#tab-faw-vw').exists()).toBe(false);
    expect(tab('monitor').text()).toBe('告警监控');
    expect(tab('records').text()).toBe('告警记录');
    const historyButton = wrapper.findAll('label').find((label) => label.text() === '告警历史');
    await historyButton!.get('input').setValue(true);
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/v1/alert/incidents', params: expect.objectContaining({ recovered: true }) })
    );
    await wrapper
      .get('nav[aria-label="告警工作区"]')
      .findAll('button')
      .find((button) => button.text().includes('服务事件日志'))!
      .trigger('click');
    await flushPromises();
    expect(tab('logs').attributes('aria-selected')).toBe('true');
    await tab('config').trigger('click');
    expect(tab('channels').text()).toBe('通知渠道');
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_DINGTALK'));
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('channels').trigger('click');
    await flushPromises();
    const dingTalk = wrapper.get('#pane-user-dingtalk');
    expect(dingTalk.findAll('form')).toHaveLength(1);
    expect(dingTalk.text()).not.toContain('企业钉钉');
    expect(dingTalk.text()).toContain('用户钉钉');
    expect(dingTalk.text()).toContain('Webhook Access Token');
    expect(dingTalk.text()).not.toContain('新建渠道');
    expect(dingTalk.text()).not.toContain('企业邮件');
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/channels'));
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_DINGTALK'));
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('mail').trigger('click');
    await flushPromises();
    const mail = wrapper.get('#pane-mail');
    expect(mail.text()).toContain('SMTP 主机');
    expect(mail.text()).not.toContain('企业邮件');
    expect(mail.text()).not.toContain('企业钉钉');
    expect(mail.text()).not.toContain('授权 RA 使用此 SMTP 渠道');
    expect(mail.text()).not.toContain('请先登记 RA 业务邮件服务账号');
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/mail-channel'));
    expect(mocks.request).not.toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('enterprise-gateway').trigger('click');
    await flushPromises();
    const gateway = wrapper.get('#pane-enterprise-gateway');
    expect(
      gateway
        .findAll('input')
        .slice(0, 2)
        .map((input) => input.element.value)
    ).toEqual(['https://mock.invalid/mail', 'https://mock.invalid/dingtalk']);
    expect(gateway.get('input').attributes('readonly')).toBeDefined();
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/gateway'));
    expect(gateway.text()).toContain('企业钉钉');
    expect(gateway.text()).toContain('企业邮件');
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_DINGTALK'));
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/faw-vw-channels/FAW_VW_EMAIL'));

    await tab('rules').trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建规则')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '自定义服务事件')!
      .trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(requested('/v1/alert/channels'));
    const ruleDialog = wrapper.findAll('[role="dialog"]').find((dialog) => dialog.text().includes('新建自定义服务事件'));
    expect(ruleDialog?.text()).toContain('值班群机器人');
    expect(mocks.request).not.toHaveBeenCalledWith(expect.objectContaining({ url: '/v1/application-notifications/ra/mail' }));
    expect(mocks.request.mock.calls.every(([request]) => request.method === 'get')).toBe(true);
  } finally {
    wrapper.unmount();
  }
});
