import { beforeEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import System from '@/views/svs/system/index.vue';
import { deviceInformation } from '@/api/svs/system';
import { getSvsInitialization, getSvsInitPlan } from '@/api/svs/init';
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api/svs/system', () => ({ deviceInformation: vi.fn() }));
vi.mock('@/api/svs/init', () => ({ getSvsInitialization: vi.fn(), getSvsInitPlan: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSvsInitialization).mockResolvedValue({ locked: true } as any);
  vi.mocked(deviceInformation).mockResolvedValue({
    server: { productName: '签名验签服务器', architecture: 'x86_64' },
    device: { state: 'DEGRADED' },
    observedAt: '2026-10-09T08:00:00Z'
  } as any);
  vi.mocked(getSvsInitPlan).mockResolvedValue({ hostType: 'STANDALONE', deployment: { '管理端口': '9088', '敏感配置': 'not-visible' } } as any);
});
async function render(page: string) {
  const w = mount(System, { props: { page, title: page }, global: { plugins: [ElementPlus] } });
  await flushPromises();
  return w;
}
it('device information preserves unknown fields and degraded status', async () => {
  const w = await render('device');
  expect(w.text()).toContain('未获取');
  expect(w.text()).toContain('降级');
  expect(w.text()).toContain('x86_64');
  expect(w.text()).not.toContain('海光');
  w.unmount();
});
it('failed refresh removes prior device values', async () => {
  const w = await render('device');
  vi.mocked(deviceInformation).mockRejectedValue(new Error('internal path'));
  await w.get('button').trigger('click');
  await flushPromises();
  expect(w.text()).toContain('当前状态未知');
  expect(w.text()).not.toContain('x86_64');
  expect(w.text()).not.toContain('internal path');
  w.unmount();
});
it('network configuration only shows approved fields and has no write actions', async () => {
  const w = await render('network');
  expect(w.text()).toContain('9088');
  expect(w.text()).not.toContain('not-visible');
  expect(w.text()).toContain('不修改网卡');
  expect(deviceInformation).not.toHaveBeenCalled();
  expect(w.findAll('button').map((b) => b.text())).toEqual(['刷新']);
  w.unmount();
});
it('initialization information is read-only and reflects completion state', async () => {
  const w = await render('initialization-info');
  expect(w.text()).toContain('初始化已完成');
  expect(w.text()).toContain('admin / secadmin / auditor');
  expect(w.findAll('button').map((b) => b.text())).toEqual(['刷新']);
  w.unmount();
});
it('changing the route page reloads network data instead of retaining device data', async () => {
  const w = await render('device');
  await w.setProps({ page: 'network', title: '网络配置' });
  await flushPromises();
  expect(getSvsInitPlan).toHaveBeenCalledOnce();
  expect(w.text()).toContain('9088');
  expect(w.text()).not.toContain('x86_64');
  w.unmount();
});
