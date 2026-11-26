// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus, { ElMessageBox } from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import IncidentTemplateRulePane from '@/views/ops/alert/IncidentTemplateRulePane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

const base = '/v1/alert/incident-template-rules';
const templates = '/v1/alert/notification-templates';
const ding = { name: 'shift-bot', channel: 'DINGTALK', templateChannels: ['DINGTALK'] };
const enterpriseDing = { name: 'ui:enterprise-dingtalk', channel: 'FAW_VW_DINGTALK', templateChannels: ['FAW_VW_DINGTALK'], recipient: 'ra.fixture' };
const mail = { name: 'corp-mail', channel: 'FAW_VW_EMAIL', templateChannels: ['FAW_VW_EMAIL', 'EMAIL'], recipient: 'ops@example.invalid' };

beforeEach(() => {
  mocks.request.mockReset();
  mocks.request.mockImplementation(async ({ url, method, data }) => {
    if (url === base) {
      return {
        editable: true,
        notificationsEnabled: false,
        cpuRoutes: [{ channel: 'corp-mail', phase: 'TRIGGERED', objectPrefix: 'demo-', deploymentTemplate: true }],
        sources: [
          { source: 'SERVER_CPU', application: 'OPS', trigger: 'SYSTEM_TRIGGERED', recovery: 'SYSTEM_RECOVERED' },
          { source: 'RA_CERT_EXPIRY', application: 'RA', trigger: 'CERT_EXPIRY', recovery: null }
        ],
        channels: [ding, mail, { name: 'smtp-demo', channel: 'EMAIL', templateChannels: ['EMAIL'], recipient: 'receiver@example.invalid' }],
        bindings: [{ source: 'SERVER_CPU', channel: 'smtp-demo', triggerChannel: 'EMAIL', recoveryChannel: 'EMAIL', revision: 'cpu-test' }]
      };
    }
    if (url === '/v1/alert/conditions') {
      return {
        settings: {
          rules: [
            { type: 'SERVER_CPU', target: '', triggerPercent: 85, triggerSeconds: 300, recoveryPercent: 70, recoverySeconds: 180 },
            { type: 'SERVER_CPU', target: 'cpu-demo', triggerPercent: 90, triggerSeconds: 10, recoveryPercent: 65, recoverySeconds: 10 },
            { type: 'SERVER_CPU', target: 'node-2', triggerPercent: 98, triggerSeconds: 600, recoveryPercent: 70, recoverySeconds: 180 },
            { type: 'RA_CERT_EXPIRY', target: 'ra-fixture', expiryDays: [30, 7, 1] }
          ]
        }
      };
    }
    if (url === templates + '/catalog') {
      return {
        applications: [
          {
            value: 'OPS',
            scenes: [
              { value: 'SYSTEM_TRIGGERED', label: '系统告警触发' },
              { value: 'SYSTEM_RECOVERED', label: '系统告警恢复' }
            ]
          },
          { value: 'RA', scenes: [{ value: 'CERT_EXPIRY', label: '证书到期提醒' }] }
        ],
        channels: [
          { value: 'FAW_VW_EMAIL', label: '企业邮件' },
          { value: 'EMAIL', label: '邮件（SMTP）' },
          { value: 'DINGTALK', label: '群机器人' }
        ]
      };
    }
    if (url.startsWith(templates) && method === 'get') return { title: '告警 {{object}}', body: '示例正文' };
    if (url.endsWith('/preview') && method === 'post') return { title: '告警 示例服务器', body: '模拟详情' };
    if (url === base + '/delivery-settings' && method === 'put') return { enabled: data.enabled, revision: 'switch-r2' };
    if (url.startsWith(base) && method === 'put') {
      const source = url.slice(base.length + 1);
      return Object.entries(data).map(([channel, edit]) => ({ source, channel, ...(edit as object), revision: 'r1' }));
    }
    throw new Error('Unexpected fixture request');
  });
});

async function openEditor() {
  const wrapper = mount(IncidentTemplateRulePane, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        ElSelect: {
          props: ['modelValue', 'disabled'],
          emits: ['update:modelValue', 'change'],
          template:
            '<select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><slot /></select>'
        },
        ElOption: { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' }
      }
    }
  });
  await flushPromises();
  await wrapper.get('.rule-toolbar button').trigger('click');
  await flushPromises();
  return wrapper;
}

it('shows the live CPU thresholds and saves separate trigger and recovery templates for the edited channel', async () => {
  const wrapper = await openEditor();
  try {
    expect(wrapper.text()).toContain('≥ 85% 持续 300 秒');
    expect(wrapper.text()).toContain('≤ 70% 持续 180 秒');
    const boxes = wrapper.findAll('input[type=checkbox]');
    expect(boxes).toHaveLength(3);
    await boxes[0].setValue(true);
    await boxes[2].setValue(false);
    const row = wrapper.findAll('.channel-rule')[1];
    expect(row.text()).toContain('ops@example.invalid');
    const trigger = row.get('select[aria-label="corp-mail 触发模板"]');
    const recovery = row.get('select[aria-label="corp-mail 恢复模板"]');
    expect(trigger.text()).toContain('系统告警触发 · 企业邮件');
    expect(recovery.text()).toContain('系统告警恢复 · 邮件（SMTP）');
    await trigger.setValue('FAW_VW_EMAIL');
    await recovery.setValue('EMAIL');
    await row.findAll('button')[0].trigger('click');
    await flushPromises();
    expect(wrapper.get('[aria-label="模拟预览结果"]').text()).toContain('告警 示例服务器');
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${templates}/OPS/SYSTEM_TRIGGERED/FAW_VW_EMAIL/preview`, method: 'post' })
    );
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存渠道配置')!
      .trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${base}/SERVER_CPU`,
        method: 'put',
        data: {
          'corp-mail': { enabled: true, triggerChannel: 'FAW_VW_EMAIL', recoveryChannel: 'EMAIL', revision: null },
          'shift-bot': { enabled: true, triggerChannel: 'DINGTALK', recoveryChannel: 'DINGTALK', revision: null },
          'smtp-demo': { enabled: false, triggerChannel: 'EMAIL', recoveryChannel: 'EMAIL', revision: 'cpu-test' }
        }
      })
    );
    expect(wrapper.findAll<HTMLInputElement>('input[type=checkbox]').map((box) => box.element.checked)).toEqual([true, true, false]);
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '保存渠道配置')!
        .attributes('disabled')
    ).toBeDefined();
    expect(mocks.request.mock.calls.filter(([request]) => request.method === 'put')).toHaveLength(1);
    expect(mocks.request.mock.calls.filter(([request]) => request.method === 'post').every(([request]) => request.url.endsWith('/preview'))).toBe(
      true
    );
  } finally {
    wrapper.unmount();
  }
});

it('uses reported RA recipients, hides recovery and restricts normal group robot delivery', async () => {
  const wrapper = await openEditor();
  try {
    await wrapper.get('select[aria-label="告警类型"]').setValue('RA_CERT_EXPIRY');
    await flushPromises();
    expect(wrapper.text()).toContain('ra-fixture');
    expect(wrapper.text()).toContain('到期前 30 天、到期前 7 天、到期前 1 天');
    expect(wrapper.text()).toContain('收件人使用 RA 上报的证书使用者');
    expect(wrapper.text()).not.toContain('ops@example.invalid');
    expect(wrapper.findAll('input[type=checkbox]')).toHaveLength(2);
    await wrapper.get('input[type=checkbox]').setValue(true);
    expect(wrapper.find('select[aria-label="corp-mail 恢复模板"]').exists()).toBe(false);
    await wrapper.get('select[aria-label="corp-mail 触发模板"]').setValue('FAW_VW_EMAIL');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存渠道配置')!
      .trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${base}/RA_CERT_EXPIRY`,
        method: 'put',
        data: { 'corp-mail': { enabled: true, triggerChannel: 'FAW_VW_EMAIL', recoveryChannel: null, revision: null } }
      })
    );
  } finally {
    wrapper.unmount();
  }
});

it('simulates CPU transitions for the selected resource and draft without saving or sending', async () => {
  const wrapper = await openEditor();
  try {
    const panel = wrapper.get('[aria-label="CPU 模拟匹配结果"]');
    expect(panel.text()).toContain('类型默认条件');
    expect(panel.text()).toContain('命中触发条件');
    expect(panel.text()).toContain('使用部署模板');
    expect(panel.text()).toContain('自动通知已关闭');
    await wrapper.get('select[aria-label="corp-mail 触发模板"]').setValue('EMAIL');
    expect(panel.text()).toContain('系统告警触发 · 邮件（SMTP）（当前草稿）');
    await panel.get('select[aria-label="示例资源"]').setValue('node-2');
    expect(panel.text()).toContain('资源专属条件');
    expect(panel.text()).toContain('未达到条件');
    await panel.get('select[aria-label="初始状态"]').setValue('recovery');
    await wrapper.get('select[aria-label="corp-mail 恢复模板"]').setValue('EMAIL');
    const [usage, seconds] = panel.findAllComponents({ name: 'ElInputNumber' });
    usage.vm.$emit('update:modelValue', 70);
    seconds.vm.$emit('update:modelValue', 179);
    await flushPromises();
    expect(panel.text()).toContain('未达到条件');
    seconds.vm.$emit('update:modelValue', 180);
    await flushPromises();
    expect(panel.text()).toContain('命中恢复条件');
    expect(panel.text()).toContain('未匹配部署规则的资源范围');
    expect(mocks.request.mock.calls.every(([request]) => request.method === 'get')).toBe(true);
  } finally {
    wrapper.unmount();
  }
});

it('matches CPU monitor trigger and recovery boundaries with the configured SMTP destination', async () => {
  const wrapper = await openEditor();
  try {
    const panel = wrapper.get('[aria-label="CPU 模拟匹配结果"]');
    await panel.get('select[aria-label="示例资源"]').setValue('cpu-demo');
    const [usage, seconds] = panel.findAllComponents({ name: 'ElInputNumber' });
    for (const [phase, percent, label] of [
      ['trigger', 90, '触发'],
      ['recovery', 65, '恢复']
    ] as const) {
      await panel.get('select[aria-label="初始状态"]').setValue(phase);
      usage.vm.$emit('update:modelValue', percent);
      seconds.vm.$emit('update:modelValue', 9);
      await flushPromises();
      expect(panel.text()).toContain('未达到条件');
      seconds.vm.$emit('update:modelValue', 10);
      await flushPromises();
      expect(panel.text()).toContain('命中' + label + '条件');
      expect(panel.text()).toContain('smtp-demo · 系统告警' + label + ' · 邮件（SMTP） · 收件人：receiver@example.invalid');
    }
  } finally {
    wrapper.unmount();
  }
});

it('binds the page-configured enterprise channel for RA and confirms the global delivery switch', async () => {
  const original = mocks.request.getMockImplementation()!;
  mocks.request.mockImplementation(async (request) => {
    if (request.url === base) {
      return {
        editable: true,
        notificationsEnabled: false,
        notificationsRevision: 'switch-r1',
        sources: [{ source: 'RA_STANDARD_REVIEW', application: 'RA', trigger: 'STANDARD_BACKLOG', recovery: 'STANDARD_CLEARED' }],
        channels: [enterpriseDing],
        bindings: []
      };
    }
    if (request.url === templates + '/catalog') {
      return {
        applications: [
          {
            value: 'RA',
            scenes: [
              { value: 'STANDARD_BACKLOG', label: '标准版审核积压' },
              { value: 'STANDARD_CLEARED', label: '标准版审核恢复' }
            ]
          }
        ],
        channels: [{ value: 'FAW_VW_DINGTALK', label: '企业钉钉' }]
      };
    }
    return original(request);
  });
  const confirmation = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm');
  const wrapper = await openEditor();
  try {
    const checkbox = wrapper.get('input[type=checkbox]');
    expect(checkbox.element.parentElement?.textContent).toContain('企业钉钉');
    await checkbox.setValue(true);
    expect(wrapper.text()).toContain('ra.fixture');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存渠道配置')!
      .trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: base + '/RA_STANDARD_REVIEW',
        data: { 'ui:enterprise-dingtalk': { triggerChannel: 'FAW_VW_DINGTALK', recoveryChannel: 'FAW_VW_DINGTALK', enabled: true, revision: null } }
      })
    );
    const toggle = wrapper.findAll('button').find((button) => button.text() === '开启自动投递')!;
    await toggle.trigger('click');
    await flushPromises();
    expect(mocks.request).not.toHaveBeenCalledWith(expect.objectContaining({ url: base + '/delivery-settings' }));
    await toggle.trigger('click');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: base + '/delivery-settings',
        data: { enabled: true, revision: 'switch-r1' }
      })
    );
    expect(wrapper.emitted('deliveryChanged')).toEqual([[true]]);
    expect(wrapper.text()).toContain('告警自动投递已开启');
  } finally {
    confirmation.mockRestore();
    wrapper.unmount();
  }
});
