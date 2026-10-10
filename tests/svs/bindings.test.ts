import { beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import SigningBindings from '@/views/svs/product/SigningBindings.vue';
import * as product from '@/api/svs/product';
import * as certificates from '@/api/svs/certificates';
vi.mock('@/api/svs/product', () => ({ resources: vi.fn(), maintain: vi.fn() }));
vi.mock('@/api/svs/certificates', () => ({ list: vi.fn() }));
const app = { id: 'app-a', kind: 'APPLICATION' as const, version: 1, fields: { name: '应用A', enabled: 'true' } };
const key = { id: 'key-a', kind: 'KEY_REFERENCE' as const, version: 1, fields: { enabled: 'true' } };
const cert = { id: 'cert-a', subject: 'CN=signer', serial: '123', keyId: 'key-a', status: 'ACTIVE', notAfter: '2099-01-01T00:00:00Z', version: 1 };
const binding = {
  id: 'binding-a',
  kind: 'BINDING' as const,
  version: 4,
  fields: { applicationId: app.id, certificateId: cert.id, keyId: key.id, enabled: 'true' }
};
const create = (manage = true) => mount(SigningBindings, { props: { manage }, global: { plugins: [ElementPlus] } });
const button = (w: ReturnType<typeof create>, text: string) => w.findAll('button').find((b) => b.text() === text)!;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(product.resources).mockImplementation(async (kind, page = 1, size = 20) => ({
    rows: kind === 'APPLICATION' ? [app] : kind === 'KEY_REFERENCE' ? [key] : [binding],
    total: 1,
    page,
    size
  }));
  vi.mocked(certificates.list).mockResolvedValue({ rows: [cert], total: 1, page: 1, size: 20 });
});
it('selects the certificate key reference and requires a reason before creating a binding', async () => {
  const w = create();
  await flushPromises();
  await button(w, '绑定签名证书').trigger('click');
  await flushPromises();
  const vm = w.vm as any;
  vm.draft.fields.applicationId = app.id;
  vm.draft.fields.certificateId = cert.id;
  vm.selectCertificate(cert.id);
  await flushPromises();
  expect(button(w, '保存绑定').attributes('disabled')).toBeDefined();
  vm.reason = '  应用接入签名  ';
  await flushPromises();
  vi.mocked(product.maintain).mockResolvedValue(binding);
  await button(w, '保存绑定').trigger('click');
  await flushPromises();
  expect(product.maintain).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'BINDING',
      version: 0,
      fields: { applicationId: app.id, certificateId: cert.id, keyId: key.id, enabled: 'true' }
    }),
    '应用接入签名'
  );
  w.unmount();
});
it('retains the original binding version and surfaces a conflict without closing the dialog', async () => {
  const w = create();
  await flushPromises();
  await button(w, '修改绑定').trigger('click');
  await flushPromises();
  (w.vm as any).reason = '切换签名证书';
  vi.mocked(product.maintain).mockRejectedValue(new Error('对象版本已变化，请刷新后重新提交'));
  await flushPromises();
  await button(w, '保存绑定').trigger('click');
  await flushPromises();
  expect(product.maintain).toHaveBeenCalledWith(expect.objectContaining({ id: binding.id, version: 4 }), '切换签名证书');
  expect((w.vm as any).dialog).toBe(true);
  expect(w.text()).toContain('对象版本已变化');
  w.unmount();
});
it('does not offer changes to query-only users', async () => {
  const w = create(false);
  await flushPromises();
  expect(w.text()).toContain('应用A');
  expect(w.text()).not.toContain('修改绑定');
  expect(w.text()).not.toContain('保存绑定');
  w.unmount();
});
it('loads certificate options beyond the first page', async () => {
  vi.mocked(certificates.list).mockImplementation(async (page) => ({
    rows: page === 1 ? [cert] : [{ ...cert, id: 'cert-b' }],
    total: 2,
    page,
    size: 1
  }));
  const w = create();
  await flushPromises();
  expect(certificates.list).toHaveBeenCalledWith(2);
  expect((w.vm as any).certificates).toHaveLength(2);
  w.unmount();
});
