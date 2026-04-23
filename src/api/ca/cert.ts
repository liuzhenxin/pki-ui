import request from '@/utils/request';
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
    data: data
  }) as any;
}

// 签发双证书（签名+加密）
export function issueDualCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/issue-dual',
    method: 'post',
    data: data
  }) as any;
}

// 吊销证书 (注意：后台 Controller 暂未列出 revoke 接口，保留此处以匹配 UI，如后端路径不同请调整)
export function revokeCert(data: { id: string | number; reason: number }): Promise<Result<any>> {
  return request({
    url: '/ca/v1/certs/revoke',
    method: 'post',
    data: data
  }) as any;
}
