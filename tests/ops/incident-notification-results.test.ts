// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IncidentNotificationResults from '@/views/ops/alert/IncidentNotificationResults.vue';

it('shows the recorded decision independently for each incident phase', async () => {
  const wrapper = mount(IncidentNotificationResults, {
    props: {
      recovered: true,
      results: [
        { phase: 'TRIGGERED', channel: '', status: 'NOTIFICATIONS_DISABLED' },
        { phase: 'RECOVERED', channel: 'smtp-demo', status: 'SENT' }
      ]
    }
  });
  expect(wrapper.text()).toContain('触发通知已跳过：自动通知已关闭');
  expect(wrapper.text()).toContain('恢复通知smtp-demo · 渠道已受理');
  await wrapper.setProps({ results: [], recovered: false });
  expect(wrapper.text()).toContain('没有该阶段的通知记录');
  expect(wrapper.text()).not.toContain('已关闭');
  expect(wrapper.text()).not.toContain('恢复通知');
  wrapper.unmount();
});
