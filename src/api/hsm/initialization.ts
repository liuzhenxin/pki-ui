import request from '@/utils/request';

export interface InitializationStatus { state: string; currentAttemptId?: string; attemptCount: number }
export function getInitializationStatus() { return request<InitializationStatus>({ url: '/hsm/v1/initialization', method: 'get' }); }
export function beginInitialization() { return request({ url: '/hsm/v1/initialization', method: 'post' }); }
export function initializeDeviceKey(data: { attemptId: string; deviceSecret: string }) { return request({ url: '/hsm/v1/initialization/device-key', method: 'post', data }); }
export function skipInitializationStep(step: 'network' | 'site_certificate', attemptId: string) { return request({ url: `/hsm/v1/initialization/skip/${step}`, method: 'post', data: { attemptId } }); }
