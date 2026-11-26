// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/views/ca/index.vue';
import { getCertStatistics, pageCert } from '@/api/ca/cert';
import { getInitStatus } from '@/api/ca/init';

const user = vi.hoisted(() => ({ permissions: ['ca:cert:page'], tenantId: '4', name: 'operator', userId: '403' }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => user }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api/ca/cert', () => ({ getCertStatistics: vi.fn(), pageCert: vi.fn() }));
vi.mock('@/api/system/tenant', () => ({ getTenant: vi.fn(async () => ({ data: { status: -1 } })) }));
vi.mock('@/api/ca/init', () => ({ getInitStatus: vi.fn() }));
vi.mock('@/api/system/loginlog', () => ({ list: vi.fn() }));
vi.mock('@/api/system/operlog', () => ({ list: vi.fn() }));
vi.mock('echarts', () => ({
  init: () => ({ setOption: vi.fn(), dispose: vi.fn(), resize: vi.fn() }),
  graphic: { LinearGradient: vi.fn() }
}));

const slotStub = { template: '<div><slot name="header" /><slot /></div>' };
const options = {
  global: {
    stubs: {
      ElRow: slotStub,
      ElCol: slotStub,
      ElCard: slotStub,
      ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}<slot /></div>' },
      ElButton: { template: '<button><slot /></button>' },
      ElIcon: true,
      ElProgress: true,
      ElRadioGroup: true,
      ElRadioButton: true,
      ElTable: true,
      ElTimeline: true,
      ElTag: true
    },
    directives: { loading: () => {} },
    config: { warnHandler: () => {} }
  }
};
let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  vi.clearAllMocks();
  user.permissions = ['ca:cert:page'];
  vi.mocked(pageCert).mockResolvedValue({ data: { records: [{ certStatus: 'VALID' }], total: 1 } } as any);
  vi.mocked(getCertStatistics).mockResolvedValue({
    data: { totalCerts: 2405, validCerts: 2001, revokedCerts: 304, expiringSoon: 27 }
  } as any);
});
afterEach(() => wrapper?.unmount());

const cardValues = () => wrapper.findAll('.stat-value').map((card) => card.text());

describe('CA homepage content', () => {
  it('shows only the version in business system information and omits the recent certificate and audit panels', async () => {
    vi.stubEnv('VITE_APP_VERSION', 'test-version');
    try {
      wrapper = mount(Dashboard, options);
      await flushPromises();
      const systemInfo = wrapper.get('.system-info-card');
      expect(systemInfo.text()).toContain('系统信息');
      expect(systemInfo.get('.version-item .value').text()).toBe('test-version');
      for (const label of ['技术支持', '联系电话', '证书模板', '根CA', '签名者', '发布者']) {
        expect(systemInfo.text()).not.toContain(label);
      }
      expect(wrapper.text()).not.toContain('最新签发证书');
      expect(wrapper.text()).not.toContain('安全审计事件');
      expect(getInitStatus).not.toHaveBeenCalled();
      expect(pageCert).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('loads configuration counts for the system administrator workspace', async () => {
    user.permissions = ['ca:setup'];
    vi.mocked(getInitStatus).mockResolvedValue({ data: { rootCount: 2, profileCount: 4 } } as any);
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(wrapper.get('.admin-metric-grid').text()).toContain('根 CA2');
    expect(wrapper.get('.admin-metric-grid').text()).toContain('证书模板4');
    expect(getInitStatus).toHaveBeenCalledTimes(1);
    expect(pageCert).not.toHaveBeenCalled();
  });
});

describe('CA homepage statistics', () => {
  it('uses full server counts including archives independently of the certificate page', async () => {
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(cardValues()).toEqual(['2405', '2001', '304', '27']);
    expect(wrapper.text()).toContain('占比 83%');
    expect(getCertStatistics).toHaveBeenCalledTimes(1);
  });

  it('accepts the string counts produced by the platform long serializer', async () => {
    vi.mocked(getCertStatistics).mockResolvedValue({
      data: { totalCerts: '2405', validCerts: '2001', revokedCerts: '304', expiringSoon: '27' }
    } as any);
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(cardValues()).toEqual(['2405', '2001', '304', '27']);
    expect(wrapper.text()).toContain('占比 83%');
  });

  it('shows zero counts and a zero percentage for an empty application', async () => {
    vi.mocked(getCertStatistics).mockResolvedValue({ data: { totalCerts: 0, validCerts: 0, revokedCerts: 0, expiringSoon: 0 } } as any);
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(cardValues()).toEqual(['0', '0', '0', '0']);
    expect(wrapper.text()).toContain('占比 0%');
  });

  it('shows unknown values on failure and supports retry', async () => {
    vi.mocked(getCertStatistics).mockRejectedValueOnce(new Error('offline'));
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(cardValues()).toEqual(['—', '—', '—', '—']);
    expect(wrapper.get('[role="alert"]').text()).toContain('证书统计加载失败');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(cardValues()).toEqual(['2405', '2001', '304', '27']);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('does not let a failed certificate list erase successful statistics', async () => {
    vi.mocked(pageCert).mockRejectedValueOnce(new Error('list unavailable'));
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(cardValues()).toEqual(['2405', '2001', '304', '27']);
  });

  it('rejects missing counts instead of displaying an apparently successful zero', async () => {
    vi.mocked(getCertStatistics).mockResolvedValue({ data: {} } as any);
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(cardValues()).toEqual(['—', '—', '—', '—']);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('refreshes counts when returning to the cached homepage', async () => {
    const visible = ref(true);
    const Host = defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => (visible.value ? h(Dashboard) : null) }) });
    wrapper = mount(Host, options);
    await flushPromises();
    visible.value = false;
    await flushPromises();
    vi.mocked(getCertStatistics).mockResolvedValue({ data: { totalCerts: 2406, validCerts: 2001, revokedCerts: 305, expiringSoon: 27 } } as any);
    visible.value = true;
    await flushPromises();
    expect(cardValues()).toEqual(['2406', '2001', '305', '27']);
    expect(getCertStatistics).toHaveBeenCalledTimes(2);
  });

  it('does not request certificate counts without certificate page access', async () => {
    user.permissions = [];
    wrapper = mount(Dashboard, options);
    await flushPromises();
    expect(getCertStatistics).not.toHaveBeenCalled();
    expect(cardValues()).toEqual([]);
  });
});
