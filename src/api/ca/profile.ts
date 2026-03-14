import request from '@/utils/request';
import { ProfileCO } from './types';
import { Result } from '@/api/types';

// 查询证书模板列表
export function listProfile(): Promise<Result<ProfileCO[]>> {
  return request({
    url: '/ca/api/v1/profiles/list',
    method: 'get'
  }) as any;
}

// 查询证书模板详情
export function getProfile(id: string | number): Promise<Result<ProfileCO>> {
  return request({
    url: `/ca/api/v1/profiles/${id}`,
    method: 'get'
  }) as any;
}

// 证书模板初始化接口
export function initProfiles(data: { ids: string[] }): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/profiles/init',
    method: 'post',
    data: data
  }) as any;
}
