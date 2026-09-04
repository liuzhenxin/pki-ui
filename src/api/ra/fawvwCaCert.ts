import request from '@/utils/request';
import type { Result } from '@/api/types';

export type FawvwCaCertificateType = 'ROOT' | 'INTERMEDIATE';
export type FawvwCaValidityStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NOT_YET_VALID';

export interface FawvwCaCertQuery {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  certificateType?: FawvwCaCertificateType | '';
  validityStatus?: FawvwCaValidityStatus | '';
  managementStatus?: 'ACTIVE' | 'DISABLED' | '';
}

export interface FawvwCaCertificate {
  id: string | number;
  certificateType: FawvwCaCertificateType;
  sourceType: 'RA_SYNC' | 'IMPORTED';
  sourceRootId?: string | number;
  parentId?: string | number;
  displayName: string;
  subjectDn: string;
  issuerDn: string;
  serialNumber: string;
  fingerprint: string;
  certificatePem?: string;
  notBefore: string;
  notAfter: string;
  validityStatus: FawvwCaValidityStatus;
  validityStatusName: string;
  managementStatus: 'ACTIVE' | 'DISABLED';
  sourceActive: boolean;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

function cleanQuery(query: FawvwCaCertQuery) {
  return {
    ...query,
    keyword: query.keyword || undefined,
    certificateType: query.certificateType || undefined,
    validityStatus: query.validityStatus || undefined,
    managementStatus: query.managementStatus || undefined,
    pageNum: Number(query.pageNum || 1),
    pageSize: Number(query.pageSize || 10)
  };
}

export function pageFawvwCaCertificates(query: FawvwCaCertQuery): Promise<Result<any>> {
  return request({ url: '/ra/v1/fawvw-ca-certificates/page', method: 'post', data: cleanQuery(query) }) as any;
}

export function getFawvwCaCertificate(id: string | number): Promise<Result<FawvwCaCertificate>> {
  return request({ url: `/ra/v1/fawvw-ca-certificates/${id}`, method: 'get' }) as any;
}

export function syncFawvwCaCertificates(): Promise<Result<{ rootCount: number; intermediateCount: number; invalidCount: number }>> {
  return request({ url: '/ra/v1/fawvw-ca-certificates/sync', method: 'post' }) as any;
}

export function importFawvwCaCertificate(data: FormData): Promise<Result<{ rootId: string | number; intermediateCount: number }>> {
  return request({
    url: '/ra/v1/fawvw-ca-certificates/import',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' }
  }) as any;
}

export function updateFawvwCaCertificate(
  data: Pick<FawvwCaCertificate, 'id' | 'displayName' | 'managementStatus' | 'remark'>
): Promise<Result<FawvwCaCertificate>> {
  return request({ url: '/ra/v1/fawvw-ca-certificates', method: 'put', data }) as any;
}
