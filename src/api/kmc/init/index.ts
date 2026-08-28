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

/**
 * 获取当前 KMP 服务身份
 */
export function getIdentity(): Promise<Result<any>> {
  return request({
    url: '/kmc/v1/init/identity',
    method: 'get'
  });
}

/**
 * 生成或导入 KMP 服务身份
 */
export function initIdentity(data: any): Promise<Result<any>> {
  return request({
    url: '/kmc/v1/init/identity',
    method: 'post',
    data
  });
}

export interface KmpIdentityCsrRequest {
  commonName: string;
  organization: string;
  country: string;
  alias: string;
}

export interface KmpIdentityCsrResult {
  csrPem: string;
  subject: string;
  algorithm: string;
  alias: string;
}

/**
 * 在 KMC 内生成 SM2 私钥和 PKCS#10 请求；响应不包含私钥
 */
export function generateIdentityCsr(data: KmpIdentityCsrRequest): Promise<Result<KmpIdentityCsrResult>> {
  return request({
    url: '/kmc/v1/init/identity/csr',
    method: 'post',
    data
  });
}

/**
 * 导入 CA 签发的身份证书和可选证书链
 */
export function importIdentityCertificate(data: { certificatePem: string; certificateChainPem?: string }): Promise<Result<any>> {
  return request({
    url: '/kmc/v1/init/identity/cert',
    method: 'post',
    data
  });
}
