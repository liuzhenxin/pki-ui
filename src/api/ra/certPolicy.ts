import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaCertPolicyRules {
  certUsages: string[];
  keyAlgorithms: string[];
  validity: {
    minDays: number;
    defaultDays: number;
    maxDays: number;
  };
}

export interface RaProfileOption {
  id: number | string;
  name: string;
  type?: string;
}

export interface RaCertPolicy {
  id?: number | string;
  policyOid: string;
  policyName: string;
  policyDescription?: string;
  policyRules?: string;
  rules: RaCertPolicyRules;
  policyStatus: number;
  profileIds: Array<number | string>;
  profiles?: RaProfileOption[];
  createTime?: string;
  updateTime?: string;
}

export interface RaCertPolicyQuery {
  pageNum: number;
  pageSize: number;
  policyName?: string;
  policyOid?: string;
  policyStatus?: number | string;
  profileId?: number | string;
}

export function pageRaCertPolicy(query: RaCertPolicyQuery): Promise<Result<any>> {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return request({
    url: '/ra/v1/cert-policies/page',
    method: 'post',
    data: {
      ...query,
      policyStatus: query.policyStatus === '' ? undefined : query.policyStatus,
      profileId: query.profileId === '' ? undefined : query.profileId,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    }
  }) as any;
}

export function getRaCertPolicy(id: number | string): Promise<Result<RaCertPolicy>> {
  return request({
    url: `/ra/v1/cert-policies/${id}`,
    method: 'get'
  }) as any;
}

export function saveRaCertPolicy(data: RaCertPolicy): Promise<Result<void>> {
  return request({
    url: '/ra/v1/cert-policies',
    method: 'post',
    data
  }) as any;
}

export function modifyRaCertPolicy(data: RaCertPolicy): Promise<Result<void>> {
  return request({
    url: '/ra/v1/cert-policies',
    method: 'put',
    data
  }) as any;
}

export function removeRaCertPolicy(ids: Array<number | string>): Promise<Result<void>> {
  return request({
    url: '/ra/v1/cert-policies',
    method: 'delete',
    data: ids
  }) as any;
}

export function updateRaCertPolicyStatus(id: number | string, policyStatus: number): Promise<Result<void>> {
  return request({
    url: `/ra/v1/cert-policies/${id}/status`,
    method: 'put',
    data: { policyStatus }
  }) as any;
}

export function validateRaCertPolicy(data: RaCertPolicy): Promise<Result<void>> {
  return request({
    url: '/ra/v1/cert-policies/validate',
    method: 'post',
    data
  }) as any;
}

export function listRaProfileOptions(): Promise<Result<RaProfileOption[]>> {
  return request({
    url: '/ra/v1/cert-policies/profile-options',
    method: 'get'
  }) as any;
}
