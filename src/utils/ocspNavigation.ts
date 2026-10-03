import type { RouteRecordRaw } from 'vue-router';

const definitions: Record<string, { title: string; icon: string; order: number; group?: string }> = {
  'ocsp/dashboard/index': { title: '服务概览', icon: 'dashboard', order: 0 },
  'ocsp/responder/index': { title: '响应者管理', icon: 'cert', order: 1 },
  'ocsp/ca-source/index': { title: '按 CA 配置', icon: 'tree', order: 2, group: '状态数据源' },
  'ocsp/source/index': { title: '默认来源', icon: 'tree', order: 3, group: '状态数据源' },
  'ocsp/log/index': { title: '请求日志', icon: 'log', order: 5 },
  'ocsp/status/index': { title: '诊断工具', icon: 'search', order: 6 },
  'ocsp/config/index': { title: '运行参数', icon: 'edit', order: 7, group: '系统设置' },
  'ocsp/user/index': { title: '用户管理', icon: 'peoples', order: 8, group: '系统设置' },
  'ocsp/init/index': { title: '安装向导', icon: 'guide', order: 9, group: '系统设置' }
};

/** Reorganize only server-authorized OCSP entries; retain their absolute URLs and hidden flags. */
export const buildOcspNavigation = (routes: RouteRecordRaw[], monitoringAllowed: boolean): RouteRecordRaw[] => {
  const entries: Array<{ route: RouteRecordRaw; order: number; group?: string }> = [];
  const walk = (items: RouteRecordRaw[], base = '', ancestorHidden = false): RouteRecordRaw[] =>
    items.flatMap((item) => {
      const path = item.path.startsWith('/') ? item.path : `${base}/${item.path}`.replace(/\/+/g, '/');
      const component = String(item.component ?? '');
      const definition = definitions[component];
      if (definition && !item.children?.length) {
        entries.push({
          route: { ...item, hidden: ancestorHidden || item.hidden, path, meta: { ...item.meta, title: definition.title, icon: definition.icon } },
          ...definition
        });
        return [];
      }
      if (!item.children?.length) return [item];
      const children = walk(item.children, path, ancestorHidden || Boolean(item.hidden));
      return children.length ? [{ ...item, children }] : [];
    });
  const remaining = walk(routes);
  if (!entries.length) return routes;
  entries.sort((a, b) => a.order - b.order);
  const result: RouteRecordRaw[] = [];
  const groupRoutes = new Map<string, RouteRecordRaw>();
  for (const entry of entries) {
    const group = entry.group || entry.route.meta?.title?.toString() || '';
    let container = groupRoutes.get(group);
    if (!container) {
      container = {
        path: `/ocsp-navigation/${entry.order}`,
        component: 'Layout' as any,
        alwaysShow: Boolean(entry.group),
        meta: { title: group, icon: entry.route.meta?.icon },
        children: []
      };
      groupRoutes.set(group, container);
      result.push(container);
    }
    container.children!.push(entry.route);
  }
  for (const container of result) container.hidden = container.children?.every((child) => child.hidden) || false;
  if (monitoringAllowed && entries.some((entry) => !entry.route.hidden && entry.order !== 9)) {
    result.splice(Math.min(3, result.length), 0, {
      path: '/ocsp/monitoring',
      component: 'Layout' as any,
      meta: { title: '运行监控', icon: 'monitor' },
      children: [{ path: '', component: 'ocsp/monitoring/index' as any, meta: { title: '运行监控', icon: 'monitor' } }]
    } as RouteRecordRaw);
  }
  return [...result, ...remaining];
};
