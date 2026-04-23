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

const isWhiteList = (path: string) => {
  return whiteList.some((pattern) => isPathMatch(pattern, path));
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
          const tenantId = useUserStore().tenantId || localStorage.getItem('tenantId') || '';
          const res = await getTenant(tenantId);
          if (res?.data) {
            let appTitle = res.data.name;
            const idStr = String(tenantId);
            if (idStr === '3') {
              appTitle += ' (KMC密钥管理中心)';
            } else if (idStr === '10') {
              appTitle += ' (NAS网络存储管理系统)';
            } else {
              appTitle += ' (CA证书认证系统)';
            }
            useSettingsStore().setAppTitle(appTitle);
          }
          if (res?.data?.status != -1) {
            //未初始化
            const accessRoutes = await usePermissionStore().generateInitRoutes();
            // 根据roles权限生成可访问的路由表
            accessRoutes.forEach((route) => {
              if (!isHttp(route.path)) {
                router.addRoute(route); // 动态添加可访问路由表
              }
            });
            // @ts-expect-error hack方法 确保addRoutes已完成
            next({ path: to.path, replace: true, params: to.params, query: to.query, hash: to.hash, name: to.name as string }); // hack方法 确保addRoutes已完成
          } else {
            const accessRoutes = await usePermissionStore().generateRoutes();
            // 根据roles权限生成可访问的路由表
            accessRoutes.forEach((route) => {
              if (!isHttp(route.path)) {
                router.addRoute(route); // 动态添加可访问路由表
              }
            });
            // @ts-expect-error hack方法 确保addRoutes已完成
            const targetPath = (to.path.includes('/init') || to.path.includes('/setup')) ? '/' : to.path;
            next({ path: targetPath, replace: true, params: to.params, query: to.query, hash: to.hash, name: to.name as string }); // hack方法 确保addRoutes已完成
          }
        }
      } else {
        next();
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
              let appTitle = res.data.name;
              const idStr = String(tenantId);
              if (idStr === '3') {
                appTitle += ' (KMC密钥管理中心)';
              } else if (idStr === '10') {
                appTitle += ' (NAS网络存储管理系统)';
              } else {
                appTitle += ' (CA证书认证系统)';
              }
              useSettingsStore().setAppTitle(appTitle);
            }
          })
          .catch(() => { });
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
