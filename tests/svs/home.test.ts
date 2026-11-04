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
    keys: section({ total: 2 }),
    certificates: section({ expiring: 0, expired: 0, rows: [] }),
    grants: section({ total: 1, validBindings: 0, rows: [{ id: 'grant', applicationId: 'oa', expiresAt: '2026-10-10T00:00:00Z' }] }),
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
        { title: '授权', mutable: true, path: '/svs/grants', children: [] },
        { title: '运行', mutable: false, path: '/svs/runtime', children: [] }
      ]
    }
  ]);
});
it('security home shows resources and opens grants without approval actions', async () => {
  const w = await page('SECADMIN', 'secadmin');
  expect(w.text()).toContain('安全工作台');
  expect(w.text()).toContain('密钥引用');
  expect(w.text()).not.toContain('待我审批');
  expect(w.text()).not.toContain('我的待执行');
  await w
    .findAll('button')
    .find((b) => b.text() === '查看授权')!
    .trigger('click');
  expect(navigation.push).toHaveBeenCalledWith({ path: '/svs/grants', query: undefined });
  w.unmount();
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
  failed.sections.grants = { ready: false, data: {}, message: '授权读取失败' };
  vi.mocked(api.summary).mockResolvedValueOnce(failed);
  await w
    .findAll('button')
    .find((b) => b.text() === '刷新数据')!
    .trigger('click');
  await flushPromises();
  expect(w.text()).toContain('授权读取失败');
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
