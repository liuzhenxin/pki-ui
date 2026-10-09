import type { RouteRecordRaw } from 'vue-router';

// Lazy layout loading keeps route definitions independent of router/store bootstrap.
export const svsInitializationRoute: RouteRecordRaw = {
  path: '/svs',
  component: () => import('@/layout/index.vue'),
  name: 'SvsInitializationLayout',
  redirect: '/svs/init',
  children: [{ path: 'init', component: () => import('@/views/svs/init/index.vue'), name: 'SvsInitialization', meta: { title: 'SVS 初始化', icon: 'settings', noCache: true } }]
};
