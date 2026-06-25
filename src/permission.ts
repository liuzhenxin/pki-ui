import { to as tos } from 'await-to-js';
import router from './router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { getToken } from '@/utils/auth';
import { isHttp, isPathMatch } from '@/utils/validate';
import { isRelogin } from '@/utils/request';
import { useUserStore } from '@/store/modules/user';
import { useSettingsStore } from '@/store/modules/settings';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage } from 'element-plus/es';
import { getTenant } from '@/api/system/tenant';
import setting from '@/settings';

NProgress.configure({ showSpinner: false });
const whiteList = ['/login', '/register', '/social-callback', '/register*', '/register/*'];
const caInitPath = '/ca/setup';
const licenseInitPath = '/license/setup';
const kmcInitPath = '/kmc/setup';
const raInitPath = '/ra/setup';
const ocspInitPath = '/ocsp/setup';

const isWhiteList = (path: string) => {
  return whiteList.some((pattern) => isPathMatch(pattern, path));
};

const getCurrentTenantId = () => useUserStore().tenantId || localStorage.getItem('tenantId') || '';

const getCurrentInitPath = () => {
  const tenantId = String(getCurrentTenantId());
  if (tenantId === '2') {
    return licenseInitPath;
  }
  if (tenantId === '3') {
    return kmcInitPath;
  }
  if (tenantId === '5') {
    return raInitPath;
  }
  if (tenantId === '6') {
    return ocspInitPath;
  }
  return caInitPath;
};

const isInitRoute = (path: string) =>
  path === caInitPath || path === licenseInitPath || path === kmcInitPath || path === raInitPath || path === ocspInitPath || path.includes('/setup');

const isTenantInitialized = (status: unknown) => Number(status) === -1;

const getTenantAppTitle = (tenantName: string, tenantId: string, longName = false) => {
  if (tenantId === '2') {
    return `${tenantName} (${longName ? 'License授权系统' : 'License'})`;
  }
  if (tenantId === '3') {
    return `${tenantName} (${longName ? '密钥管理中心' : 'KMC'})`;
  }
  if (tenantId === '5') {
    return `${tenantName} (${longName ? '注册认证中心' : 'RA'})`;
  }
  if (tenantId === '6') {
    return `${tenantName} (${longName ? '在线证书状态服务' : 'OCSP'})`;
  }
  if (tenantId === '10') {
    return `${tenantName} (${longName ? 'NAS网络存储管理系统' : 'NAS'})`;
  }
  return `${tenantName} (CA)`;
};

const loadCurrentTenant = async () => {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    return undefined;
  }
  return getTenant(tenantId);
};

const syncTenantContext = async () => {
  const tenantId = getCurrentTenantId();
  const res = await loadCurrentTenant();
  if (res?.data) {
    useSettingsStore().setAppTitle(getTenantAppTitle(res.data.name, String(tenantId)));
    useUserStore().setTenantInitStatus(Number(res.data.status));
  }
  return res;
};

const ensureTenantBoundary = async (path: string) => {
  const userStore = useUserStore();
  let status = userStore.tenantInitStatus;
  if (status === undefined) {
    const res = await syncTenantContext();
    status = Number(res?.data?.status);
  }
  if (!isTenantInitialized(status) && !isInitRoute(path)) {
    return getCurrentInitPath();
  }
  if (isTenantInitialized(status) && isInitRoute(path)) {
    return '/';
  }
  return '';
};

router.beforeEach(async (to, from, next) => {
  NProgress.start();
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title as string);
    /* has token*/
    if (to.path === '/login') {
      next({ path: '/' });
      NProgress.done();
    } else if (isWhiteList(to.path)) {
      next();
    } else {
      if (useUserStore().permissions.length === 0) {
        isRelogin.show = true;
        // 判断当前用户是否已拉取完user_info信息
        const [err] = await tos(useUserStore().getInfo());
        if (err) {
          await useUserStore().logout();
          ElMessage.error(err);
          next({ path: '/' });
        } else {
          isRelogin.show = false;
          const res = await syncTenantContext();
          const tenantInitialized = isTenantInitialized(res?.data?.status);
          if (res?.data && !tenantInitialized) {
            const accessRoutes = await usePermissionStore().generateInitRoutes();
            accessRoutes.forEach((route) => {
              if (!isHttp(route.path)) {
                router.addRoute(route);
              }
            });
            const targetInitPath = getCurrentInitPath();
            const targetPath = isInitRoute(to.path) ? to.path : targetInitPath;
            next({ path: targetPath, replace: true, params: to.params, query: targetPath === targetInitPath ? {} : to.query, hash: to.hash });
          } else {
            const accessRoutes = await usePermissionStore().generateRoutes();
            accessRoutes.forEach((route) => {
              if (!isHttp(route.path)) {
                router.addRoute(route);
              }
            });
            const targetPath = isInitRoute(to.path) ? '/' : to.path;
            next({ path: targetPath, replace: true, params: to.params, query: to.query, hash: to.hash });
          }
        }
      } else {
        const boundaryPath = await ensureTenantBoundary(to.path);
        if (boundaryPath) {
          next({ path: boundaryPath, replace: true });
        } else {
          next();
        }
      }
    }
  } else {
    // 没有token
    if (isWhiteList(to.path)) {
      // 在免登录白名单，直接进入, 并且获取租户信息, 如果有租户id
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) {
        getTenant(tenantId)
          .then((res) => {
            if (res?.data) {
              useSettingsStore().setAppTitle(getTenantAppTitle(res.data.name, String(tenantId), true));
            }
          })
          .catch(() => {});
      }
      next();
    } else {
      const redirect = encodeURIComponent(to.fullPath || '/');
      next(`/login?redirect=${redirect}`); // 否则全部重定向到登录页
      NProgress.done();
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});
