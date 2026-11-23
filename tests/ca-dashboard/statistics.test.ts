// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/views/ca/index.vue';
import { getCertStatistics, pageCert } from '@/api/ca/cert';

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

const slotStub = { template: '<div><slot /><slot name="default-extra" /></div>' };
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
      ElTableColumn: true,
      ElTimeline: true,
      ElTimelineItem: true
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
