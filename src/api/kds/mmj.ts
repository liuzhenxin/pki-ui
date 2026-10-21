import { kdsManagement } from './client';

export const MMJ_DEVICE_SN = 'MMJ-SN-2026-001';

export interface MmjDevice {
  tenantId: number;
  deviceSn: string;
  baseUrl: string;
  enabled: boolean;
  resourceVersion: number;
}

export interface MmjDevicePage {
  items: MmjDevice[];
  nextCursor?: string;
}

export interface MmjStatus {
  desired: Record<string, unknown>;
  observed: Record<string, unknown>;
  observedAt?: string;
  freshness: string;
  drift: boolean;
  failureClass?: string;
  consecutiveFailures: number;
}

export interface MmjTask {
  taskId: string;
  deviceSn: string;
  operation: string;
  state: string;
  remoteCode?: string;
  traceId: string;
  createdAt: string;
  updatedAt: string;
}

export function listMmjDevices() {
  return kdsManagement<MmjDevicePage>('devices');
}

export function getMmjDevice(deviceSn: string) {
  return kdsManagement<MmjDevice>(`devices/${encodeURIComponent(deviceSn)}`);
}

export function getMmjStatus(deviceSn: string) {
  return kdsManagement<MmjStatus>(`devices/${encodeURIComponent(deviceSn)}/status`);
}

export function registerMmjDevice(deviceSn: string, baseUrl: string, certificateChainPem: string, enabled = true) {
  return kdsManagement<{ taskId: string }>(`devices/${encodeURIComponent(deviceSn)}`, 'post', {
    baseUrl, certificateChainPem, enabled
  });
}

export function updateMmjDevice(device: MmjDevice, baseUrl: string) {
  return kdsManagement<{ taskId: string }>(`devices/${encodeURIComponent(device.deviceSn)}/update`, 'post',
    { baseUrl }, { 'If-Match': String(device.resourceVersion) });
}

export function setMmjDeviceEnabled(device: MmjDevice, enabled: boolean) {
  return kdsManagement<{ taskId: string }>(
    `devices/${encodeURIComponent(device.deviceSn)}/${enabled ? 'enable' : 'disable'}`,
    'post', {}, { 'If-Match': String(device.resourceVersion) }
  );
}

export function stageMmjCertificate(deviceSn: string, certificateChainPem: string) {
  return kdsManagement<{ taskId: string }>(`devices/${encodeURIComponent(deviceSn)}/certificates`, 'post', {
    certificateChainPem
  });
}

export function startMmjOperation(deviceSn: string, operation: 'connection-tests' | 'status/refresh' | 'key-distributions' | 'master-channels' | 'sbox-deployments', body: Record<string, unknown> = {}) {
  return kdsManagement<{ taskId: string }>(`devices/${encodeURIComponent(deviceSn)}/${operation}`, 'post', body);
}

export function getMmjTask(taskId: string) {
  return kdsManagement<MmjTask>(`tasks/${taskId}`);
}
