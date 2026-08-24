import request from '@/utils/request';
import { Result } from '@/api/types';

export type RaCertStatus = 'VALID' | 'EXPIRED' | 'NOT_YET_VALID' | 'REVOKED' | 'HOLD';

export interface RaCertQuery {
  pageNum: number;
  pageSize: number;
  serialNumber?: string;
  subject?: string;
  status?: RaCertStatus | '';
}

export interface RaCertSummary {
  id: string | number;
  serialNumber: string;
  subject: string;
  userId: string | number;
  deptId?: string | number;
  deptName?: string;
  rootId: string | number;
  rootName?: string;
  profileId: string | number;
  profileName?: string;
  notBefore?: string;
  notAfter?: string;
  createTime?: string;
  status: RaCertStatus;
  statusName: string;
  keySource?: string;
  pkcs12Available?: boolean;
}

export interface RaCertDetail {
  summary: RaCertSummary;
  requestSubject?: string;
  cert: string;
  sha1?: string;
  revoked: boolean;
  revocationReason?: number;
  revocationTime?: string;
}

export function pageRaCert(query: RaCertQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/certs/page',
    method: 'post',
    data: query
  }) as any;
}

export function getRaCert(id: string | number): Promise<Result<RaCertDetail>> {
  return request({
    url: `/ra/v1/certs/${id}`,
    method: 'get'
  }) as any;
}

export function downloadRaCert(id: string | number, format: 'pem' | 'cer' | 'p7b'): Promise<Blob> {
  return request({
    url: `/ra/v1/certs/${id}/download/${format}`,
    method: 'get',
    responseType: 'blob'
  }) as any;
}

export function downloadRaPkcs12(id: string | number, password: string): Promise<Blob> {
  return request({
    url: `/ra/v1/certs/${id}/pkcs12`,
    method: 'post',
    data: { password },
    responseType: 'blob'
  }) as any;
}
