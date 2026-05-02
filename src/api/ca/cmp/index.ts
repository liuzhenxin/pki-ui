import request from '@/utils/request';
import { Result } from '@/api/types';

export function getCmpHealth(): Promise<Result<any>> {
  return request({
    url: '/ca/v1/cmp/admin/health',
    method: 'get'
  }) as any;
}

export function testCmp(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/cmp/admin/test',
    method: 'post',
    data
  }) as any;
}

export function pageCmpLogs(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/cmp/admin/logs/page',
    method: 'post',
    data: query
  }) as any;
}
