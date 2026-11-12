import { ref, computed, watch } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import {
  consoleRequest,
  ConsoleRequestError,
  type ConsoleResponses,
  type ConsoleCommands,
  type InstallationView,
  type InstallationAccount
} from '@/api/csp/console';
import { useCspConsoleStore } from './cspConsole';
import { cspProduct } from '@/config/csp';
export const useCspInstallationStore = defineStore('csp-installation', () => {
  const shared = useCspConsoleStore();
  const { signedIn, httpTestMode, accountTransport, secure, certificateEnabled } = storeToRefs(shared);
  const busy = ref(false),
    error = ref(''),
    initialized = ref<boolean | null>(null),
    setup = ref<InstallationView | null>(null);
  const setupStep = ref(0),
    checkedAt = ref(''),
    initializationAttempted = ref(false),
    completion = ref(false);
  const environmentReady = computed(
    () =>
      setup.value !== null &&
      setup.value.step >= 2 &&
      setup.value.accounts.length === 2 &&
      (['SYSTEM_ADMIN', 'AUDIT_ADMIN'] as const).every((role) => setup.value?.accounts.some((account) => account.role === role && account.valid))
  );
  function api<K extends keyof ConsoleResponses>(path: K, body?: ConsoleCommands[K]): Promise<ConsoleResponses[K]> {
    return consoleRequest(path, shared.csrf, body);
  }
  async function refresh() {
    if (busy.value) return;
    await readState();
  }

  function applySetup(data: import('@/api/csp/console').InstallationView) {
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
    setup.value = null;
    try {
      const data = await api('installation');
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

  async function advanceSetup(action: import('@/api/csp/console').InstallationAction) {
    if (busy.value || !accountTransport.value || !setup.value || initializationAttempted.value) return;
    busy.value = true;
    error.value = '';
    try {
      applySetup(
        await api('installation-advance', {
          draftVersion: setup.value.draftVersion,
          action,
          ...(action === 'AGREE' ? { agreementVersion: setup.value.agreementVersion } : {})
        })
      );
    } catch (failure) {
      const message = (failure as Error).message;
      try {
        applySetup(await api('installation'));
      } catch {
        setup.value = null;
        initialized.value = null;
      }
      error.value = message;
    } finally {
      busy.value = false;
    }
  }

  async function initialize(admin: InstallationAccount, auditor: InstallationAccount) {
    if (busy.value || !secure.value || initialized.value !== false || !environmentReady.value || initializationAttempted.value || !setup.value)
      return;
    if (setup.value.step === 2) await advanceSetup('VERIFY_ACCOUNTS');
    if (setup.value?.step !== 3 || !environmentReady.value || error.value) return;
    busy.value = true;
    error.value = '';
    initializationAttempted.value = true;
    try {
      const result = await api('installation-complete', { draftVersion: setup.value.draftVersion, confirm: true, admin, auditor });
      if (result.initialized !== true) throw new Error('初始化回执无效。');
      applySetup(result);
      completion.value = true;
    } catch (failure) {
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

  watch(signedIn, (value) => {
    if (!value) {
      setup.value = null;
      initialized.value = null;
      initializationAttempted.value = false;
      completion.value = false;
      error.value = '';
    }
  });
  return {
    signedIn,
    httpTestMode,
    accountTransport,
    secure,
    certificateEnabled,
    busy,
    error,
    initialized,
    setup,
    setupStep,
    checkedAt,
    initializationAttempted,
    completion,
    environmentReady,
    refresh,
    advanceSetup,
    initialize,
    logout: shared.logout,
    destination: cspProduct.installation
  };
});
