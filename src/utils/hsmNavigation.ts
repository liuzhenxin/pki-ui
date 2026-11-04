import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

export const isHsmProduct = () => String(import.meta.env.VITE_APP_TENANT_IDS) === '7';

/** 页面复用已安装菜单的权限；身份审计仅查询 UKey 接口的最近记录。 */
export function buildHsmRoutes(hasPermission: (permission: string) => boolean): RouteRecordRaw[] {
  const children: RouteRecordRaw[] = [
    {
      path: 'home',
      name: 'HsmHome',
      component: () => import('@/views/hsm/home/index.vue'),
      meta: { title: '产品概览', icon: 'dashboard', affix: true, noCache: true }
    }
  ];
  if (hasPermission('hsm:init:view')) {
    children.push({
      path: 'initialization',
      name: 'HsmInitialization',
      component: () => import('@/views/hsm/initialization/index.vue'),
      meta: { title: '初始化状态', icon: 'system', noCache: true }
    });
  }
  if (hasPermission('hsm:ukey:view')) {
    children.push(
      {
        path: 'ukeys',
        name: 'HsmUkeys',
        component: () => import('@/views/hsm/ukeys/index.vue'),
        meta: { title: 'UKey 身份', icon: 'peoples', noCache: true }
      },
      {
        path: 'audit',
        name: 'HsmIdentityAudit',
        component: () => import('@/views/hsm/audit/index.vue'),
        meta: { title: '身份审计', icon: 'log', noCache: true }
      }
    );
  }
  return [
    { path: '/hsm', name: 'Hsm', component: Layout, redirect: '/hsm/home', alwaysShow: true, meta: { title: '服务器密码机', icon: 'lock' }, children }
  ];
}
