import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ManagementFrame from '@/layout/components/ManagementFrame.vue';
import { assertCspProduct } from '@/config/csp';
import { consoleRequest, ConsoleRequestError } from '@/api/csp/console';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

afterEach(() => vi.unstubAllGlobals());

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
    expect(store.accountTransport).toBe(true);
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

describe('固定BFF契约', () => {
  it('初始化仅向同源发送确认及CSRF，不从存储读取令牌', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ initialized: true, reauthenticationRequired: true })));
    vi.stubGlobal('fetch', fetcher);
    await consoleRequest('initialize', 'synthetic-csrf', { confirm: true });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('/console-api/initialize');
    expect(request).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', body: '{"confirm":true}' });
    expect(request.headers).toEqual({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic-csrf' });
  });
  it('拒绝任意代理路径，且不发出请求', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(consoleRequest('../auth' as 'state', '')).rejects.toThrow('请求不受支持');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('非成功响应只尝试一次，并保留状态供会话过期处理', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: '会话已过期' }), { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(consoleRequest('state', 'synthetic-csrf')).rejects.toMatchObject({ status: 401, message: '会话已过期' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(new ConsoleRequestError('test', 401)).toBeInstanceOf(Error);
  });
});
