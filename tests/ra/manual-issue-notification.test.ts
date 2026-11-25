// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import { h, ref } from 'vue';
import RaIssueNotificationButton from '@/views/ra/issue/RaIssueNotificationButton.vue';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), notify: vi.fn(), success: vi.fn(), hasPermi: vi.fn(() => true) }));
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm }, ElMessage: { success: mocks.success } }));
vi.mock('@/plugins/auth', () => ({ default: { hasPermi: mocks.hasPermi } }));
vi.mock('@/api/ra/certIssue', () => ({ requestRaIssueNotification: mocks.notify }));

it('submits a notification only after an administrator confirms', async () => {
  const wrapper = mount(RaIssueNotificationButton, {
    props: { certId: '9007199254740993' },
    global: {
      stubs: { ElButton: { template: '<button><slot /></button>' } }
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

it('keeps the footer mounted when a non-admin closes and reopens certificate details', async () => {
  mocks.hasPermi.mockReturnValue(false);
  const certId = ref<string>();
  const wrapper = mount({
    setup: () => () => h('div', [
      certId.value ? h(RaIssueNotificationButton, { certId: certId.value }) : null,
      h('button', '关闭')
    ])
  }, {
    global: {
      stubs: { ElButton: { template: '<button><slot /></button>' } },
      directives: { hasPermi: { mounted(el: HTMLElement) { el.remove(); } } }
    }
  });
  try {
    for (const value of ['new-certificate', undefined, 'legacy-certificate', undefined, 'new-certificate']) {
      certId.value = value;
      await flushPromises();
      expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['关闭']);
      expect(wrapper.element.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
    }
  } finally {
    wrapper.unmount();
    mocks.hasPermi.mockReturnValue(true);
  }
});
