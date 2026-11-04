import request from '@/utils/request';
import type { Page } from './product';
export interface DeviceKeyRow {
  alias: string;
  algorithm: string;
  usage: string;
  fingerprint: string;
  state: string;
  observedAt: string;
  referenceIds: string[];
  referenceMismatch: boolean;
}
export const listDeviceKeys = (page = 1, alias = '', algorithm = ''): Promise<Page<DeviceKeyRow>> =>
  request({ url: '/admin/svs/device-keys', params: { page, size: 20, alias, algorithm } });
