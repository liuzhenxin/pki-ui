// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import RaIssueNotificationButton from '@/views/ra/issue/RaIssueNotificationButton.vue';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), notify: vi.fn(), success: vi.fn() }));
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm }, ElMessage: { success: mocks.success } }));
vi.mock('@/api/ra/certIssue', () => ({ requestRaIssueNotification: mocks.notify }));

it('submits a notification only after an administrator confirms', async () => {
  const wrapper = mount(RaIssueNotificationButton, {
    props: { certId: '9007199254740993' },
    global: {
      stubs: { ElButton: { template: '<button><slot /></button>' } },
      directives: { hasPermi: () => {} }
    }
  });

  try {
    expect(mocks.notify).not.toHaveBeenCalled();
    mocks.confirm.mockRejectedValueOnce('cancel').mockResolvedValueOnce(undefined);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(mocks.notify).not.toHaveBeenCalled();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith('9007199254740993');
    expect(wrapper.get('button').text()).toBe('通知任务已提交');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  } finally {
    wrapper.unmount();
  }
});
