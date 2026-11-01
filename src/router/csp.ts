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
          { path: 'setup', component: () => import('@/views/csp/setup/index.vue'), meta: { title: '资源接入与服务启用' } },
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
    await store.restore();
    if (!store.signedIn) return to.path === '/login' ? true : { path: '/login', replace: true };
    if (to.path === '/login') return { path: store.destination, replace: true };
    if ((to.path === cspProduct.setup || to.path === cspProduct.home) && to.path !== store.destination)
      return { path: store.destination, replace: true };
    return true;
  });
  router.afterEach((to) => {
    document.title = `${String(to.meta.title || cspProduct.name)} · CSP`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }));
  });
  return router;
}
