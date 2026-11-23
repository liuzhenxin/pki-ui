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

const draft = { csrPem: '-----BEGIN CERTIFICATE REQUEST-----\nfixture', subject: 'C=CN,O=Fixture PKI,CN=Renewed RA', algorithm: 'SM2' };

async function click(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  button?.click();
  await flushPromises();
}

describe('RA identity rotation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('generates a CSR with the DN entered on the identity page and activates the signed PEM', async () => {
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
      await page.get('input[placeholder="C=CN,O=LiuZX PKI,CN=RA Identity"]').setValue(draft.subject);
      await click('更新身份证书');
      await click('生成 CSR');
      expect(api.generateRaIdentityRotation).toHaveBeenCalledWith({ subject: draft.subject });
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

  it('keeps an existing CSR until replacement with the new DN is confirmed', async () => {
    const pending = { ...draft, csrPem: 'previous CSR', subject: 'CN=Previous RA' };
    api.getRaIdentityRotation.mockResolvedValue({ data: pending });
    api.generateRaIdentityRotation.mockResolvedValue({ data: draft });
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm');
    const page = mount(RaConfig, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], directives: { hasPermi: () => undefined } }
    });
    try {
      await page.get('[role="tab"][id="tab-RA_IDENTITY"]').trigger('click');
      await page.get('input[placeholder="C=CN,O=LiuZX PKI,CN=RA Identity"]').setValue(draft.subject);
      await click('更新身份证书');
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain(pending.subject);
      expect(dialog?.textContent).not.toContain('下载 CSR');
      expect(dialog?.textContent).not.toContain('校验并启用');

      await click('重新生成 CSR');
      expect(api.generateRaIdentityRotation).not.toHaveBeenCalled();
      expect(dialog?.querySelector('textarea[readonly]')).toBeNull();

      await click('重新生成 CSR');
      expect(api.generateRaIdentityRotation).toHaveBeenCalledWith({ subject: draft.subject, replaceCsrPem: pending.csrPem });
      expect(dialog?.querySelector('textarea[readonly]')).toHaveProperty('value', draft.csrPem);
    } finally {
      page.unmount();
    }
  });

  it('resumes the pending CSR when the identity page DN was not edited', async () => {
    api.getRaIdentityRotation.mockResolvedValue({ data: draft });
    const page = mount(RaConfig, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], directives: { hasPermi: () => undefined } }
    });
    try {
      await page.get('[role="tab"][id="tab-RA_IDENTITY"]').trigger('click');
      await click('更新身份证书');
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.querySelector('input')).toHaveProperty('value', draft.subject);
      expect(dialog?.querySelector('textarea[readonly]')).toHaveProperty('value', draft.csrPem);
      expect(api.generateRaIdentityRotation).not.toHaveBeenCalled();
    } finally {
      page.unmount();
    }
  });
});
