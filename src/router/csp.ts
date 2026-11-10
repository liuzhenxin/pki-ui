import { createRouter, createWebHistory, type RouterHistory } from 'vue-router';
import type { Pinia } from 'pinia';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
import { cspProduct } from '@/config/csp';

export function createCspRouter(pinia: Pinia, history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes: [
      { path: '/', redirect: cspProduct.home },
      { path: '/index', redirect: cspProduct.home },
      { path: '/login', component: () => import('@/views/csp/login/index.vue'), meta: { title: '登录' } },
      {
        path: '/csp',
        component: () => import('@/layout/CspLayout.vue'),
        meta: { title: '密码服务平台' },
        children: [
          { path: 'management', component: () => import('@/views/csp/management/index.vue'), meta: { title: '服务与应用管理' } },
          {
            path: 'applications',
            component: () => import('@/views/csp/applications/Entry.vue'),
            meta: { title: '应用列表' }
          },
          {
            path: 'application-resources',
            component: () => import('@/views/csp/management/index.vue'),
            props: { resourcesOnly: true },
            meta: { title: '服务与配额' }
          },
          { path: 'devices', component: () => import('@/views/csp/devices/index.vue'), meta: { title: '设备列表' } },
          {
            path: 'services/svs',
            component: () => import('@/views/csp/management/index.vue'),
            props: { family: 'SVS' },
            meta: { title: '签名验签服务器' }
          },
          {
            path: 'services/tsa',
            component: () => import('@/views/csp/management/index.vue'),
            props: { family: 'TSA' },
            meta: { title: '时间戳服务器' }
          },
          {
            path: 'services/sef',
            component: () => import('@/views/csp/management/index.vue'),
            props: { family: 'SEF' },
            meta: { title: '电子签章系统' }
          },
          { path: 'auditors', component: () => import('@/views/csp/audit/index.vue'), props: { kind: 'auditors' }, meta: { title: '审计员管理' } },
          { path: 'login-logs', component: () => import('@/views/csp/audit/index.vue'), props: { kind: 'login' }, meta: { title: '登录日志' } },
          {
            path: 'operation-logs',
            component: () => import('@/views/csp/audit/index.vue'),
            props: { kind: 'operation' },
            meta: { title: '操作日志' }
          },
          { path: 'unavailable', component: () => import('@/views/csp/not-found.vue'), meta: { title: '页面未开放' } },
          { path: 'installation', redirect: cspProduct.installation },
          { path: 'setup', component: () => import('@/views/csp/setup/index.vue'), meta: { title: '安装初始化' } },
          { path: 'overview', component: () => import('@/views/csp/overview/index.vue'), meta: { title: '运行总览' } }
        ]
      },
      { path: '/:pathMatch(.*)*', component: () => import('@/views/csp/not-found.vue'), meta: { title: '页面未开放' } }
    ],
    scrollBehavior: () => ({ top: 0 })
  });
  router.beforeEach(async (to) => {
    const store = useCspConsoleStore(pinia);
    // 每次导航重取受控会话/CSP状态；浏览器tenant、平台租户status和隐藏菜单均非授权依据。
    await store.restore(to.path !== '/csp/management');
    if (!store.signedIn) return to.path === '/login' ? true : { path: '/login', replace: true };
    if (!store.allows(to.path)) return { path: store.destination, replace: true };
    if (to.path === '/login') return { path: store.destination, replace: true };
    if (to.path === cspProduct.home && to.path !== store.destination) return { path: store.destination, replace: true };
    return true;
  });
  router.afterEach((to) => {
    document.title = `${String(to.meta.title || cspProduct.name)} · CSP`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }));
  });
  return router;
}
