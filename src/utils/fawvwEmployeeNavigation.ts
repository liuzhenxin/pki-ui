import type { RouteRecordRaw, Router } from 'vue-router';

export const employeeDirectoryPath = '/ra-employees/ra-employee';
export const isRaApplicantDirectory = (component: unknown): boolean => /^ra\/user(?:\/index)?$/.test(String(component ?? ''));
export const isRaDepartmentDirectory = (component: unknown): boolean => /^ra\/dept(?:\/index)?$/.test(String(component ?? ''));
export const applicantDirectoryPath = (router: Router): string | undefined =>
  router.getRoutes().find((route) => route.meta.fawvwApplicantDirectory === true)?.path;
export const departmentDirectoryPath = (router: Router): string | undefined =>
  router.getRoutes().find((route) => route.meta.fawvwDepartmentDirectory === true)?.path;
export const directoryQueryId = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) ? value : undefined;

export const groupFawvwEmployeeNavigation = (routes: RouteRecordRaw[]): RouteRecordRaw[] => {
  const employeeGroup = routes.find((route) => /^\/?ra-employees\/?$/.test(route.path) && !route.hidden && route.children?.length);
  if (!employeeGroup) return routes;

  const collect = (items: RouteRecordRaw[]): RouteRecordRaw[] =>
    items.flatMap((item) => {
      if (item === employeeGroup || item.hidden) return [item];
      if (!item.children?.length) {
        return isRaApplicantDirectory(item.component) || isRaDepartmentDirectory(item.component) ? [] : [item];
      }
      const children = collect(item.children);
      return children.length ? [{ ...item, children }] : [];
    });

  return collect(routes);
};
