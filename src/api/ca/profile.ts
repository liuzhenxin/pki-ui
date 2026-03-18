import request from '@/utils/request';
import { ProfileCO } from './types';
import { Result } from '@/api/types';

// 查询证书模板列表
export function listProfile(params?: { type?: string }): Promise<Result<ProfileCO[]>> {
  return request({
    url: '/ca/api/v1/profiles/list',
    method: 'get',
    params: params
  }) as any;
}

// 分页查询证书模板列表
export function pageProfile(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/profiles/page',
    method: 'post',
    data: query
  }) as any;
}

// 查询证书模板详情
export function getProfile(id: string | number): Promise<Result<ProfileCO>> {
  return request({
    url: `/ca/api/v1/profiles/${id}`,
    method: 'get'
  }) as any;
}

// 根据名称获取证书模板详情
export function getProfileByName(name: string): Promise<Result<ProfileCO>> {
  return request({
    url: `/ca/api/v1/profiles/name/${name}`,
    method: 'get'
  }) as any;
}

// 保存证书模板
export function saveProfile(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/profiles',
    method: 'post',
    data: data
  }) as any;
}

// 修改证书模板
export function modifyProfile(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/profiles',
    method: 'put',
    data: data
  }) as any;
}

// 删除证书模板
export function removeProfile(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/profiles',
    method: 'delete',
    data: ids
  }) as any;
}

// 导入证书模板
export function importProfile(formData: FormData): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/profiles/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as any;
}

// 导出证书模板
export function exportProfile(ids: (string | number)[]): Promise<any> {
  return request({
    url: '/ca/api/v1/profiles/export',
    method: 'post',
    data: ids,
    responseType: 'blob'
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
