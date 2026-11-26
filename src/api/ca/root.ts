import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RootHierarchyEntry {
  id: string | number;
  name: string;
  cert: string;
  certchain?: string;
  caStatus?: string;
  parentRootId?: string | number;
  selfSigned?: boolean;
  imported?: boolean;
  signerId?: string | number;
}

export interface ExistingCaImport {
  name: string;
  certificate: string;
  subordinate: boolean;
  parentRootId?: string | number;
  signerId?: string | number;
}

export interface ExistingCaCertificate {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  signatureAlgorithm: string;
  sha256: string;
}

export interface ExistingCaSigner {
  id: string | number;
  name: string;
  type: string;
  matching: boolean;
  keyIndex?: number | null;
  publicKeyStatus?: 'MATCH' | 'MISMATCH' | 'UNVERIFIED';
}

export interface ExistingCaPreview {
  certificate: ExistingCaCertificate;
  parent?: ExistingCaCertificate;
  signers: ExistingCaSigner[];
  existingRootId?: string | number;
}

export function previewExistingCa(data: ExistingCaImport): Promise<Result<ExistingCaPreview>> {
  return request({ url: '/ca/v1/roots/existing/preview', method: 'post', data }) as any;
}

export function importExistingCa(data: ExistingCaImport): Promise<Result<string | number>> {
  return request({ url: '/ca/v1/roots/existing', method: 'post', data }) as any;
}

export function getExistingCaSigners(id: string | number): Promise<Result<ExistingCaSigner[]>> {
  return request({ url: `/ca/v1/roots/${id}/existing-signers`, method: 'get' }) as any;
}

export function bindExistingCaSigner(id: string | number, signerId: string | number): Promise<Result<void>> {
  return request({ url: `/ca/v1/roots/${id}/existing-signers/${signerId}`, method: 'put' }) as any;
}

export function listRootHierarchy(): Promise<Result<RootHierarchyEntry[]>> {
  return request({
    url: '/ca/v1/roots/tree',
    method: 'get'
  }) as any;
}

// 获取根证书分页列表
export function listRootCa(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/page',
    method: 'post',
    data: query
  }) as any;
}

// 获取根证书详情
export function getRootCa(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}`,
    method: 'get'
  }) as any;
}

export function downloadRootCa(id: string | number): Promise<Result<{ name: string; cert: string; certchain?: string }>> {
  return request({ url: `/ca/v1/roots/${id}/download`, method: 'get' }) as any;
}

// 生成自签名CA根证书
export function genRootCa(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/gen',
    method: 'post',
    data: data
  }) as any;
}

// 生成 CSR（外部CA签发模式）
export function genCsr(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/csr',
    method: 'post',
    data: data
  }) as any;
}

// 导入外部CA签发的证书
export function importExternalCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/external',
    method: 'post',
    data: data
  }) as any;
}

// 签发管理员证书
export function issueAdminCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/admin-cert',
    method: 'post',
    data: data
  }) as any;
}

// 签发 CA 身份证书
export function issueCaIdentityCert(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/identity-cert',
    method: 'post',
    data: data
  }) as any;
}

// 删除所有根证书
export function deleteAllRootCa(): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/deleteAll',
    method: 'delete'
  }) as any;
}

// 授权模板给根证书
export function authorizeProfile(data: { rootId: string | number; profileIds: (string | number)[] }): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/authorize-profile',
    method: 'post',
    data: data
  }) as any;
}

// 启用根证书
export function enableRootCa(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/enable`,
    method: 'put'
  }) as any;
}

// 停用根证书
export function disableRootCa(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/disable`,
    method: 'put'
  }) as any;
}

// 关联证书发布者（替换该根CA的发布者绑定）
export function saveRootPublishers(id: string | number, publisherIds: (string | number)[]): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/publishers`,
    method: 'put',
    data: publisherIds || []
  }) as any;
}

// 注销根证书
export function revokeRootCa(id: string | number, reason: string): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/revoke`,
    method: 'post',
    data: { reason }
  }) as any;
}

// 在线签发从属CA证书
export function genSubCaOnline(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/roots/sub-ca/gen',
    method: 'post',
    data: data
  }) as any;
}

// 获取根证书 CRL 配置
export function getRootCrlConfig(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/crl-config`,
    method: 'get'
  }) as any;
}

// 保存根证书 CRL 配置
export function saveRootCrlConfig(id: string | number, data: any): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/crl-config`,
    method: 'put',
    data: {
      ...data,
      rootId: id
    }
  }) as any;
}

// 立即签发根证书 CRL
export function issueRootCrl(id: string | number, data: any): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/crl/issue`,
    method: 'post',
    data
  }) as any;
}

// 启动根证书 CRL 签发线程
export function startRootCrlScheduler(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/crl-scheduler/start`,
    method: 'post'
  }) as any;
}

// 停止根证书 CRL 签发线程
export function stopRootCrlScheduler(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/roots/${id}/crl-scheduler/stop`,
    method: 'post'
  }) as any;
}
