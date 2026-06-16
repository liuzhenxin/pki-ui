import request from '@/utils/request';
import { Result } from '@/api/types';

export function getEnvInfo(): Promise<Result<any>> {
  return request({
    url: '/license/v1/init/env',
    method: 'get'
  });
}

export function initAdmin(data: any): Promise<Result<any>> {
  return request({
    url: '/license/v1/init/admin',
    method: 'post',
    data
  });
}

export function getInitStatus(): Promise<Result<any>> {
  return request({
    url: '/license/v1/init/status',
    method: 'get'
  });
}
