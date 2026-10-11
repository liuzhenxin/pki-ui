import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

export const hsmConstantRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: '/hsm/home', hidden: true },
  { path: '/index', redirect: '/hsm/home', hidden: true },
  { path: '/login', component: () => import('@/views/login.vue'), hidden: true },
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
    path: '/user',
    component: Layout,
    hidden: true,
    children: [{ path: 'profile', name: 'HsmProfile', component: () => import('@/views/system/user/profile/index.vue'), meta: { title: '个人中心' } }]
  },
  { path: '/system/user/profile', redirect: '/user/profile', hidden: true }
];
