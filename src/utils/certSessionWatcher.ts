import { ElMessage } from 'element-plus';
import SKFClient from '@/api/skf/skf_api';

/**
 * 证书登录会话 USB Key 拔插监听（登录后生效）。
 * 仅当以证书方式登录（sessionStorage 标记）且 SKF 可连时工作；
 * 捕获拔除事件后停止监听并调用 store.logout()（含后端 token 注销）。
 * 与登录页“手动读取”互不干扰：登录页不启动本监听。
 */
const FLAG_KEY = 'liuzx_cert_login';
const WS_URL = import.meta.env.VITE_APP_SKF_WS_URL || 'ws://127.0.0.1:9001';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let started = false;
let skf: SKFClient | null = null;
const monitoredProviders = new Set<string>();

export const isCertLogin = () => sessionStorage.getItem(FLAG_KEY) === '1';

export function markCertLogin(on: boolean) {
  if (on) {
    sessionStorage.setItem(FLAG_KEY, '1');
    startCertSession();
  } else {
    sessionStorage.removeItem(FLAG_KEY);
    stopCertSession();
  }
}

async function getSkf(): Promise<SKFClient> {
  if (skf && skf.isConnected()) return skf;
  const client = new SKFClient(WS_URL);
  await client.connect();
  skf = client;
  console.log('[certSession] SKF connected', WS_URL);
  return skf;
}

async function onRemoved() {
  console.log('[certSession] USB Key removed -> auto logout');
  stopCertSession();
  sessionStorage.removeItem(FLAG_KEY);
  ElMessage.warning('USB Key 已拔出，已自动退出登录');
  try {
    const { useUserStore } = await import('@/store/modules/user');
    const store = useUserStore();
    if (store.token) await store.logout();
  } catch {
    /* 忽略 */
  }
  if (!window.location.pathname.endsWith('/login')) {
    window.location.href = '/login';
  }
}

async function watchProvider(provider: string) {
  while (started) {
    try {
      const client = await getSkf();
      const event = await client.waitForDevEvent(provider);
      console.log('[certSession] devEvent', provider, event);
      if (!started) break;
      if (event.event !== 1) {
        void onRemoved();
        break;
      }
    }
    catch {
      console.warn('[certSession] waitForDevEvent error, retry');
      if (!started) break;
      await sleep(2000);
    }
  }
}

async function providerLoop() {
  while (started) {
    try {
      const client = await getSkf();
      const providers = await client.enumProvider();
      providers.forEach((provider: string) => {
        if (!monitoredProviders.has(provider)) {
          monitoredProviders.add(provider);
          console.log('[certSession] watching provider', provider);
          void watchProvider(provider);
        }
      });
    }
    catch {
      console.warn('[certSession] SKF 不可用(未启动?)，3s 后重试');
      /* SKF 未启动时静默，拔插检测不可用但不打扰用户 */
    }
    await sleep(3000);
  }
}

export function startCertSession() {
  console.log('[certSession] startCertSession, flag=', isCertLogin());
  if (started || !isCertLogin()) return;
  started = true;
  void providerLoop();
}

export function stopCertSession() {
  console.log('[certSession] stopCertSession');
  started = false;
  monitoredProviders.clear();
  try {
    if (skf) {
      skf.disconnect();
    }
  } catch {
    /* ignore */
  }
  skf = null;
}
