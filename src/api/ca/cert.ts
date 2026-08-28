import request from '@/utils/request';
import { withUtcCertificateValidity } from '@/utils/certificateTime';
import { Result } from '@/api/types';

// 分页查询证书列表
export function pageCert(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/page',
    method: 'post',
    data: query
  }) as any;
}

// 查看证书详情
export function getCert(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/certs/${id}`,
    method: 'get'
  }) as any;
}

// 保存证书
export function saveCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs',
    method: 'post',
    data: data
  }) as any;
}

// 修改证书
export function modifyCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs',
    method: 'put',
    data: data
  }) as any;
}

// 删除证书记录
export function removeCert(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs',
    method: 'delete',
    data: ids
  }) as any;
}

// 导入证书
export function importCert(formData: FormData): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as any;
}

// 导出证书
export function exportCert(data: any): Promise<any> {
  return request({
    url: '/ca/v1/certs/export',
    method: 'post',
    data: data,
    responseType: 'blob'
  }) as any;
}

// 签发证书
export function issueCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/issue',
    method: 'post',
    data: withUtcCertificateValidity(data)
  }) as any;
}

// 签发双证书（签名+加密）
export function issueDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/issue-dual',
    method: 'post',
    data: withUtcCertificateValidity(data)
  }) as any;
}

// 证书续期：使用原密钥签发新证书
export function renewCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/renew',
    method: 'post',
    data: data
  }) as any;
}

// 证书更新：使用新密钥签发新证书
export function updateCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/update',
    method: 'post',
    data: data
  }) as any;
}

// 证书重签/补办
export function reissueCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/reissue',
    method: 'post',
    data: data
  }) as any;
}

// 密钥恢复
export function recoverKey(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/recover-key',
    method: 'post',
    data: data
  }) as any;
}

export function queryKmcKeyStatus(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/certs/${id}/kmc-key-status`,
    method: 'get'
  }) as any;
}

// 冻结证书
export function suspendCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/suspend',
    method: 'put',
    data: data
  }) as any;
}

// 恢复证书
export function resumeCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/resume',
    method: 'put',
    data: data
  }) as any;
}

// 注销证书
export function revokeCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/revoke',
    method: 'put',
    data: data
  }) as any;
}

// 双证书续期
export function renewDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/renew-dual',
    method: 'post',
    data: data
  }) as any;
}

// 双证书更新
export function updateDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/update-dual',
    method: 'post',
    data: data
  }) as any;
}

// 双证书补办
export function reissueDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/reissue-dual',
    method: 'post',
    data: data
  }) as any;
}

// 双证书冻结
export function suspendDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/suspend-dual',
    method: 'put',
    data: data
  }) as any;
}

// 双证书解冻
export function resumeDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/resume-dual',
    method: 'put',
    data: data
  }) as any;
}

// 双证书注销
export function revokeDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/revoke-dual',
    method: 'put',
    data: data
  }) as any;
}
