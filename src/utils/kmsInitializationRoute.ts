import type { RouteRecordRaw } from 'vue-router';
export const kmsInitializationRoute: RouteRecordRaw = {
  path: '/kms',
  component: () => import('@/layout/index.vue'),
  name: 'KmsInitializationLayout',
  redirect: '/kms/init',
  children: [
    {
      path: 'init',
      component: () => import('@/views/kms/init/index.vue'),
      name: 'KmsInitialization',
      meta: { title: 'KMS 初始化', icon: 'settings', noCache: true }
    }
  ]
};
export function kmsInitializationRedirect(locked: boolean, path: string): string {
  if (!locked && path !== '/kms/init') return '/kms/init';
  if (locked && (path === '/kms/init' || path === '/')) return '/index';
  return '';
}
