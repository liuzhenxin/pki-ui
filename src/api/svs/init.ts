import request from '@/utils/request';

export const SVS_PRESET_INIT_ACCOUNT = 'svs-init';
export const SVS_TENANT_CODE = 'svs';
export const SVS_LOCKED_MESSAGE = '初始化已锁定';
export const SVS_MUST_CHANGE_MESSAGE = '当前账号必须先修改口令';
export const SVS_PASSWORD_API = '/admin/svs/account/password';
export const SVS_INIT_PATH = '/svs/init';
export const SVS_PASSWORD_PATH = '/svs/change-password';

const MUST_CHANGE_KEY = 'svs.mustChangePassword';

export interface SvsInitStepResult {
  next: string;
}

export function svsUsernameHeader(username: string) {
  return { 'X-Svs-Username': username };
}

export function openSvsInitSession(actor: string, mode?: string) {
  return request({
    url: '/admin/svs/init/session',
    method: 'post',
    data: { actor, mode },
    headers: svsUsernameHeader(actor),
    hideErrorNotify: true
  } as any) as Promise<SvsInitStepResult>;
}

export function submitSvsInitStep(actor: string, step: string, username?: string, password?: string) {
  return request({
    url: '/admin/svs/init/step',
    method: 'post',
    data: { actor, step, username, password },
    headers: svsUsernameHeader(actor),
    hideErrorNotify: true
  } as any) as Promise<SvsInitStepResult>;
}

export function changeSvsPassword(username: string, password: string) {
  return request({
    url: SVS_PASSWORD_API,
    method: 'post',
    data: { username, password },
    headers: svsUsernameHeader(username),
    hideErrorNotify: true
  } as any);
}

export function readMustChangeUsernames(): string[] {
  try {
    const raw = sessionStorage.getItem(MUST_CHANGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberMustChangePassword(username: string) {
  const names = new Set(readMustChangeUsernames());
  names.add(username);
  sessionStorage.setItem(MUST_CHANGE_KEY, JSON.stringify([...names]));
}

export function clearMustChangePassword(username: string) {
  const names = readMustChangeUsernames().filter((item) => item !== username);
  sessionStorage.setItem(MUST_CHANGE_KEY, JSON.stringify(names));
}

export function responseText(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object' && 'msg' in data) {
    return String((data as { msg?: unknown }).msg || '');
  }
  return String((error as { message?: string })?.message || '');
}
