import request from '@/utils/request';
import { Result } from '@/api/types';

// 获取根证书分页列表
export function listRootCa(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/roots/page',
    method: 'post',
    data: query
  }) as any;
}

// 生成自签名CA根证书
export function genRootCa(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/roots/gen',
    method: 'post',
    data: data
  }) as any;
}

// 生成 CSR（外部CA签发模式）
export function genCsr(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/roots/csr',
    method: 'post',
    data: data
  }) as any;
}

// 导入外部CA签发的证书
export function importExternalCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/roots/external',
    method: 'post',
    data: data
  }) as any;
}

// 签发管理员证书
export function issueAdminCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/api/v1/roots/admin-cert',
    method: 'post',
    data: data
  }) as any;
}
