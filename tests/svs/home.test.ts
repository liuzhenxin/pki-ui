import { beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import Home from '@/views/svs/home/index.vue';
import * as api from '@/api/svs/home';
import * as product from '@/api/svs/product';
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => navigation }));
vi.mock('@/api/svs/home', () => ({ summary: vi.fn() }));
vi.mock('@/api/svs/product', () => ({ session: vi.fn(), menus: vi.fn() }));
const section = (data = {}) => ({ ready: true, data, message: '' });
const fixture = (role: api.HomeRole, username: string): api.HomeSummary => ({
  username,
  role,
  updatedAt: '2026-10-09T06:00:00Z',
  sections: {
    runtime: section({ deviceState: 'UP' }),
    approvals: section({
      pending: 1,
      executable: 0,
      waiting: [{ id: 'other', objectId: 'oa', applicant: username === 'secadmin' ? 'secadmin2' : 'secadmin', state: 'PENDING' }],
      mine: []
    }),
    certificates: section({ expiring: 0, expired: 0, rows: [] }),
    grants: section({ validBindings: 0, rows: [] }),
    calls: section({ total: 0, failed: 0, counts: [] }),
    applications: section({ total: 0, rows: [] }),
    audit: section({ failed: 0, rejected: 0, activities: 0, rows: [] }),
    opinions: section({ total: 0 })
  }
});
async function page(role: api.HomeRole = 'SECADMIN', username = 'secadmin') {
  vi.mocked(product.session).mockResolvedValue({ role, username, tenantId: 9, permissions: [] });
  vi.mocked(api.summary).mockResolvedValue(fixture(role, username));
  const wrapper = mount(Home, { global: { plugins: [ElementPlus] } });
  await flushPromises();
  return wrapper;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(product.menus).mockResolvedValue([
    {
      title: '安全',
      mutable: false,
      path: '',
      children: [
        { title: '审批', mutable: true, path: '/svs/approvals', children: [] },
        { title: '运行', mutable: false, path: '/svs/runtime', children: [] }
      ]
    }
  ]);
});
it('security admins share a home and open approval details without mutations', async () => {
  for (const user of ['secadmin', 'secadmin2']) {
    const w = await page('SECADMIN', user);
    expect(w.text()).toContain('安全工作台');
    expect(w.text()).toContain(user === 'secadmin' ? 'secadmin2' : 'secadmin');
    await w
      .findAll('button')
      .find((b) => b.text() === '查看变更详情')!
      .trigger('click');
    expect(navigation.push).toHaveBeenCalledWith({ path: '/svs/approvals', query: { id: 'other' } });
    expect(w.text()).not.toContain('签名证书 / CSR →');
    w.unmount();
  }
});
it('system and audit roles see their own panels and empty-state messages', async () => {
  const sys = await page('SYSADMIN', 'admin');
  expect(sys.text()).toContain('运行工作台');
  expect(sys.text()).toContain('最近24小时暂无调用');
  expect(sys.text()).not.toContain('安全变更待办');
  sys.unmount();
  const aud = await page('AUDITOR', 'auditor');
  expect(aud.text()).toContain('审计工作台');
  expect(aud.text()).toContain('最近24小时暂无失败或拒绝事件');
  expect(aud.text()).not.toContain('我的待执行');
  aud.unmount();
});
it('failed refresh replaces known values with unknown and preserves last success time', async () => {
  const w = await page();
  vi.mocked(api.summary).mockRejectedValueOnce(new Error('读取失败'));
  await w
    .findAll('button')
    .find((b) => b.text() === '刷新数据')!
    .trigger('click');
  await flushPromises();
  expect(w.text()).toContain('未知');
  expect(w.text()).toContain('读取失败');
  expect(w.text()).toContain('最近成功刷新');
  expect(w.findAll('tbody tr')).toHaveLength(0);
  w.unmount();
});
it('partial failures remain unknown while successful sections render', async () => {
  const w = await page();
  const failed = fixture('SECADMIN', 'secadmin');
  failed.sections.approvals = { ready: false, data: {}, message: '审批读取失败' };
  vi.mocked(api.summary).mockResolvedValueOnce(failed);
  await w
    .findAll('button')
    .find((b) => b.text() === '刷新数据')!
    .trigger('click');
  await flushPromises();
  expect(w.text()).toContain('审批读取失败');
  expect(w.text()).toContain('暂无已过期或30天内到期');
  w.unmount();
});
it('invalid role fails closed before home data is requested', async () => {
  vi.mocked(product.session).mockResolvedValue({ role: 'UNKNOWN', username: 'x', tenantId: 9, permissions: [] });
  const w = mount(Home, { global: { plugins: [ElementPlus] } });
  await flushPromises();
  expect(api.summary).not.toHaveBeenCalled();
  expect(w.text()).toContain('没有有效的SVS产品角色');
  w.unmount();
});
