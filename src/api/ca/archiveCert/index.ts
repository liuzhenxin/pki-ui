import request from '@/utils/request';
import { Result } from '@/api/types';

export function pageArchiveCert(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/archive-certs/page',
    method: 'post',
    data: query
  }) as any;
}

export function getArchiveCert(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/archive-certs/${id}`,
    method: 'get'
  }) as any;
}

export function exportArchiveCert(data: any): Promise<any> {
  return request({
    url: '/ca/v1/archive-certs/export',
    method: 'post',
    data,
    responseType: 'blob'
  }) as any;
}
