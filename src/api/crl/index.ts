import request from '@/utils/request';
import { Result } from '@/api/types';
import { CrlForm, CrlQuery } from './types';

// 分页查询CRL列表
export function pageCrl(query: CrlQuery): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/crls/page',
    method: 'post',
    data: query
  }) as any;
}

// 查看CRL详情
export function getCrl(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/api/v1/crls/${id}`,
    method: 'get'
  }) as any;
}

// 保存CRL
export function saveCrl(data: CrlForm): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/crls',
    method: 'post',
    data: { co: data }
  }) as any;
}

// 修改CRL
export function modifyCrl(data: CrlForm): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/crls',
    method: 'put',
    data: { co: data }
  }) as any;
}

// 删除CRL
export function removeCrl(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/crls',
    method: 'delete',
    data: ids
  }) as any;
}

// 导入CRL
export function importCrl(formData: FormData): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/crls/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as any;
}

// 导出CRL
export function exportCrl(ids: (string | number)[]): Promise<any> {
  return request({
    url: '/ca/api/v1/crls/export',
    method: 'post',
    data: ids,
    responseType: 'blob'
  }) as any;
}