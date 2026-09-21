import request from '@/utils/request';

export type TsaRuntimeStatus = 'UP' | 'DOWN' | 'DEGRADED';
export interface TsaHealth {
  service: TsaRuntimeStatus;
  hsm: TsaRuntimeStatus;
  protocol: TsaRuntimeStatus;
  message?: string;
}
export interface TsaCertificate {
  id: string;
  subject: string;
  policyOid: string;
  keyReferenceMasked: string;
  status: 'PENDING' | 'ACTIVE' | 'RETIRED' | 'DISABLED';
  notBefore: string;
  notAfter: string;
}
export interface TsaPolicy {
  policyOid: string;
  digestAlgorithms: string[];
  signatureAlgorithms: string[];
}
export interface TsaAudit {
  id: string;
  operator: string;
  eventType: string;
  result: string;
  occurredAt: string;
}
export interface TsaAuditQuery {
  pageNum: number;
  pageSize: number;
  operator?: string;
  eventType?: string;
  result?: string;
  startTime?: string;
  endTime?: string;
}
export interface PageResult<T> {
  rows: T[];
  total: number;
}

export const getTsaHealth = () => request<TsaHealth>({ url: '/tsa/v1/health', method: 'get' });
export const listTsaCertificates = () => request<TsaCertificate[]>({ url: '/tsa/v1/certificates', method: 'get' });
export const importTsaCertificate = (data: FormData) => request({ url: '/tsa/v1/certificates', method: 'post', data });
export const activateTsaCertificate = (id: string) => request({ url: `/tsa/v1/certificates/${id}/activate`, method: 'post' });
export const disableTsaCertificate = (id: string) => request({ url: `/tsa/v1/certificates/${id}/disable`, method: 'post' });
export const rotateTsaCertificate = (id: string) => request({ url: `/tsa/v1/certificates/${id}/rotate`, method: 'post' });
export const getTsaPolicy = () => request<TsaPolicy>({ url: '/tsa/v1/policy', method: 'get' });
export const saveTsaPolicy = (data: TsaPolicy) => request<TsaPolicy>({ url: '/tsa/v1/policy', method: 'put', data });
export const listTsaAudits = (params: TsaAuditQuery) => request<PageResult<TsaAudit>>({ url: '/tsa/v1/audits', method: 'get', params });
