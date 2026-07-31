import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaEnvRow {
  name: string;
  value: string;
  ok: boolean;
  message?: string;
}

export interface RaProfileItem {
  name: string;
  type: string;
  conf?: string;
}

export interface RaCaSyncRequest {
  caAddress: string;
}

export interface RaCaSyncRoot {
  id: string | number;
  name: string;
  profileCount: number;
  profileNames: string[];
}

export interface RaCaSyncResult {
  rootCount: number;
  profileCount: number;
  relationCount: number;
  profileNames: string[];
  roots?: RaCaSyncRoot[];
}

export interface RaAdminCertProfileOption {
  id: string | number;
  name: string;
  type?: string;
  sourceId?: string | number;
}

export interface RaAdminCertRootOption {
  id: string | number;
  name: string;
  sourceId?: string | number;
  profiles: RaAdminCertProfileOption[];
}

export interface RaAdminCertOptions {
  roots: RaAdminCertRootOption[];
  profileCount: number;
}

export interface RaInitStatus {
  initialized?: boolean;
  identityCsrCount?: number;
  identityCertCount?: number;
  profileCount?: number;
  rootCount?: number;
  relationCount?: number;
  policyCount?: number;
  workflowCount?: number;
  userCount?: number;
  accountCertCount?: number;
}

export interface RaInitAccount {
  username: string;
  password: string;
  certPem?: string;
}

export interface RaIdentityCsrRequest {
  commonName: string;
  organization?: string;
  country?: string;
  algorithm?: string;
}

export interface RaIdentityCsrResult {
  csrPem: string;
  subject: string;
  algorithm: string;
}

export const unwrapRaData = <T = any>(res: any): T => {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
};

export function getInitStatus(): Promise<Result<RaInitStatus>> {
  return request({
    url: '/ra/v1/init/status',
    method: 'get'
  });
}

export function getEnvInfo(): Promise<Result<RaEnvRow[]>> {
  return request({
    url: '/ra/v1/init/env',
    method: 'get'
  });
}

export function listProfiles(): Promise<Result<RaProfileItem[]>> {
  return request({
    url: '/ra/v1/init/profiles',
    method: 'get'
  });
}

export function initProfiles(names: string[]): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/profiles',
    method: 'post',
    data: { names }
  });
}

export function initIdentity(data: { certPem: string }): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/identity',
    method: 'post',
    data
  });
}

export function generateIdentityCsr(data: RaIdentityCsrRequest): Promise<Result<RaIdentityCsrResult>> {
  return request({
    url: '/ra/v1/init/identity/csr',
    method: 'post',
    data
  });
}

export function importIdentityCert(data: { certPem: string }): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/identity/cert',
    method: 'post',
    data
  });
}

export function initRoot(data: { name: string; cert: string; certchain?: string; profileNames: string[] }): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/root',
    method: 'post',
    data
  });
}

export function syncCa(data: RaCaSyncRequest): Promise<Result<RaCaSyncResult>> {
  return request({
    url: '/ra/v1/init/sync-ca',
    method: 'post',
    data
  });
}

export function getAdminCertOptions(): Promise<Result<RaAdminCertOptions>> {
  return request({
    url: '/ra/v1/init/admin/cert-options',
    method: 'get'
  });
}

export function initPolicies(): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/policies',
    method: 'post'
  });
}

export function initAdmin(data: {
  admin: RaInitAccount;
  auditor: RaInitAccount;
  rootId: string | number;
  profileId: string | number;
}): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/admin',
    method: 'post',
    data
  });
}

export function issueAdminAccountCert(data: {
  rootId: string | number;
  profileId: string | number;
  role: string;
  subject: string;
  csrPem: string;
}): Promise<Result<{ cert: string }>> {
  return request({
    url: '/ra/v1/init/admin/account-cert',
    method: 'post',
    data
  });
}

export function completeInit(): Promise<Result<any>> {
  return request({
    url: '/ra/v1/init/complete',
    method: 'post'
  });
}
