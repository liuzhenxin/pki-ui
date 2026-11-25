import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KeyRecoveryDialog from '@/views/kmc/components/KeyRecoveryDialog.vue';
import ArchiveKeyList from '@/views/kmc/admin/archiveKey/index.vue';

const archiveKey = vi.hoisted(() => ({
  id: '1234567890123456790',
  serialNumber: 'ABC1234567890123460',
  subject: 'CN=Example Archive,' + 'x'.repeat(80),
  keyType: 'RSA',
  keyBits: 4096,
  archiveTime: '2026-11-25 22:00:00'
}));

const request = vi.hoisted(() =>
  vi.fn(async ({ url }: { url: string }) => {
    if (url.endsWith('/archive-keys/page')) return { data: { records: [archiveKey], total: 1 } };
    if (url.endsWith('/key-recovery/policy')) return { data: { totalApprovers: 7, requiredApprovers: 4 } };
    if (url.endsWith('/key-recovery/approvers')) return { data: [] };
    throw new Error('Unexpected endpoint: ' + url);
  })
);

vi.mock('@/utils/request', () => ({ default: request }));
vi.mock('@/api/skf/skf_api', () => ({ default: class {} }));

describe('key recovery dialog authorization', () => {
  beforeEach(() => {
    request.mockClear();
  });

  it.each(['USED_KEY', 'ARCHIVE_KEY'] as const)('loads the restricted recovery policy for %s', async (targetType) => {
    const wrapper = mount({ ...KeyRecoveryDialog, render: () => null });
    try {
      await (wrapper.vm as unknown as { open: InstanceType<typeof KeyRecoveryDialog>['open'] }).open({ targetType, targetId: 1 });
      expect(request.mock.calls.map(([{ url }]) => url)).toEqual(['/kmc/v1/key-recovery/policy', '/kmc/v1/key-recovery/approvers']);
    } finally {
      wrapper.unmount();
    }
  });
});

describe('key recovery dialog layout', () => {
  it('shows long key metadata once and marks the current recovery step', async () => {
    const wrapper = mount(KeyRecoveryDialog, { attachTo: document.body, global: { plugins: [ElementPlus], directives: { hasPermi: {} } } });
    try {
      const subject = 'CN=Example,OU=' + 'x'.repeat(80) + ',DC=example';
      await (wrapper.vm as unknown as { open: InstanceType<typeof KeyRecoveryDialog>['open'] }).open({
        targetType: 'USED_KEY',
        targetId: '1234567890123456789',
        serialNumber: 'ABC1234567890123456789',
        subject,
        keyType: 'RSA',
        keyBits: 2048
      });
      await flushPromises();

      const dialog = document.querySelector('.key-recovery-dialog')!;
      const fields = Array.from(dialog.querySelectorAll('.key-details dd'), (item) => item.textContent);
      expect(fields).toEqual(['在用密钥', 'RSA · 2048 位', '1234567890123456789', 'ABC1234567890123456789', subject]);
      expect(dialog.querySelectorAll('.recovery-step')).toHaveLength(4);
      expect(dialog.querySelector('[aria-current="step"]')?.textContent).toContain('填写申请');
      expect(dialog.querySelector('.recovery-scroll .dialog-footer')).toBeNull();
      expect(dialog.querySelector('.el-dialog__footer .dialog-footer')?.textContent).toContain('提交申请');
    } finally {
      wrapper.unmount();
    }
  });

  it('opens the archive layout with the selected row’s specification and archive time', async () => {
    const wrapper = mount(ArchiveKeyList, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], directives: { hasPermi: {} }, stubs: ['right-toolbar', 'pagination'] }
    });
    try {
      await flushPromises();
      const button = wrapper.findAll('button').find((item) => item.text() === '密钥恢复');
      expect(button).toBeDefined();
      await button!.trigger('click');
      await flushPromises();

      const dialog = document.querySelector('.key-recovery-dialog')!;
      expect(dialog.querySelector('.el-dialog__title')?.textContent).toBe('归档密钥恢复');
      const summary = dialog.querySelector('.key-summary')!;
      expect(summary.querySelector('.card-title')?.textContent).toContain('归档信息');
      const values = Array.from(summary.querySelectorAll('.key-details dd'), (item) => item.textContent);
      expect(values).toEqual(['归档密钥', 'RSA · 4096 位', archiveKey.id, archiveKey.archiveTime, archiveKey.serialNumber, archiveKey.subject]);
      expect(dialog.querySelector('[aria-current="step"]')?.textContent).toContain('填写申请');
    } finally {
      wrapper.unmount();
    }
  });
});
