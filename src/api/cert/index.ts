import request from '@/utils/request';
import { Result } from '@/api/types';
import { CertForm, CertQuery } from './types';

// 分页查询证书列表
export function pageCert(query: CertQuery): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/page',
    method: 'post',
    data: query
  }) as any;
}

// 查看证书详情
export function getCert(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/certs/${id}`,
    method: 'get'
  }) as any;
}

// 保存证书
export function saveCert(data: CertForm): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs',
    method: 'post',
    data: { co: data }
  }) as any;
}

// 修改证书
export function modifyCert(data: CertForm): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs',
    method: 'put',
    data: { co: data }
  }) as any;
}

// 删除证书
export function removeCert(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs',
    method: 'delete',
    data: ids
  }) as any;
}

// 导入证书
export function importCert(formData: FormData): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as any;
}

// 导出证书
export function exportCert(ids: (string | number)[]): Promise<any> {
  return request({
    url: '/ca/v1/certs/export',
    method: 'post',
    data: ids,
    responseType: 'blob'
  }) as any;
}