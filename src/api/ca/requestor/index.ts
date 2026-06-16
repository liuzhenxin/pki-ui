import request from '@/utils/request';
import { Result } from '@/api/types';

// 分页查询请求者列表
export function pageRequestor(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/requestors/page',
    method: 'post',
    data: query
  }) as any;
}

// 查看请求者详情
export function getRequestor(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/requestors/${id}`,
    method: 'get'
  }) as any;
}

// 保存请求者
export function saveRequestor(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/requestors',
    method: 'post',
    data: data
  }) as any;
}

// 修改请求者
export function modifyRequestor(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/requestors',
    method: 'put',
    data: data
  }) as any;
}

// 删除请求者
export function removeRequestor(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/v1/requestors',
    method: 'delete',
    data: ids
  }) as any;
}

// 导入请求者
export function importRequestor(formData: FormData): Promise<Result<any>> {
  return request({
    url: '/ca/v1/requestors/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as any;
}

// 导出请求者
export function exportRequestor(ids: (string | number)[]): Promise<any> {
  return request({
    url: '/ca/v1/requestors/export',
    method: 'post',
    data: { ids: ids }, // 使用 RequestorExportCmd 格式
    responseType: 'blob'
  }) as any;
}

// 请求者授权
export function authorizeRequestor(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/requestors/authorize',
    method: 'post',
    data
  }) as any;
}

// 查看请求者在指定根CA下的授权
export function getRequestorAuthorization(requestorId: string | number, rootId: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/requestors/${requestorId}/roots/${rootId}/authorization`,
    method: 'get'
  }) as any;
}
