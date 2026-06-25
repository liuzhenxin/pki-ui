import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaUserCertScopeProfile {
  id: string | number;
  name: string;
  type?: string;
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

export function listUserCertScopeOptions(): Promise<Result<RaUserCertScopeRoot[]>> {
  return request({
    url: '/ra/v1/user-cert-scopes/options',
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
