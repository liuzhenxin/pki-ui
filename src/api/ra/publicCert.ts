import request from '@/utils/request';
import { Result } from '@/api/types';

export interface PublicCertQuery {
  pageNum: number;
  pageSize: number;
  domainName?: string;
  serialNumber?: string;
  certTypeName?: string;
  systemName?: string;
  ownerKeyword?: string;
  approvalStatus?: string;
  certStatus?: string;
  ownerChangeRequired?: boolean | null;
  notAfterStart?: string;
  notAfterEnd?: string;
}

export interface PublicCertUsage {
  id?: number | string;
  systemName: string;
  usageDomain?: string;
  usageScene?: string;
  businessOwnerEmployeeId?: number | string;
  businessOwnerName?: string;
  departmentName?: string;
  remark?: string;
}

export interface PublicCert {
  id?: number | string;
  certTypeId?: number | string;
  certTypeName?: string;
  domainName: string;
  serialNumber?: string;
  issuer?: string;
  vendor?: string;
  notBefore?: string;
  notAfter?: string;
  certStatus?: string;
  certStatusName?: string;
  approvalStatus?: string;
  approvalStatusName?: string;
  maintainerEmployeeId?: number | string;
  maintainerIdentityKey?: string;
  maintainerName?: string;
  maintainerAccount?: string;
  maintainerEmail?: string;
  businessOwnerEmployeeId?: number | string;
  businessOwnerIdentityKey?: string;
  businessOwnerName?: string;
  businessOwnerAccount?: string;
  businessOwnerEmail?: string;
  departmentId?: string;
  departmentName?: string;
  departmentPath?: string;
  systemName?: string;
  systemOwnerName?: string;
  systemOwnerAccount?: string;
  systemOwnerEmail?: string;
  reminderEnabled?: boolean;
  ownerChangeRequired?: boolean;
  submitterId?: number | string;
  submitterName?: string;
  submitTime?: string;
  approverName?: string;
  approvalTime?: string;
  approvalComment?: string;
  remark?: string;
  usages?: PublicCertUsage[];
}

export interface PublicCertAttachment {
  id: number | string;
  originalName: string;
  fileExt: string;
  fileSize: number;
  fileHash?: string;
  createTime?: string;
}

export interface PublicCertAuditLog {
  id: number | string;
  action: string;
  operatorName?: string;
  comment?: string;
  createTime?: string;
}

export interface PublicCertDetail {
  cert: PublicCert;
  usages: PublicCertUsage[];
  attachments: PublicCertAttachment[];
  auditLogs: PublicCertAuditLog[];
}

export interface PublicCertType {
  id?: number | string;
  typeCode: string;
  typeName: string;
  sort: number;
  enabled: boolean;
}

export interface PublicCertPermission {
  id?: number | string;
  employeeId?: number | string;
  employeeIdentityKey?: string;
  employeeNo?: string;
  domainAccount?: string;
  employeeName?: string;
  employeeEmail?: string;
  departmentName?: string;
  enabled?: boolean;
  grantorName?: string;
  grantTime?: string;
}

export interface SelfAccess {
  granted: boolean;
  identityKey?: string;
  domainAccount?: string;
  employeeName?: string;
}

const cleanQuery = (query: PublicCertQuery) => ({
  ...query,
  domainName: query.domainName || undefined,
  serialNumber: query.serialNumber || undefined,
  certTypeName: query.certTypeName || undefined,
  systemName: query.systemName || undefined,
  ownerKeyword: query.ownerKeyword || undefined,
  approvalStatus: query.approvalStatus || undefined,
  certStatus: query.certStatus || undefined,
  ownerChangeRequired: query.ownerChangeRequired === null ? undefined : query.ownerChangeRequired,
  notAfterStart: query.notAfterStart || undefined,
  notAfterEnd: query.notAfterEnd || undefined,
  pageNum: Number(query.pageNum || 1),
  pageSize: Number(query.pageSize || 10)
});

export const pagePublicCerts = (query: PublicCertQuery): Promise<Result<any>> =>
  request({
    url: '/ra/v1/public-certs/page',
    method: 'post',
    data: cleanQuery(query)
  }) as any;

export const getPublicCert = (id: number | string): Promise<Result<PublicCertDetail>> =>
  request({
    url: `/ra/v1/public-certs/${id}`,
    method: 'get'
  }) as any;

export const savePublicCert = (data: PublicCert): Promise<Result<PublicCertDetail>> =>
  request({
    url: '/ra/v1/public-certs',
    method: 'post',
    data
  }) as any;

export const submitPublicCert = (id: number | string): Promise<Result<PublicCert>> =>
  request({
    url: `/ra/v1/public-certs/${id}/submit`,
    method: 'post'
  }) as any;

export const approvePublicCert = (id: number | string, comment?: string): Promise<Result<PublicCert>> =>
  request({
    url: `/ra/v1/public-certs/${id}/approve`,
    method: 'post',
    data: { comment }
  }) as any;

export const rejectPublicCert = (id: number | string, comment: string): Promise<Result<PublicCert>> =>
  request({
    url: `/ra/v1/public-certs/${id}/reject`,
    method: 'post',
    data: { comment }
  }) as any;

export const removePublicCert = (id: number | string): Promise<Result<PublicCert>> =>
  request({
    url: `/ra/v1/public-certs/${id}`,
    method: 'delete'
  }) as any;

export const exportPublicCerts = (query: PublicCertQuery) =>
  request({
    url: '/ra/v1/public-certs/export',
    method: 'post',
    data: cleanQuery(query),
    responseType: 'blob'
  });

export const listPublicCertTypes = (onlyEnabled = false): Promise<Result<PublicCertType[]>> =>
  request({
    url: '/ra/v1/public-certs/types',
    method: 'get',
    params: { onlyEnabled }
  }) as any;

export const savePublicCertType = (data: PublicCertType): Promise<Result<PublicCertType>> =>
  request({
    url: '/ra/v1/public-certs/types',
    method: 'put',
    data
  }) as any;

export const pagePublicCertPermissions = (query: { pageNum: number; pageSize: number; keyword?: string; enabled?: boolean | null }): Promise<Result<any>> =>
  request({
    url: '/ra/v1/public-certs/permissions/page',
    method: 'post',
    data: {
      ...query,
      keyword: query.keyword || undefined,
      enabled: query.enabled === null ? undefined : query.enabled
    }
  }) as any;

export const grantPublicCertPermission = (data: PublicCertPermission): Promise<Result<PublicCertPermission>> =>
  request({
    url: '/ra/v1/public-certs/permissions',
    method: 'post',
    data
  }) as any;

export const uploadPublicCertAttachment = (id: number | string, file: File, self = false): Promise<Result<PublicCertAttachment>> => {
  const form = new FormData();
  form.append('file', file);
  return request({
    url: `/ra/v1/public-certs/${self ? 'my/' : ''}${id}/attachments`,
    method: 'post',
    data: form
  }) as any;
};

export const getSelfPublicCertAccess = (): Promise<Result<SelfAccess>> =>
  request({
    url: '/ra/v1/public-certs/my/access',
    method: 'get'
  }) as any;

export const pageMyPublicCerts = (query: PublicCertQuery): Promise<Result<any>> =>
  request({
    url: '/ra/v1/public-certs/my/page',
    method: 'post',
    data: cleanQuery(query)
  }) as any;

export const getMyPublicCert = (id: number | string): Promise<Result<PublicCertDetail>> =>
  request({
    url: `/ra/v1/public-certs/my/${id}`,
    method: 'get'
  }) as any;

export const saveMyPublicCert = (data: PublicCert): Promise<Result<PublicCertDetail>> =>
  request({
    url: '/ra/v1/public-certs/my',
    method: 'post',
    data
  }) as any;

export const submitMyPublicCert = (id: number | string): Promise<Result<PublicCert>> =>
  request({
    url: `/ra/v1/public-certs/my/${id}/submit`,
    method: 'post'
  }) as any;
