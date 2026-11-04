import request from '@/utils/request';

export interface InitializationStatus {
  state: string;
  currentAttemptId?: string;
  attemptCount: number;
}

export function getInitializationStatus() {
  return request<InitializationStatus>({ url: '/hsm/v1/initialization', method: 'get' });
}

export function beginInitialization() {
  return request({ url: '/hsm/v1/initialization', method: 'post' });
}

/** 设备授权与审批验证前服务端拒绝执行，不收集设备口令。 */
export function initializeDeviceKey() {
  return request({ url: '/hsm/v1/initialization/device-key', method: 'post' });
}

export function skipInitializationStep(step: 'network' | 'site_certificate') {
  return request({ url: `/hsm/v1/initialization/skip/${step}`, method: 'post' });
}
