import type { RouteRecordRaw } from 'vue-router';
import { cspProduct } from '@/config/csp';

export const cspRoutes: RouteRecordRaw[] = [
  {
    path: '/csp',
    redirect: cspProduct.home,
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
  }
];
