import request from '@/utils/request';
import { Result } from '@/api/types';

/**
 * 获取环境监测信息
 */
export function getEnvInfo(): Promise<Result<any>> {
  return request({
    url: '/kmc/v1/init/env',
    method: 'get'
  });
}

/**
 * 初始化管理员和审计员
 * @param data 初始化数据
 */
export function initAdmin(data: any): Promise<Result<any>> {
  return request({
    url: '/kmc/v1/init/admin',
    method: 'post',
    data: data
  });
}

/**
 * 获取当前初始化状态
 */
export function getInitStatus(): Promise<Result<any>> {
  return request({
    url: '/kmc/v1/init/status',
    method: 'get'
  });
}
