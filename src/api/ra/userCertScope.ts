import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaUserCertScopeProfile {
  id: string | number;
  name: string;
  type?: string;
  conf?: string;
  authorized?: boolean;
}

export interface RaUserCertScopeDualPair {
  pairName?: string;
  signProfileId: string | number;
  signProfileName: string;
  encryptProfileId: string | number;
  encryptProfileName: string;
}

export interface RaUserCertScopeRoot {
  id: string | number;
  name: string;
  status?: number;
  algorithm?: string;
  profiles: RaUserCertScopeProfile[];
  dualProfiles?: RaUserCertScopeDualPair[];
  authorized?: boolean;
}

export interface RaUserCertScopeSaveRoot {
  rootId: string | number;
  profileIds: Array<string | number>;
}

export interface RaUserCertScopeDetail {
  userId: string | number;
  roots: RaUserCertScopeSaveRoot[];
}

export function listUserCertScopeOptions(userId?: string | number): Promise<Result<RaUserCertScopeRoot[]>> {
  return request({
    url: userId == null ? '/ra/v1/user-cert-scopes/options' : `/ra/v1/user-cert-scopes/options/${userId}`,
    method: 'get'
  }) as any;
}

export function listMyUserCertScopeOptions(): Promise<Result<RaUserCertScopeRoot[]>> {
  return request({
    url: '/ra/v1/user-cert-scopes/my-options',
    method: 'get'
  }) as any;
}

export function getUserCertScopes(userId: string | number): Promise<Result<RaUserCertScopeDetail>> {
  return request({
    url: `/ra/v1/user-cert-scopes/${userId}`,
    method: 'get'
  }) as any;
}

export function saveUserCertScopes(userId: string | number, roots: RaUserCertScopeSaveRoot[]): Promise<Result<void>> {
  return request({
    url: `/ra/v1/user-cert-scopes/${userId}`,
    method: 'put',
    data: { roots }
  }) as any;
}

export function getOrganizationCertScopes(deptId: string | number): Promise<Result<RaUserCertScopeSaveRoot[]>> {
  return request({ url: `/ra/v1/user-cert-scopes/organization/${deptId}`, method: 'get' }) as any;
}

export function saveOrganizationCertScopes(deptId: string | number, roots: RaUserCertScopeSaveRoot[]): Promise<Result<void>> {
  return request({ url: `/ra/v1/user-cert-scopes/organization/${deptId}`, method: 'put', data: { roots } }) as any;
}
