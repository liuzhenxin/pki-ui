import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

export const svsInitializationRoute: RouteRecordRaw = {
  path: '/svs',
  component: Layout,
  name: 'SvsInitializationLayout',
  redirect: '/svs/init',
  children: [{ path: 'init', component: () => import('@/views/svs/init/index.vue'), name: 'SvsInitialization', meta: { title: 'SVS 初始化', icon: 'settings', noCache: true } }]
};

export const svsConstantRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: '/svs/runtime', hidden: true },
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
