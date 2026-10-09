import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';
import { svsInitializationRoute } from '@/utils/svsInitializationRoute';
import { getSvsInitialization } from '@/api/svs/init';
import { menus } from '@/api/svs/product';
const pages = new Set([
  'home',
  'device',
  'network',
  'initialization-info',
  'runtime',
  'applications',
  'backup',
  'approvals',
  'grants',
  'bindings',
  'keys',
  'certificates',
  'trust',
  'policies',
  'roles',
  'audit',
  'opinions'
]);
export const isSvsProduct = () => String(import.meta.env.VITE_APP_TENANT_IDS) === '9';
export async function svsRoutes(): Promise<RouteRecordRaw[]> {
  if (!(await getSvsInitialization()).locked) return [svsInitializationRoute];
  const groups = await menus();
  const expanded = groups.some((group) => group.children.some((leaf) => leaf.path === '/svs/device'));
  return groups.map((group, index) => ({
    path: `/svs-group-${index}`,
    component: Layout,
    name: `SvsGroup${index}`,
    alwaysShow: true,
    meta: { title: group.title, icon: 'lock', svsExpanded: expanded },
    children: group.children
      .filter((leaf) => pages.has(leaf.path.split('/').pop() || ''))
      .map((leaf) => ({
        path: leaf.path,
        name: `Svs${leaf.path.split('/').pop()}`,
        component:
          leaf.path === '/svs/home'
            ? () => import('@/views/svs/home/index.vue')
            : ['/svs/device', '/svs/network', '/svs/initialization-info'].includes(leaf.path)
              ? () => import('@/views/svs/system/index.vue')
              : () => import('@/views/svs/product/index.vue'),
        props: { page: leaf.path.split('/').pop(), title: leaf.title, mutable: leaf.mutable },
        meta: { title: leaf.title }
      }))
  }));
}
