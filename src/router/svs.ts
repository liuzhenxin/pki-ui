import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

import { svsInitializationRoute } from '@/utils/svsInitializationRoute';
export { svsInitializationRoute } from '@/utils/svsInitializationRoute';

export const svsConstantRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: '/svs/runtime', hidden: true },
  { path: '/index', redirect: '/svs/runtime', hidden: true },
  { path: '/login', component: () => import('@/views/login.vue'), hidden: true },
  { ...svsInitializationRoute, hidden: true },
  { path: '/social-callback', component: () => import('@/layout/components/SocialCallback/index.vue'), hidden: true },
  { path: '/401', component: () => import('@/views/error/401.vue'), hidden: true },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/error/404.vue'), hidden: true },
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    children: [{ path: '/redirect/:path(.*)', component: () => import('@/views/redirect/index.vue') }]
  },
  {
    path: '/system/user',
    component: Layout,
    hidden: true,
    children: [
      { path: 'profile', component: () => import('@/views/system/user/profile/index.vue'), name: 'UserProfile', meta: { title: '平台个人中心' } }
    ]
  }
];
