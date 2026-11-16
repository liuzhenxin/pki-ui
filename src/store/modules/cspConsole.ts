import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ConsoleNavigation, SetupView } from '@/api/csp/console';
import { consoleRequest, ConsoleRequestError } from '@/api/csp/gateway';
import { cspProduct } from '@/config/csp';
import { useUserStore } from './user';

export const useCspConsoleStore = defineStore('csp-console', () => {
  const busy = ref(false);
  const error = ref('');
  const signedIn = ref(false);
  const navigation = ref<ConsoleNavigation>({});
  const checkedAt = ref('');
  const setup = ref<SetupView | null>(null);
  const secure = computed(() => location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
  const canInitialize = computed(() => navigation.value.canInitialize === true);
  const installationInitialized = computed(() => navigation.value.initialized ?? null);
  const canOperateApplications = computed(() => navigation.value.canOperateApplications === true);
  const ownedApplications = canOperateApplications;

  function allows(path: string) {
    if (path === '/csp/unavailable') return true;
    if (!signedIn.value) return false;
    if (path === cspProduct.installation) return canInitialize.value && installationInitialized.value === false;
    if (installationInitialized.value !== true) return false;
    switch (path) {
      case cspProduct.home:
        return canInitialize.value;
      case '/csp/application-resources':
        return canOperateApplications.value;
      case '/csp/management':
        return !ownedApplications.value && navigation.value.canManageServices === true;
      case '/csp/applications':
        return ownedApplications.value || navigation.value.canManageServices === true;
      case '/csp/services/svs':
      case '/csp/services/tsa':
      case '/csp/services/sef':
        return canOperateApplications.value || (!ownedApplications.value && navigation.value.canManageServices === true);
      case '/csp/devices':
        return navigation.value.canManageDevices === true;
      case '/csp/auditors':
        return navigation.value.canManageAuditors === true;
      case '/csp/login-logs':
        return navigation.value.canReadLoginLogs === true;
      case '/csp/operation-logs':
        return navigation.value.canReadOperationLogs === true;
      default:
        return false;
    }
  }

  function clearSession() {
    signedIn.value = false;
    navigation.value = {};
    checkedAt.value = '';
    setup.value = null;
    error.value = '';
  }

  async function logout() {
    clearSession();
    await useUserStore().logout();
  }

  async function restore() {
    try {
      const session = await consoleRequest('session');
      if (session?.authenticated !== true || typeof session.initialized !== 'boolean' || typeof session.canInitialize !== 'boolean')
        throw new Error('CSP 会话状态无效。');
      navigation.value = session;
      signedIn.value = true;
      error.value = '';
    } catch (failure) {
      if (failure instanceof ConsoleRequestError && failure.status === 401) await logout();
      else clearSession();
      error.value = (failure as Error).message;
    }
  }

  async function refresh() {
    if (busy.value || !canInitialize.value) return;
    busy.value = true;
    error.value = '';
    setup.value = null;
    checkedAt.value = '';
    try {
      applySetup(await consoleRequest('setup'));
    } catch (failure) {
      if (failure instanceof ConsoleRequestError && failure.status === 401) await logout();
      error.value = (failure as Error).message;
    } finally {
      busy.value = false;
    }
  }

  function applySetup(data: SetupView) {
    if (
      data?.workflow !== 'SERVICE_ACTIVATION_V3' ||
      typeof data.initialized !== 'boolean' ||
      !Number.isSafeInteger(data.draftVersion) ||
      !Number.isInteger(data.step) ||
      data.step < 0 ||
      data.step > 3 ||
      !Array.isArray(data.checks) ||
      data.checks.length !== 9 ||
      !Array.isArray(data.enabledCapabilities)
    )
      throw new Error('服务启用状态无效，请联系运维核查。');
    setup.value = data;
    checkedAt.value = data.checkedAt ? new Date(data.checkedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '';
  }

  const destination = computed(() => {
    return (
      [
        cspProduct.installation,
        cspProduct.home,
        '/csp/management',
        '/csp/applications',
        '/csp/auditors',
        '/csp/login-logs',
        '/csp/operation-logs'
      ].find(allows) ?? '/csp/unavailable'
    );
  });
  return {
    busy,
    error,
    signedIn,
    canInitialize,
    allows,
    canOperateApplications,
    ownedApplications,
    checkedAt,
    setup,
    secure,
    destination,
    refresh,
    logout,
    restore
  };
});
