import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { consoleRequest, ConsoleRequestError, type ConsoleResponses, type ConsoleCommands, type ConsoleNavigation } from '@/api/csp/console';
import { skfCall, closeSkf, normalizeSkfSignature } from '@/services/csp/skf';
import { cspProduct } from '@/config/csp';

export const useCspConsoleStore = defineStore('csp-console', () => {
  const loginMode = ref<'account' | 'certificate'>('account');
  const certificateEnabled = ref(false);
  const pin = ref('');
  const certificates = ref<{ key: string; cert: string; label: string }[]>([]);
  const certificateKey = ref('');
  function switchMode(mode: 'account' | 'certificate') {
    loginMode.value = mode;
    pin.value = '';
    password.value = '';
    error.value = '';
  }
  async function readCertificates() {
    if (busy.value || !secure.value || !certificateEnabled.value) return;
    busy.value = true;
    error.value = '';
    certificates.value = [];
    certificateKey.value = '';
    pin.value = '';
    try {
      const result = await skfCall('FindCertificates', ['Sign']);
      if (!Array.isArray(result)) throw new Error('本机证书列表无效。');
      certificates.value = result
        .filter((item) => item?.type === 'Sign' && typeof item.key === 'string' && typeof item.cert === 'string')
        .map((item, index) => ({
          key: item.key,
          cert: item.cert.replace(/\s+/g, ''),
          label: `签名证书 ${index + 1} · ${String(item.value || item.key).slice(0, 180)}`
        }));
      certificateKey.value = certificates.value[0]?.key || '';
      if (!certificateKey.value) throw new Error('USB Key 中未发现签名证书。');
    } catch (failure) {
      error.value = (failure as Error).message;
    } finally {
      closeSkf();
      busy.value = false;
    }
  }
  async function certificateLogin() {
    if (busy.value || !secure.value || !certificateEnabled.value) return;
    const certificate = certificates.value.find((item) => item.key === certificateKey.value);
    if (!certificate || !pin.value) {
      error.value = '请选择签名证书并输入 PIN。';
      return;
    }
    busy.value = true;
    error.value = '';
    try {
      const challenge = await api('certificate-challenge', { certificate: certificate.cert });
      const verified = await skfCall('CheckPIN', [certificate.key, pin.value]);
      pin.value = '';
      if (verified !== true) throw new Error('PIN 验证未通过；不会自动重试。');
      const { calculateSm2SignatureDigest } = await import('@/utils/sm2SignatureDigest');
      const digest = calculateSm2SignatureDigest(certificate.cert, challenge.signData, challenge.sm2UserId);
      const rawSignature = await skfCall('SignData', [certificate.key, digest]);
      if (typeof rawSignature !== 'string') throw new Error('USB Key 签名响应无效。');
      const login = await api('certificate-login', { challengeId: challenge.challengeId, signature: normalizeSkfSignature(rawSignature) });
      applyNavigation(login);
      certificates.value = [];
      certificateKey.value = '';
      signedIn.value = true;
      await readInstallationState();
    } catch (failure) {
      error.value = (failure as Error).message;
    } finally {
      closeSkf();
      pin.value = '';
      busy.value = false;
    }
  }

  const username = ref('');
  const password = ref('');
  const captcha = ref('');
  const image = ref('');
  const csrf = ref('');
  const captchaEnabled = ref(true);
  const busy = ref(false);
  const error = ref('');
  const signedIn = ref(false);
  const canInitialize = ref(true);
  const installationInitialized = ref<boolean | null>(null);
  const navigation = ref<ConsoleNavigation>({});
  function applyNavigation(session: ConsoleNavigation) {
    canInitialize.value = session.canInitialize !== false;
    installationInitialized.value = session.initialized ?? null;
    navigation.value = {
      canManageServices: session.canManageServices !== false,
      canManageDevices: session.canManageDevices === true,
      canOperateApplications: session.canOperateApplications === true,
      canManageAuditors: session.canManageAuditors === true,
      canReadLoginLogs: session.canReadLoginLogs === true,
      canReadOperationLogs: session.canReadOperationLogs === true
    };
  }
  const canOperateApplications = computed(() => navigation.value.canOperateApplications === true);
  const ownedApplications = canOperateApplications;

  function allows(path: string) {
    if (path === '/csp/unavailable') return true;
    if (path === cspProduct.installation) return canInitialize.value && installationInitialized.value !== true;
    if (installationInitialized.value !== true) return false;
    switch (path) {
      case cspProduct.home:
        return canInitialize.value;
      case '/csp/application-resources':
        return canOperateApplications.value;
      case '/csp/management':
        return !ownedApplications.value && navigation.value.canManageServices !== false;
      case '/csp/applications':
        return ownedApplications.value || navigation.value.canManageServices !== false;
      case '/csp/services/svs':
      case '/csp/services/tsa':
      case '/csp/services/sef':
        return canOperateApplications.value || (!ownedApplications.value && navigation.value.canManageServices !== false);
      case '/csp/devices':
        return navigation.value.canManageDevices === true;
      case '/csp/auditors':
        return navigation.value.canManageAuditors === true;
      case '/csp/login-logs':
        return navigation.value.canReadLoginLogs === true;
      case '/csp/operation-logs':
        return navigation.value.canReadOperationLogs === true;
      default:
        return true;
    }
  }
  const checkedAt = ref('');
  const setup = ref<import('@/api/csp/console').SetupView | null>(null);
  const secure = computed(() => location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
  const httpTestMode = ref(false);
  const accountTransport = computed(() => secure.value || httpTestMode.value);
  function api<K extends keyof ConsoleResponses>(path: K, body?: ConsoleCommands[K]): Promise<ConsoleResponses[K]> {
    return consoleRequest(path, csrf.value, body);
  }

  async function challenge() {
    image.value = '';
    captcha.value = '';
    const data = await api('challenge');
    csrf.value = data.csrf;
    captchaEnabled.value = data.captchaEnabled;
    image.value = data.image;
  }

  async function refresh() {
    if (busy.value || !canInitialize.value) return;
    busy.value = true;
    error.value = '';
    setup.value = null;
    checkedAt.value = '';
    try {
      applySetup(await api('setup'));
    } catch (failure) {
      if (failure instanceof ConsoleRequestError && failure.status === 401) signedIn.value = false;
      error.value = (failure as Error).message;
    } finally {
      busy.value = false;
    }
  }

  function applySetup(data: import('@/api/csp/console').SetupView) {
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

  async function readInstallationState() {
    if (installationInitialized.value !== null || !canInitialize.value) return;
    busy.value = true;
    error.value = '';
    setup.value = null;
    try {
      const installation = await api('installation');
      if (typeof installation?.initialized !== 'boolean') throw new Error('安装初始化状态无效，请联系运维核查。');
      installationInitialized.value = installation.initialized;
      signedIn.value = true;
    } catch (failure) {
      installationInitialized.value = null;
      setup.value = null;
      checkedAt.value = '';
      if (failure instanceof ConsoleRequestError && failure.status === 401) signedIn.value = false;
      error.value = (failure as Error).message;
    } finally {
      busy.value = false;
    }
  }

  async function login() {
    if (busy.value || !accountTransport.value) return;
    busy.value = true;
    error.value = '';
    try {
      const login = await api('login', { username: username.value.trim(), password: password.value, captcha: captcha.value });
      applyNavigation(login);
      password.value = '';
      captcha.value = '';
      image.value = '';
      signedIn.value = true;
      await readInstallationState();
    } catch (failure) {
      password.value = '';
      captcha.value = '';
      image.value = '';
      error.value = (failure as Error).message;
    } finally {
      busy.value = false;
    }
  }

  async function reloadChallenge() {
    busy.value = true;
    error.value = '';
    try {
      await challenge();
    } catch {
      error.value = '认证服务暂不可用，请手动刷新验证码。';
    } finally {
      busy.value = false;
    }
  }

  async function logout() {
    busy.value = true;
    error.value = '';
    try {
      await api('logout', {});
      signedIn.value = false;
      applyNavigation({});
      installationInitialized.value = null;
      setup.value = null;
      checkedAt.value = '';
      password.value = '';
      const session = await api('session');
      if (!session || typeof session.csrf !== 'string' || !session.csrf || typeof session.authenticated !== 'boolean')
        throw new Error('会话状态无效。');
      csrf.value = session.csrf;
      applyNavigation(session);
      certificateEnabled.value = session.certificateLoginEnabled === true;
      httpTestMode.value = session.httpTestMode === true && location.origin === 'http://10.10.10.128:9085';
      await reloadChallenge();
    } catch {
      error.value = '退出或新会话状态未确认，请刷新页面核查。';
    } finally {
      busy.value = false;
    }
  }

  async function restore() {
    try {
      const session = await api('session');
      if (!session || typeof session.csrf !== 'string' || !session.csrf || typeof session.authenticated !== 'boolean')
        throw new Error('会话状态无效。');
      csrf.value = session.csrf;
      applyNavigation(session);
      certificateEnabled.value = session.certificateLoginEnabled === true;
      httpTestMode.value = session.httpTestMode === true && location.origin === 'http://10.10.10.128:9085';
      if (session.authenticated === true) {
        signedIn.value = true;
        error.value = '';
        await readInstallationState();
        return;
      }
      signedIn.value = false;
      applyNavigation({});
      installationInitialized.value = null;
      setup.value = null;
      checkedAt.value = '';
    } catch {
      signedIn.value = false;
      applyNavigation({});
      installationInitialized.value = null;
      setup.value = null;
      checkedAt.value = '';
      csrf.value = '';
      error.value = '控制台连接失败，请刷新页面。';
    }
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
    loginMode,
    certificateEnabled,
    pin,
    certificates,
    certificateKey,
    username,
    password,
    captcha,
    image,
    csrf,
    captchaEnabled,
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
    httpTestMode,
    accountTransport,
    destination,
    switchMode,
    readCertificates,
    certificateLogin,
    refresh,
    login,
    reloadChallenge,
    logout,
    restore
  };
});
