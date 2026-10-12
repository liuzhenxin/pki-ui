import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { consoleRequest, ConsoleRequestError, type ConsoleResponses, type ConsoleCommands } from '@/api/csp/console';
import { skfCall, closeSkf, normalizeSkfSignature } from '@/services/csp/skf';

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
      await api('certificate-login', { challengeId: challenge.challengeId, signature: normalizeSkfSignature(rawSignature) });
      certificates.value = [];
      certificateKey.value = '';
      signedIn.value = true;
      await readState();
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
  const initialized = ref<boolean | null>(null);
  const checkedAt = ref('');
  const setupStep = ref(0);
  const setup = ref<import('@/api/csp/console').SetupView | null>(null);
  const environment = ref<{ name: string; ok: boolean }[]>([]);
  const confirmed = ref(false);
  const initializationAttempted = ref(false);
  const completion = ref(false);
  const environmentReady = computed(
    () => setup.value !== null && setup.value.step >= 2 && setup.value.accounts.length === 3 && setup.value.accounts.every((row) => row.valid)
  );
  const secure = computed(() => location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
  const httpTestMode = ref(false);
  const accountTransport = computed(() => secure.value || httpTestMode.value);
  const stateLabel = computed(() => (initialized.value === null ? '状态未确认' : initialized.value ? '已完成初始化' : '等待初始化'));

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
    if (busy.value) return;
    await readState();
  }

  function applySetup(data: import('@/api/csp/console').SetupView) {
    if (
      typeof data?.initialized !== 'boolean' ||
      !Number.isSafeInteger(data.draftVersion) ||
      !Number.isInteger(data.step) ||
      data.step < 0 ||
      data.step > 3 ||
      !Array.isArray(data.accounts)
    )
      throw new Error('初始化状态无效，请联系运维核查。');
    setup.value = data;
    initialized.value = data.initialized;
    setupStep.value = data.step;
    completion.value = data.initialized && (completion.value || initializationAttempted.value || data.attempted);
    initializationAttempted.value = initializationAttempted.value || data.attempted;
    checkedAt.value = data.checkedAt ? new Date(data.checkedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '';
  }

  async function readState() {
    busy.value = true;
    error.value = '';
    confirmed.value = false;
    setup.value = null;
    try {
      const data = await api('setup');
      applySetup(data);
      signedIn.value = true;
    } catch (failure) {
      initialized.value = null;
      if (failure instanceof ConsoleRequestError && failure.status === 401) signedIn.value = false;
      error.value = (failure as Error).message;
    } finally {
      busy.value = false;
    }
  }

  async function advanceSetup(action: import('@/api/csp/console').SetupAction) {
    if (busy.value || !accountTransport.value || !setup.value || initializationAttempted.value) return;
    busy.value = true;
    error.value = '';
    confirmed.value = false;
    try {
      applySetup(
        await api('setup-advance', {
          draftVersion: setup.value.draftVersion,
          action,
          ...(action === 'AGREE' ? { agreementVersion: setup.value.agreementVersion } : {})
        })
      );
    } catch (failure) {
      const message = (failure as Error).message;
      try {
        applySetup(await api('setup'));
      } catch {
        setup.value = null;
        initialized.value = null;
      }
      error.value = message;
    } finally {
      busy.value = false;
    }
  }

  async function initialize() {
    if (
      busy.value ||
      !accountTransport.value ||
      initialized.value !== false ||
      !environmentReady.value ||
      !confirmed.value ||
      initializationAttempted.value ||
      !setup.value ||
      setup.value.step !== 3
    )
      return;
    busy.value = true;
    error.value = '';
    initializationAttempted.value = true;
    try {
      const result = await api('setup-complete', { draftVersion: setup.value.draftVersion, confirm: true });
      if (result.initialized !== true) throw new Error('初始化回执无效。');
      applySetup(result);
      completion.value = true;
    } catch (failure) {
      confirmed.value = false;
      if (failure instanceof ConsoleRequestError && [400, 403, 409, 412].includes(failure.status)) {
        initializationAttempted.value = false;
        setup.value = null;
        initialized.value = null;
      }
      error.value = `${(failure as Error).message} 请点击“刷新状态”核查；本页不会再次提交。`;
    } finally {
      busy.value = false;
    }
  }

  async function login() {
    if (busy.value || !accountTransport.value) return;
    busy.value = true;
    error.value = '';
    try {
      await api('login', { username: username.value.trim(), password: password.value, captcha: captcha.value });
      password.value = '';
      captcha.value = '';
      image.value = '';
      signedIn.value = true;
      await readState();
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
      initialized.value = null;
      environment.value = [];
      confirmed.value = false;
      initializationAttempted.value = false;
      completion.value = false;
      setupStep.value = 0;
      password.value = '';
      const session = await api('session');
      if (!session || typeof session.csrf !== 'string' || !session.csrf || typeof session.authenticated !== 'boolean')
        throw new Error('会话状态无效。');
      csrf.value = session.csrf;
      certificateEnabled.value = session.certificateLoginEnabled === true;
      httpTestMode.value = session.httpTestMode === true && location.origin === 'http://10.10.10.128:9085';
      initializationAttempted.value = session.initializationAttempted === true;
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
      certificateEnabled.value = session.certificateLoginEnabled === true;
      httpTestMode.value = session.httpTestMode === true && location.origin === 'http://10.10.10.128:9085';
      initializationAttempted.value = session.initializationAttempted === true;
      if (session.authenticated === true) {
        signedIn.value = true;
        await readState();
        return;
      }
      signedIn.value = false;
      initialized.value = null;
      environment.value = [];
      completion.value = false;
    } catch {
      signedIn.value = false;
      initialized.value = null;
      csrf.value = '';
      error.value = '控制台连接失败，请刷新页面。';
    }
  }
  const destination = computed(() => (initialized.value === true && !completion.value ? '/csp/overview' : '/csp/setup'));
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
    initialized,
    checkedAt,
    setupStep,
    setup,
    advanceSetup,
    environment,
    confirmed,
    initializationAttempted,
    completion,
    environmentReady,
    secure,
    httpTestMode,
    accountTransport,
    stateLabel,
    destination,
    switchMode,
    readCertificates,
    certificateLogin,
    refresh,
    initialize,
    login,
    reloadChallenge,
    logout,
    restore
  };
});
