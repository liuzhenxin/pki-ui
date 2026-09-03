import request from '@/utils/request';
import { Result } from '@/api/types';

export interface SecurityPolicy {
  id?: number | string;
  tenantId?: number;
  policyName: string;
  policyType: string;
  policyContent: string;
  priority: number;
  effectiveTime?: string;
  expireTime?: string;
  policyStatus: number;
  description?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SecurityPolicyQuery {
  pageNum: number;
  pageSize: number;
  policyName?: string;
  policyType?: string;
  policyStatus?: number | string;
}

export function pageSecurityPolicy(query: SecurityPolicyQuery): Promise<Result<any>> {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return request({
    url: '/admin/v1/security-policies/page',
    method: 'post',
    data: {
      ...query,
      policyStatus: query.policyStatus === '' ? undefined : query.policyStatus,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    }
  }) as any;
}

export function getSecurityPolicy(id: number | string): Promise<Result<SecurityPolicy>> {
  return request({
    url: `/admin/v1/security-policies/${id}`,
    method: 'get'
  }) as any;
}

export function getCurrentSecurityPolicy(tenantId?: number): Promise<Result<SecurityPolicy>> {
  return request({
    url: '/admin/v1/security-policies/current',
    method: 'get',
    params: tenantId != null ? { tenantId } : undefined
  }) as any;
}

export function saveSecurityPolicy(data: SecurityPolicy): Promise<Result<void>> {
  return request({
    url: '/admin/v1/security-policies',
    method: 'post',
    data
  }) as any;
}

export function modifySecurityPolicy(data: SecurityPolicy): Promise<Result<void>> {
  return request({
    url: '/admin/v1/security-policies',
    method: 'put',
    data
  }) as any;
}

export function removeSecurityPolicy(ids: Array<number | string>): Promise<Result<void>> {
  return request({
    url: '/admin/v1/security-policies',
    method: 'delete',
    data: ids
  }) as any;
}

export function updateSecurityPolicyStatus(id: number | string, policyStatus: number): Promise<Result<void>> {
  return request({
    url: `/admin/v1/security-policies/${id}/status`,
    method: 'put',
    data: { policyStatus }
  }) as any;
}

export function validateSecurityPolicy(data: SecurityPolicy): Promise<Result<void>> {
  return request({
    url: '/admin/v1/security-policies/validate',
    method: 'post',
    data
  }) as any;
}
