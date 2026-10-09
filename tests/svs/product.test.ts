import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus, { ElMessageBox } from 'element-plus';
import Product from '@/views/svs/product/index.vue';
import * as api from '@/api/svs/product';
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));
vi.mock('@/utils/request', () => ({ default: vi.fn().mockResolvedValue([]) }));
vi.mock('@/api/svs/product', () => ({
  session: vi.fn(),
  resources: vi.fn(),
  history: vi.fn(),
  maintain: vi.fn(),
  apply: vi.fn(),
  approvals: vi.fn(),
  decide: vi.fn(),
  execute: vi.fn(),
  runtime: vi.fn(),
  metrics: vi.fn(),
  backup: vi.fn(),
  audit: vi.fn(),
  exportAudit: vi.fn()
}));
const identity = (role: string, permissions: string[], username = 'current') => ({ role, permissions, username, tenantId: 9 });
describe('SVS role workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.resources).mockResolvedValue({ rows: [], total: 0, page: 1, size: 20 });
    vi.mocked(api.audit).mockResolvedValue({ rows: [], total: 0, page: 1, size: 20 });
  });
  it('system administrator registers applications without security write controls', async () => {
    vi.mocked(api.session).mockResolvedValue(identity('SYSADMIN', ['svs:system:application:manage']));
    const wrapper = mount(Product, { props: { page: 'applications', title: '应用接入', mutable: true }, global: { plugins: [ElementPlus] } });
    await flushPromises();
    expect(wrapper.text()).toContain('新增');
    await wrapper.setProps({ page: 'grants', title: '接口授权' });
    await flushPromises();
    expect(wrapper.text()).not.toContain('新增');
    wrapper.unmount();
  });
  it('submits policy directly with reason after personal confirmation', async () => {
    vi.mocked(api.session).mockResolvedValue(identity('SECADMIN', ['svs:security:policy:manage'], 'secadmin'));
    const confirmation = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm');
    vi.mocked(api.maintain).mockResolvedValue({ id: 'validation', kind: 'POLICY', version: 1, fields: {} });
    const w = mount(Product, { props: { page: 'policies', title: '策略', mutable: true }, global: { plugins: [ElementPlus] } });
    await flushPromises();
    const vm = w.vm as any;
    vm.edit();
    vm.draft.fields.revocationMode = 'REQUIRED';
    vm.reason = '启用吊销校验';
    await vm.save();
    expect(confirmation).toHaveBeenCalledTimes(1);
    expect(api.maintain).toHaveBeenCalledWith(expect.objectContaining({ id: 'validation', kind: 'POLICY', version: 0 }), '启用吊销校验');
    confirmation.mockRestore();
    w.unmount();
  });
  it('historical approvals remain read-only even with legacy permissions', async () => {
    vi.mocked(api.session).mockResolvedValue(identity('SECADMIN', ['svs:security:approval:manage']));
    const approval = (id: string, applicant: string) => ({
      id,
      applicant,
      approver: '',
      state: 'PENDING',
      expiresAt: '2027-01-01T00:00:00Z',
      createdAt: '2026-10-06T00:00:00Z',
      reason: 'test',
      proposed: { id: 'validation', kind: 'POLICY' as const, version: 1, fields: {} }
    });
    vi.mocked(api.approvals).mockResolvedValue({ rows: [approval('self', 'current'), approval('other', 'colleague')], total: 2, page: 1, size: 20 });
    const wrapper = mount(Product, { props: { page: 'approvals', title: '安全审批', mutable: true }, global: { plugins: [ElementPlus] } });
    await flushPromises();
    const text = wrapper.findAll('button').map((button) => button.text());
    expect(text.filter((label) => ['批准', '拒绝', '执行'].includes(label))).toHaveLength(0);
    wrapper.unmount();
  });
  it('auditor has controlled export and append opinions without mutation of raw logs', async () => {
    vi.mocked(api.session).mockResolvedValue(identity('AUDITOR', ['svs:audit:log:export', 'svs:audit:opinion:manage']));
    const wrapper = mount(Product, { props: { page: 'audit', title: '审计查询', mutable: false }, global: { plugins: [ElementPlus] } });
    await flushPromises();
    expect(wrapper.text()).toContain('导出当前筛选');
    expect(wrapper.text()).not.toContain('删除');
    await wrapper.setProps({ page: 'opinions', title: '审计意见', mutable: true });
    await flushPromises();
    expect(wrapper.text()).toContain('追加意见');
    wrapper.unmount();
  });
});
