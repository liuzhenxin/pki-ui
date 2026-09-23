import request from '@/utils/request';
import { Result } from '@/api/types';

export function listRaRootCa(query: any): Promise<Result<any>> {
  return request({
    url: '/ra/v1/roots/page',
    method: 'post',
    data: query
  }) as any;
}

export function getRaRootCa(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ra/v1/roots/${id}`,
    method: 'get'
  }) as any;
}
