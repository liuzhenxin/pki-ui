// @vitest-environment jsdom

import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPermi } from '@/directive/permission';
import ArchiveCertPage from '@/views/ca/archive-cert/index.vue';
import { historicalRecoveryPermission } from '@/api/ca/historicalRecovery';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  user: { permissions: [] as string[] }
}));
vi.mock('@/utils/request', () => ({ default: mocks.request }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => mocks.user }));

const path = '/ca/v1/cert-historical-recoveries';
const archiveId = '9007199254740999';
const taskId = '983b7b98-1b8a-44a1-9b3d-0065ff179ede';
const deviceId = 'fixture-device';
const date = '2026-11-22T08:00:00Z';
const bindingFile = {
  wrappingCsrBase64: 'Y3Ny',
  deviceBinding: {
    payload: {
      bindingId: '6e54139a-44f1-4821-a88f-f8bb1007d877',
      issuedAt: date,
      clientCertSha256: 'a'.repeat(64),
      wrappingSpkiSha256: 'b'.repeat(64),
      deviceId,
      recipientId: 'fixture-recipient',
      ticketNo: 'fixture-ticket'
    },
    signatureBase64: 'c2ln'
  }
};

const receiptFile = {
  recoveryId: taskId,
  deliveryReceipt: {
    payload: {
      recoveryId: taskId,
      deviceId,
      clientCertSha256: 'a'.repeat(64),
      wrappingSpkiSha256: 'b'.repeat(64),
      originalSpkiSha256: 'c'.repeat(64),
      envelopeSha256: 'd'.repeat(64),
      challengeId: 'ae13bc84-0b3e-45c0-9881-07c69723ea11',
      completedAt: date,
      result: 'IMPORTED',
      challengeSha256: 'e'.repeat(64)
    },
    signatureBase64: 'c2ln'
  }
};

const task = { applicationNo: 'application-fixture', recoveryId: taskId, updatedAt: date, expiresAt: date };
const rows = [
  { id: archiveId, sourceCertId: '21', keySource: 'KMC', archiveReason: 'EXPIRED', subject: 'CN=模拟归档证书' },
  { id: '12', keySource: 'KMC', archiveReason: 'REVOKED', subject: 'CN=已注销' },
  { id: '13', keySource: 'LOCAL', archiveReason: 'EXPIRED', subject: 'CN=本地密钥' }
];

async function mountPage() {
  const wrapper = mount(ArchiveCertPage, {
    attachTo: document.body,
    global: { plugins: [ElementPlus], directives: { hasPermi }, stubs: { RightToolbar: true, Pagination: true } }
  });
  await flushPromises();
  return wrapper;
}

function button(wrapper: VueWrapper | DOMWrapper<Element>, text: string) {
  const entry = wrapper.findAll('button').find((item) => item.text() === text);
  if (!entry) throw new Error('Missing button ' + text);
  return entry;
}

async function setField(wrapper: DOMWrapper<Element>, label: string, value: string) {
  await wrapper.get(`[aria-label="${label}"]`).setValue(value);
}

async function selectFile(wrapper: DOMWrapper<Element>, label: string, contents: unknown) {
  const input = wrapper.get(`input[aria-label="${label}"]`);
  const file = JSON.stringify(contents);
  Object.defineProperty(input.element, 'files', {
    value: [{ size: file.length, text: async () => file }],
    configurable: true
  });
  await input.trigger('change');
  await flushPromises();
}

describe('CA archive certificate recovery', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValueOnce({ data: { rows, total: rows.length } });
    mocks.user.permissions = [];
  });

  it('keeps the existing recovery endpoint hidden without the historical recovery permission', async () => {
    mocks.user.permissions = ['ca:cert:recover', 'ca:archive-cert:detail'];
    const wrapper = await mountPage();
    try {
      expect(wrapper.findAll('button').some((item) => item.text() === '密钥恢复')).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it('submits over HTTP, retries unchanged after a timeout and confirms only the bound device receipt', async () => {
    mocks.user.permissions = [historicalRecoveryPermission];
    mocks.request
      .mockRejectedValueOnce(new Error('fixture timeout'))
      .mockResolvedValueOnce({ code: 'OK', data: { ...task, status: 'QUEUED' } })
      .mockResolvedValueOnce({ code: 'OK', data: { ...task, status: 'PENDING_CONFIRMATION', confirmBy: date } })
      .mockResolvedValueOnce({ code: 'OK', data: { ...task, status: 'SUCCEEDED', receiptSha256: 'f'.repeat(64) } });
    const wrapper = await mountPage();
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      expect(wrapper.findAll('button').filter((item) => item.text() === '密钥恢复')).toHaveLength(1);
      await button(wrapper, '密钥恢复').trigger('click');
      await flushPromises();
      const dialog = new DOMWrapper(document.body);
      await setField(dialog, '授权依据', 'fixture-authorization');
      await setField(dialog, '恢复原因', '模拟恢复');
      await selectFile(dialog, '设备绑定文件', { ...bindingFile, unexpectedField: 'invalid' });
      expect(button(dialog, '提交申请').attributes('disabled')).toBeDefined();
      expect(mocks.request).toHaveBeenCalledTimes(1);
      await selectFile(dialog, '设备绑定文件', bindingFile);
      await button(dialog, '提交申请').trigger('click');
      await flushPromises();
      const attempt = mocks.request.mock.calls[1][0];
      expect(attempt).toEqual(
        expect.objectContaining({
          method: 'post',
          url: path,
          headers: { sensitive: true, repeatSubmit: false, hideErrorNotify: true },
          data: {
            ...bindingFile,
            clientRequestNo: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
            certificateRef: { source: 'ARCHIVE', id: archiveId },
            ticketNo: 'fixture-ticket',
            reason: '模拟恢复',
            authorizationRef: 'fixture-authorization',
            mode: 'DEVICE_DELIVERY',
            recipientId: 'fixture-recipient',
            deviceId
          }
        })
      );
      await button(dialog, '关闭').trigger('click');
      await button(wrapper, '密钥恢复').trigger('click');
      await flushPromises();
      await button(dialog, '重试申请').trigger('click');
      await flushPromises();
      expect(mocks.request.mock.calls[2][0]).toEqual(attempt);
      expect(dialog.text()).toContain('排队中');
      await button(dialog, '刷新状态').trigger('click');
      await flushPromises();
      expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'get', url: `${path}/${taskId}` }));
      expect(dialog.text()).toContain('等待设备导入');

      await selectFile(dialog, '设备签名回执', {
        ...receiptFile,
        deliveryReceipt: { ...receiptFile.deliveryReceipt, payload: { ...receiptFile.deliveryReceipt.payload, deviceId: 'other-device' } }
      });
      expect(button(dialog, '确认导入').attributes('disabled')).toBeDefined();
      expect(mocks.request).toHaveBeenCalledTimes(4);

      await selectFile(dialog, '设备签名回执', receiptFile);
      await button(dialog, '确认导入').trigger('click');
      await flushPromises();
      expect(mocks.request).toHaveBeenLastCalledWith(
        expect.objectContaining({ method: 'post', url: `${path}/${taskId}/confirm-delivery`, data: receiptFile })
      );
      expect(dialog.text()).toContain('恢复成功');
      expect(mocks.request.mock.calls.every(([config]) => config.url.startsWith('/ca/'))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      wrapper.unmount();
    }
  });
});
