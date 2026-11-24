// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { expect, it, vi } from 'vitest';
import CpuResourcePane from '@/views/ops/alert/CpuResourcePane.vue';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/utils/request', () => ({ default: request }));

it('opens a CPU resource, previews its deployment condition and opens only its recent incident', async () => {
  request.mockImplementation(async ({ url }) => {
    switch (url) {
      case '/v1/alert/resources/cpu':
        return [
          {
            code: 'node-128',
            name: '验收服务器',
            sampleStatus: 'CURRENT',
            usage: 91,
            activeCount: 1,
            condition: { origin: 'DEPLOYMENT', triggerPercent: 90, triggerSeconds: 10, recoveryPercent: 65, recoverySeconds: 10 }
          }
        ];
      case '/v1/alert/resources/cpu/node-128/incidents':
        return [{ id: '18', title: 'CPU 使用率过高', openedAt: '2026-11-22T06:00:00Z' }];
      case '/v1/alert/incident-template-rules':
        return {
          sources: [{ source: 'SERVER_CPU', application: 'OPS', trigger: 'SYSTEM_TRIGGERED', recovery: 'SYSTEM_RECOVERED' }],
          channels: [{ name: 'smtp', channel: 'EMAIL', templateChannels: ['EMAIL'], recipient: 'ops@example.invalid' }],
          bindings: [{ source: 'SERVER_CPU', channel: 'smtp', triggerChannel: 'EMAIL', recoveryChannel: 'EMAIL' }],
          notificationsEnabled: false,
          cpuRoutes: [],
          editable: true
        };
      case '/v1/alert/notification-templates/catalog':
        return { applications: [], channels: [] };
      default:
        throw new Error('unexpected request');
    }
  });
  const wrapper = mount(CpuResourcePane, { global: { plugins: [ElementPlus] } });
  const click = (label: string) =>
    wrapper
      .findAll('button')
      .find((button) => button.text().includes(label))!
      .trigger('click');
  try {
    await flushPromises();
    await click('详情');
    await flushPromises();
    expect(wrapper.text()).toContain('部署配置');
    expect(wrapper.text()).toContain('ops@example.invalid');
    expect(wrapper.text()).toContain('自动通知已关闭');
    await click('模拟此资源');
    await flushPromises();
    expect(wrapper.get('[aria-label="CPU 模拟匹配结果"]').text()).toContain('命中触发条件');
    expect(wrapper.text()).not.toContain('保存此渠道');
    await click('CPU 使用率过高');
    expect(wrapper.emitted('incident')).toEqual([['18']]);
    expect(request.mock.calls.every(([config]) => config.method === 'get')).toBe(true);
  } finally {
    wrapper.unmount();
  }
});
