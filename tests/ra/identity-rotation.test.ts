// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus, { ElMessageBox } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RaConfig from '@/views/ra/config/index.vue';

const api = vi.hoisted(() => ({
  getRaConfig: vi.fn(async () => ({ data: { config: '{}' } })),
  getRaIdentityRotation: vi.fn(),
  generateRaIdentityRotation: vi.fn(),
  activateRaIdentityRotation: vi.fn(),
  saveRaConfig: vi.fn(),
  testRaConfig: vi.fn()
}));
vi.mock('@/api/ra/config', () => api);

const draft = { csrPem: '-----BEGIN CERTIFICATE REQUEST-----\nfixture', subject: 'CN=Fixture RA', algorithm: 'SM2' };

async function click(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  button?.click();
  await flushPromises();
}

describe('RA identity rotation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('generates a CSR and submits only the CA-signed PEM for activation', async () => {
    api.getRaIdentityRotation.mockResolvedValue({ data: null });
    api.generateRaIdentityRotation.mockResolvedValue({ data: draft });
    api.activateRaIdentityRotation.mockResolvedValue({ code: 'OK' });
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm');
    const page = mount(RaConfig, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], directives: { hasPermi: () => undefined } }
    });
    try {
      const tab = page.findAll('[role="tab"]').find((item) => item.text() === 'RA身份');
      expect(tab).toBeDefined();
      await tab?.trigger('click');
      await click('更新身份证书');
      await click('生成 CSR');
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.querySelector('textarea[readonly]')).toHaveProperty('value', draft.csrPem);
      const certificate = dialog?.querySelector<HTMLTextAreaElement>('textarea:not([readonly])');
      expect(certificate).toBeDefined();
      if (certificate) {
        certificate.value = ' signed certificate ';
        certificate.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await flushPromises();
      await click('校验并启用');
      expect(api.activateRaIdentityRotation).toHaveBeenCalledWith('signed certificate');
      expect(api.saveRaConfig).not.toHaveBeenCalled();
    } finally {
      page.unmount();
    }
  });
});
