import { beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import TrustManagement from '@/views/svs/product/TrustManagement.vue';
import * as api from '@/api/svs/product';
vi.mock('@/api/svs/product', () => ({ resources: vi.fn(), maintain: vi.fn(), history: vi.fn() }));
const policy = {
  id: 'validation',
  kind: 'POLICY' as const,
  version: 3,
  fields: { enabled: 'true', revocationMode: 'REQUIRED', revocationSource: 'CRL', crl: 'Y3Js' }
};
const create = (manage = true) => mount(TrustManagement, { props: { mode: 'policies', manage }, global: { plugins: [ElementPlus] } });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.resources).mockResolvedValue({ rows: [policy], total: 1, page: 1, size: 20 });
});
it('requires a reason and HTTPS OCSP address, retaining the policy version', async () => {
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  vm.draft.fields.revocationSource = 'OCSP';
  vm.reason = '启用在线校验';
  vm.draft.fields.ocspUrl = 'http://example.com';
  await flushPromises();
  expect(vm.valid).toBe(false);
  vm.draft.fields.ocspUrl = 'https://example.com/ocsp';
  await flushPromises();
  expect(vm.valid).toBe(true);
  vi.mocked(api.maintain).mockResolvedValue(policy);
  await vm.save();
  expect(api.maintain).toHaveBeenCalledWith(expect.objectContaining({ id: 'validation', version: 3 }), '启用在线校验');
  w.unmount();
});
it('retains the dialog and reason after a version conflict', async () => {
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  vm.reason = '更新 CRL';
  vi.mocked(api.maintain).mockRejectedValue(new Error('版本冲突'));
  await vm.save();
  expect(vm.dialog).toBe(true);
  expect(vm.reason).toBe('更新 CRL');
  expect(w.text()).toContain('版本冲突');
  w.unmount();
});
it('prevents read-only callers from editing or saving', async () => {
  const w = create(false);
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  await vm.save();
  expect(vm.dialog).toBe(false);
  expect(api.maintain).not.toHaveBeenCalled();
  expect(w.text()).not.toContain('配置验证策略');
  w.unmount();
});
it('fails closed when resources cannot load', async () => {
  vi.mocked(api.resources).mockRejectedValue(new Error('加载失败'));
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  expect(vm.ready).toBe(false);
  expect(vm.dialog).toBe(false);
  w.unmount();
});
it('combines multiple public CRLs and rejects private-key files', async () => {
  const w = create();
  await flushPromises();
  const vm = w.vm as any;
  vm.edit();
  const input = {
    files: [
      {
        size: 100,
        arrayBuffer: async () =>
          new TextEncoder().encode('-----BEGIN X509 CRL-----\nYQ==\n-----END X509 CRL-----\n-----BEGIN X509 CRL-----\nYg==\n-----END X509 CRL-----')
            .buffer
      }
    ],
    value: 'bundle.pem'
  };
  await vm.readFile({ target: input }, 'crl');
  expect(vm.draft.fields.crl).toBe('YWI=');
  input.files = [{ size: 100, arrayBuffer: async () => new TextEncoder().encode('-----BEGIN PRIVATE KEY-----').buffer }];
  await vm.readFile({ target: input }, 'crl');
  expect(vm.error).toContain('仅接受公开');
  expect(vm.draft.fields.crl).toBe('YWI=');
  w.unmount();
});
