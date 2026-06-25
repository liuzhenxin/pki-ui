import request from '@/utils/request';
import { Result } from '@/api/types';

// 获取CA初始化状态
export function getInitStatus(): Promise<Result<{
  initialized: boolean;
  tenantStatus: number;
  profileCount: number;
  rootCount: number;
  signerCount: number;
  publisherCount: number;
  requestorCount: number;
  userCount: number;
}>> {
  return request({
    url: '/ca/v1/init/status',
    method: 'get'
  }) as any;
}

// 获取CA初始化环境检测
export function getInitEnv(): Promise<Result<any[]>> {
  return request({
    url: '/ca/v1/init/env',
    method: 'get'
  }) as any;
}

// 获取内置证书模板列表
export function listInitProfiles(): Promise<Result<any[]>> {
  return request({
    url: '/ca/v1/init/profiles',
    method: 'get'
  }) as any;
}

// 初始化管理员
export function initAdmin(data: { admin: { username: string; password: string }; auditor: { username: string; password: string } }): Promise<Result<any>> {
  return request({
    url: '/ca/v1/init/admin',
    method: 'post',
    data
  }) as any;
}

// 导入证书模板
export function initProfiles(data: { names: string[] }): Promise<Result<any>> {
  return request({
    url: '/ca/v1/init/profiles',
    method: 'post',
    data
  }) as any;
}

// 完成CA初始化
export function completeInit(): Promise<Result<any>> {
  return request({
    url: '/ca/v1/init/complete',
    method: 'post'
  }) as any;
}
