import { kdsPost } from './client';
import type { ChannelRollbackResult, ChannelStatus, DeviceDetail, DeviceList, KeySnapshot, SBoxActivateResult, SBoxHistory } from '@/types/kds';

export function listDevices(params: { status?: string; page?: number; size?: number }) {
  return kdsPost<DeviceList>('device/list', params);
}

export function getDeviceDetail(deviceSn: string) {
  return kdsPost<DeviceDetail>('device/detail', { deviceSn });
}

export function getKeySnapshot(deviceSn: string) {
  return kdsPost<KeySnapshot>('key/snapshot', { deviceSn });
}

export function getChannelStatus(deviceSn: string) {
  return kdsPost<ChannelStatus>('channel/status', { deviceSn });
}

export function rollbackChannel(deviceSn: string, channelName: string) {
  return kdsPost<ChannelRollbackResult>('channel/rollback', { deviceSn, channelName });
}

export function getSBoxHistory(deviceSn: string) {
  return kdsPost<SBoxHistory>('sbox/history', { deviceSn });
}

export function activateSBox(deviceSn: string, version: string) {
  return kdsPost<SBoxActivateResult>('sbox/activate', { deviceSn, version });
}
