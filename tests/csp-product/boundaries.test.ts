import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ManagementFrame from '@/layout/components/ManagementFrame.vue';
import { assertCspProduct } from '@/config/csp';
import { consoleRequest, ConsoleRequestError } from '@/api/csp/gateway';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

import request from '@/utils/request';
vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ logout: vi.fn() }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('可信产品配置', () => {
  it('只接受显式CSP和精确tenant10', () => {
    expect(() => assertCspProduct('csp', '10')).not.toThrow();
  });
  it.each([
    [undefined, '10'],
    ['nas', '10'],
    ['csp', '7'],
    ['csp', '10,1'],
    ['csp', undefined]
  ])('拒绝错误产品或租户 %s/%s', (product, tenant) => {
    expect(() => assertCspProduct(product, tenant)).toThrow();
  });
});

describe('共享框架无认证副作用', () => {
  it('安全传输标志可通过storeToRefs消费，避免证书入口错误禁用', () => {
    vi.stubGlobal('location', new URL('http://localhost/login'));
    setActivePinia(createPinia());
    const store = useCspConsoleStore();
    expect(storeToRefs(store).secure.value).toBe(true);
  });
  it('保留平台依赖的结构、样式class和三个slot', () => {
    const wrapper = mount(ManagementFrame, {
      props: { hasTagsView: true, sidebarHidden: true },
      slots: { navigation: '<aside>navigation</aside>', header: '<header>header</header>', default: '<main>content</main>' }
    });
    expect(wrapper.classes()).toContain('app-wrapper');
    expect(wrapper.get('.main-container').classes()).toEqual(expect.arrayContaining(['hasTagsView', 'sidebarHide']));
    expect(wrapper.get('aside').text()).toBe('navigation');
    expect(wrapper.get('.main-container header').text()).toBe('header');
    expect(wrapper.get('.main-container main').text()).toBe('content');
    wrapper.unmount();
  });
});

describe('平台网关契约', () => {
  it('安装通过网关获取并转换版本号', async () => {
    vi.mocked(request).mockResolvedValue({ code: 'OK', data: { initialized: false, draftVersion: '3' } });
    await expect(consoleRequest('installation')).resolves.toMatchObject({ initialized: false, draftVersion: 3 });
    expect(request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url: '/csp/v2/setup', method: 'get' }));
  });
  it('拒绝任意代理路径，且不发出请求', async () => {
    await expect(consoleRequest('../auth' as 'session')).rejects.toThrow('请求不受支持');
    expect(request).not.toHaveBeenCalled();
  });
  it('失败时保留冲突状态供页面刷新并避免重发写请求', async () => {
    vi.mocked(request).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { msg: '版本已变化' } } });
    await expect(consoleRequest('application-publish', { applicationId: 'ba_example', expectedVersion: '1' })).rejects.toMatchObject({
      status: 409,
      message: '版本已变化'
    });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        url: '/csp/v3/applications/ba_example/authorization-publish',
        method: 'post',
        data: { expectedVersion: '1' }
      })
    );
    expect(new ConsoleRequestError('test', 401)).toBeInstanceOf(Error);
  });
});
