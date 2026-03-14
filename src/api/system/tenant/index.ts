import request from '@/utils/request';
import { TenantForm, TenantQuery, TenantVO } from './types';
import { Result } from '@/api/types';

// 查询租户列表
export function listTenant(query: TenantQuery): Promise<TenantVO[]> {
  return request({
    url: '/admin/api/v1/tenants/list',
    method: 'get',
    params: query
  }) as any;
}

// 查询租户详细
export function getTenant(id: string | number): Promise<Result<TenantVO>> {
  return request({
    url: '/admin/api/v1/tenants/' + id,
    method: 'get'
  }) as any;
}

// 新增租户
export function addTenant(data: TenantForm) {
  return request({
    url: '/admin/api/v1/tenants',
    method: 'post',
    headers: {
      isEncrypt: true,
      repeatSubmit: false
    },
    data: data
  });
}

// 修改租户
export function updateTenant(data: TenantForm) {
  return request({
    url: '/admin/api/v1/tenants',
    method: 'put',
    data: data
  });
}

// 租户状态修改
export function changeTenantStatus(id: string | number, tenantId: string | number, status: string) {
  const data = {
    id,
    tenantId,
    status
  };
  return request({
    url: '/system/tenant/changeStatus',
    method: 'put',
    data: data
  });
}

// 删除租户
export function delTenant(id: string | number | Array<string | number>) {
  return request({
    url: '/admin/api/v1/tenants/' + id,
    method: 'delete'
  });
}

// 动态切换租户
export function dynamicTenant(tenantId: string | number) {
  return request({
    url: '/admin/api/v1/tenants/dynamic/' + tenantId,
    method: 'get'
  });
}

// 清除动态租户
export function dynamicClear() {
  return request({
    url: '/admin/api/v1/tenants/dynamic/clear',
    method: 'get'
  });
}

// 同步租户套餐
export function syncTenantPackage(tenantId: string | number, packageId: string | number) {
  const data = {
    tenantId,
    packageId
  };
  return request({
    url: '/admin/api/v1/tenants/syncTenantPackage',
    method: 'get',
    params: data
  });
}

// 同步租户字典
export function syncTenantDict() {
  return request({
    url: '/admin/api/v1/tenants/syncTenantDict',
    method: 'get'
  });
}

// 同步租户字典
export function syncTenantConfig() {
  return request({
    url: '/admin/api/v1/tenants/syncTenantConfig',
    method: 'get'
  });
}
