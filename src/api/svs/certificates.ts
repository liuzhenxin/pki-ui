import request from '@/utils/request';
import type { Page } from './product';
export interface Certificate {
  id: string;
  subject: string;
  serial: string;
  keyId: string;
  status: string;
  notAfter: string;
  version: number;
}
export interface DeviceKey {
  keyId: string;
  alias: string;
  algorithm: string;
  fingerprint: string;
}
const base = '/admin/svs/certificates';
export const list = (page: number): Promise<Page<Certificate>> => request({ url: base + '/page', params: { page, size: 20 } });
export const keys = (): Promise<DeviceKey[]> => request({ url: base + '/keys' });
export const csr = (keyId: string, subject: string): Promise<{ csr: string }> =>
  request({ url: base + '/csr', method: 'post', data: { keyId, subject } });
export const details = (id: string): Promise<Record<string, string>> => request({ url: `${base}/${encodeURIComponent(id)}/public` });
export const upload = (keyId: string, certificate: string, replaceId = ''): Promise<Certificate> =>
  request({ url: replaceId ? `${base}/${encodeURIComponent(replaceId)}/replace` : base, method: 'post', data: { keyId, certificate } });
