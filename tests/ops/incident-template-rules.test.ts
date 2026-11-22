// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import IncidentTemplateRulePane from '@/views/ops/alert/IncidentTemplateRulePane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

const base = '/v1/alert/incident-template-rules';

it('saves independent trigger and recovery templates for the selected incident delivery channel', async () => {
  mocks.request.mockImplementation(async ({ url, method, data }) => {
    if (url === base && method === 'get') {
      return {
        editable: true,
        sources: [{ source: 'SERVER_CPU', application: 'OPS', trigger: 'SYSTEM_TRIGGERED', recovery: 'SYSTEM_RECOVERED' }],
        channels: [{ name: 'corp-demo', channel: 'FAW_VW_EMAIL', templateChannels: ['FAW_VW_EMAIL', 'EMAIL'] }],
        bindings: []
      };
    }
    if (url === '/v1/alert/notification-templates/catalog') {
      return {
        applications: [
          {
            value: 'OPS',
            scenes: [
              { value: 'SYSTEM_TRIGGERED', label: '系统告警触发' },
              { value: 'SYSTEM_RECOVERED', label: '系统告警恢复' }
            ]
          }
        ],
        channels: [
          { value: 'FAW_VW_EMAIL', label: '企业邮件' },
          { value: 'EMAIL', label: '邮件（SMTP）' }
        ]
      };
    }
    if (method === 'put') return { source: 'SERVER_CPU', channel: 'corp-demo', ...data, revision: 'r1' };
    throw new Error('Unexpected fixture request');
  });
  const wrapper = mount(IncidentTemplateRulePane, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { props: ['label'], template: '<label>{{ label }}<slot /></label>' },
        ElSelect: {
          props: ['modelValue', 'disabled'],
          emits: ['update:modelValue', 'change'],
          template:
            '<select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><slot /></select>'
        },
        ElOption: { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' },
        ElButton: { props: ['nativeType'], template: '<button :type="nativeType || \'button\'"><slot /></button>' }
      }
    }
  });
  try {
    await flushPromises();
    const [source, channel, trigger, recovery] = wrapper.findAll('select');
    expect(source.element.value).toBe('SERVER_CPU');
    expect(channel.element.value).toBe('corp-demo');
    expect(trigger.text()).toContain('系统告警触发 · 企业邮件');
    expect(recovery.text()).toContain('系统告警恢复 · 邮件（SMTP）');
    await trigger.setValue('FAW_VW_EMAIL');
    await recovery.setValue('EMAIL');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${base}/SERVER_CPU/corp-demo`,
        method: 'put',
        data: { triggerChannel: 'FAW_VW_EMAIL', recoveryChannel: 'EMAIL', revision: null }
      })
    );
    expect(mocks.request.mock.calls.every(([request]) => request.method === 'get' || request.method === 'put')).toBe(true);
  } finally {
    wrapper.unmount();
  }
});
