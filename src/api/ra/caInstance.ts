import request from '@/utils/request';
import { Result } from '@/api/types';

export type RaCaStatus = 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
export type RaCaAuthType = 'NONE' | 'OAUTH2_CLIENT' | 'MTLS';

export interface RaCaInstance {
  id?: number | string;
  code: string;
  name: string;
  baseUrl: string;
  mode: 'external' | 'gateway' | 'direct';
  status: RaCaStatus;
  defaultForApply: number;
  requestorName?: string;
  connectTimeoutMs: number;
  readTimeoutMs: number;
  healthStatus?: string;
  lastHealthTime?: string;
  lastHealthMessage?: string;
  lastSyncTime?: string;
  createTime?: string;
  updateTime?: string;
  credentialConfigured?: boolean;
}

export interface RaCaInstanceQuery {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: RaCaStatus | '';
  mode?: string;
}

export interface RaCaCredential {
  authType: RaCaAuthType;
  tokenUri?: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretRef?: string;
  clientSecretConfigured?: boolean;
  clientSecretRefConfigured?: boolean;
  identityCertPem?: string;
  identityPrivateKey?: string;
  identityPrivateKeyRef?: string;
  identityPrivateKeyConfigured?: boolean;
  identityPrivateKeyRefConfigured?: boolean;
  keyId?: string;
}

export interface RaCaConnectionCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface RaCaConnectionTest {
  passed: boolean;
  checkedAt: string;
  checks: RaCaConnectionCheck[];
}

export interface RaCaSyncResult {
  caInstanceId: number | string;
  caCode: string;
  rootCount: number;
  profileCount: number;
  relationCount: number;
}

function withPage(query: RaCaInstanceQuery) {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return {
    ...query,
    status: query.status || undefined,
    mode: query.mode || undefined,
    keyword: query.keyword?.trim() || undefined,
    pageNum,
    pageSize,
    pageIndex: (pageNum - 1) * pageSize
  };
}

export function pageRaCaInstance(query: RaCaInstanceQuery): Promise<Result<any>> {
  return request({ url: '/ra/v1/ca-instances/page', method: 'post', data: withPage(query) }) as any;
}

export function getRaCaInstance(id: number | string): Promise<Result<RaCaInstance>> {
  return request({ url: `/ra/v1/ca-instances/${id}`, method: 'get' }) as any;
}

export function saveRaCaInstance(data: RaCaInstance): Promise<Result<number | string>> {
  return request({ url: '/ra/v1/ca-instances', method: 'post', data }) as any;
}

export function modifyRaCaInstance(data: RaCaInstance): Promise<Result<void>> {
  return request({ url: '/ra/v1/ca-instances', method: 'put', data }) as any;
}

export function removeRaCaInstance(id: number | string): Promise<Result<void>> {
  return request({ url: `/ra/v1/ca-instances/${id}`, method: 'delete' }) as any;
}

export function updateRaCaInstanceStatus(id: number | string, status: RaCaStatus): Promise<Result<void>> {
  return request({ url: `/ra/v1/ca-instances/${id}/status`, method: 'put', data: { status } }) as any;
}

export function setDefaultRaCaInstance(id: number | string): Promise<Result<void>> {
  return request({ url: `/ra/v1/ca-instances/${id}/default`, method: 'put' }) as any;
}

export function getRaCaCredential(id: number | string): Promise<Result<RaCaCredential>> {
  return request({ url: `/ra/v1/ca-instances/${id}/credential`, method: 'get' }) as any;
}

export function saveRaCaCredential(id: number | string, data: RaCaCredential): Promise<Result<void>> {
  return request({ url: `/ra/v1/ca-instances/${id}/credential`, method: 'put', data }) as any;
}

export function testRaCaConnection(id: number | string): Promise<Result<RaCaConnectionTest>> {
  return request({ url: `/ra/v1/ca-instances/${id}/test`, method: 'post' }) as any;
}

export function syncRaCaInstance(id: number | string): Promise<Result<RaCaSyncResult>> {
  return request({ url: '/ra/v1/init/sync-ca', method: 'post', data: { caInstanceId: id } }) as any;
}
