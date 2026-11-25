// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import PfxExportDialog from '@/views/ra/components/PfxExportDialog.vue';

vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn() } }));

it('discards a private key read after closing, changing certificates, or selecting a newer file', async () => {
  const requestPfx = vi.fn().mockResolvedValue({});
  const wrapper = mount(PfxExportDialog, {
    props: { modelValue: true, certId: 'first', requestPfx },
    global: {
      stubs: {
        ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { template: '<label><slot /></label>' },
        ElInput: {
          props: ['modelValue'],
          template: '<textarea :value="modelValue" />'
        },
        ElButton: { template: '<button type="button"><slot /></button>' }
      }
    }
  });
  const selectFile = async () => {
    let complete!: (text: string) => void;
    const text = new Promise<string>((resolve) => { complete = resolve; });
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', { configurable: true, value: [{ text: () => text }] });
    await input.trigger('change');
    return complete;
  };
  const key = () => (wrapper.get('textarea').element as HTMLTextAreaElement).value;

  try {
    const closed = await selectFile();
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    closed('closed dialog key');
    await flushPromises();
    expect(key()).toBe('');

    const otherCertificate = await selectFile();
    await wrapper.setProps({ certId: 'second' });
    otherCertificate('previous certificate key');
    await flushPromises();
    expect(key()).toBe('');

    const older = await selectFile();
    const latest = await selectFile();
    latest('latest key');
    older('older key');
    await flushPromises();
    expect(key()).toBe('latest key');
    await wrapper.findAll('button').find((button) => button.text() === '验证私钥')!.trigger('click');
    expect(requestPfx).toHaveBeenCalledExactlyOnceWith('second', { privateKey: 'latest key', keyPassword: '', password: '' }, true);
  } finally {
    wrapper.unmount();
  }
});
