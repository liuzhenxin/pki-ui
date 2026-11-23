// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { describe, expect, it, vi } from 'vitest';
import RaCertPage from '@/views/ra/cert/index.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));
vi.mock('@/api/skf/skf_api', () => ({
  default: class {
    connect = async () => this;
    setLanguage = vi.fn().mockResolvedValue(undefined);
    enumProvider = vi.fn().mockResolvedValue([]);
    findCertificates = vi.fn().mockResolvedValue([]);
  }
}));

const certId = '9007199254740999';
const archivePath = `/ra/v1/certs/${certId}/historical-recoveries`;

async function openRecovery(status: string, archived?: boolean) {
  mocks.request.mockReset();
  mocks.request.mockImplementation(({ url }) => {
    if (url.endsWith('/certs/page')) {
      return Promise.resolve({ data: { rows: [{ id: certId, status, keySource: 'KMC', subject: 'CN=fixture' }], total: 1 } });
    }
    if (url.endsWith('/kmc-key-status')) return Promise.resolve({ data: { algorithm: 'RSA', status: 0 } });
    if (url === `${archivePath}/archive-availability` && archived !== undefined) return Promise.resolve({ data: archived });
    return Promise.reject(new Error('fixture unavailable'));
  });
  const page = mount(RaCertPage, {
    attachTo: document.body,
    global: { plugins: [ElementPlus], mocks: { parseTime: () => '' }, stubs: { RightToolbar: true, Pagination: true } }
  });
  await flushPromises();
  const buttons = page.findAll('button[aria-label="密钥恢复"]');
  expect(buttons).toHaveLength(1);
  await buttons[0].trigger('click');
  await flushPromises();
  return page;
}

describe('RA recovery button', () => {
  it('retains the ordinary recovery dialog for a current certificate', async () => {
    const page = await openRecovery('VALID');
    try {
      expect(document.body.textContent).toContain('RSA密钥恢复');
      expect(mocks.request.mock.calls.some(([request]) => request.url === `${archivePath}/archive-availability`)).toBe(false);
    } finally {
      page.unmount();
    }
  });

  it('opens the SKF archive form for the same button and keeps archive file export hidden', async () => {
    vi.stubEnv('VITE_RA_ARCHIVE_SKF', 'true');
    const page = await openRecovery('EXPIRED', true);
    try {
      expect(document.body.textContent).toContain('归档密钥恢复');
      expect(document.body.textContent).toContain('登记设备 ID');
      expect(document.body.textContent).not.toContain('签发到文件');
      expect(mocks.request.mock.calls.some(([request]) => request.url === archivePath)).toBe(false);
    } finally {
      page.unmount();
      vi.unstubAllEnvs();
    }
  });

  it.each([true, false, undefined])('opens historical recovery only on an affirmative archive check (%s)', async (archived) => {
    const page = await openRecovery('EXPIRED', archived);
    try {
      expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ url: `${archivePath}/archive-availability`, method: 'get' }));
      expect(document.body.textContent?.includes('归档证书密钥恢复')).toBe(archived === true);
      expect(mocks.request.mock.calls.some(([request]) => request.url.endsWith('/kmc-key-status'))).toBe(false);
      expect(mocks.request.mock.calls.some(([request]) => request.url === archivePath)).toBe(false);
    } finally {
      page.unmount();
    }
  });
});
