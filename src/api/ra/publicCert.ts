import request from '@/utils/request';
import { publicCertFormData } from '@/utils/publicCertForm';
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

export interface PublicCertEmployee {
  id: number | string;
  cnName: string;
  domainAccount: string;
  email?: string;
  departmentId?: string;
  departmentName?: string;
  departmentNamePath?: string;
}

export interface PublicCert {
  id?: number | string;
  version?: number;
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
  recorderDisplay?: string;
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

export interface PublicCertPortalConfig {
  iamEnabled?: boolean;
  requireIam?: boolean;
  iamBaseUrl?: string;
  authorizePath?: string;
  tokenPath?: string;
  profilePath?: string;
  clientId?: string;
  clientSecret?: string;
  isAdSso?: boolean;
  stateTtlSeconds?: number;
  timeoutSeconds?: number;
  callbackUrl?: string;
  tokenRequestMode?: string;
  profileTokenMode?: string;
  accountFieldPaths?: string;
  clientSecretConfigured?: boolean;
}

export interface SelfAccess {
  granted: boolean;
  identityKey?: string;
  domainAccount?: string;
  employeeName?: string;
  idleMinutes?: number;
}

export interface PublicNoticeConfig {
  automatic: boolean;
  email: boolean;
  dingtalk: boolean;
  days: string;
  time: string;
  portalUrl: string;
  subject: string;
  emailContent: string;
  dingContent: string;
}
export interface PublicNoticeState { id: number | string; emailStatus?: number; dingtalkStatus?: number }
export interface PublicNoticeLog { id: number | string; channel: string; status: number; sendTime?: string; message?: string; gatewayTraceId?: string }
export const getPublicNoticeConfig = (): Promise<Result<PublicNoticeConfig>> => request({ url: '/ra/v1/public-certs/notice-config', method: 'get' }) as any;
export const savePublicNoticeConfig = (data: PublicNoticeConfig): Promise<Result<PublicNoticeConfig>> => request({ url: '/ra/v1/public-certs/notice-config', method: 'put', data }) as any;
export const getPublicNoticeStates = (ids: (number | string)[]): Promise<Result<PublicNoticeState[]>> => request({ url: '/ra/v1/public-certs/notice-states', method: 'post', data: ids }) as any;
export const getPublicNoticeLogs = (id: number | string): Promise<Result<PublicNoticeLog[]>> => request({ url: `/ra/v1/public-certs/${id}/notice-logs`, method: 'get' }) as any;
export const notifyPublicCerts = (ids: (number | string)[]): Promise<Result<number>> => request({ url: '/ra/v1/public-certs/notify', method: 'post', data: ids }) as any;
export const auditPublicCerts = (ids: (number | string)[], approve: boolean, comment: string): Promise<Result<number>> => request({ url: '/ra/v1/public-certs/audit-batch', method: 'post', data: { ids, approve, comment } }) as any;
export const togglePublicCertReminder = (id: number | string, enabled: boolean): Promise<Result<PublicCert>> => request({ url: `/ra/v1/public-certs/${id}/reminder`, method: 'put', data: { enabled } }) as any;
export const getPublicPortalSessionPolicy = (): Promise<Result<{ idleMinutes: number }>> => request({ url: '/ra/v1/public-certs/session-policy', method: 'get' }) as any;
export const savePublicPortalSessionPolicy = (idleMinutes: number): Promise<Result<{ idleMinutes: number }>> => request({ url: '/ra/v1/public-certs/session-policy', method: 'put', data: { idleMinutes } }) as any;

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

export const createPublicCertLedger = (data: PublicCert, files: File[]): Promise<Result<PublicCertDetail>> =>
  request({ url: '/ra/v1/public-certs/ledger', method: 'post', data: publicCertFormData(data, files), timeout: 120_000 }) as any;

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

export const pagePublicCertPermissions = (query: {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  enabled?: boolean | null;
}): Promise<Result<any>> =>
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

export const revokePublicCertPermission = (id: number | string): Promise<Result<void>> =>
  request({ url: `/ra/v1/public-certs/permissions/${id}`, method: 'delete' }) as any;

export const getPublicCertPortalConfig = (): Promise<Result<PublicCertPortalConfig>> =>
  request({
    url: '/ra/v1/public-certs/portal/config',
    method: 'get'
  }) as any;

export const savePublicCertPortalConfig = (data: PublicCertPortalConfig): Promise<Result<PublicCertPortalConfig>> =>
  request({
    url: '/ra/v1/public-certs/portal/config',
    method: 'put',
    data
  }) as any;

export const uploadPublicCertAttachment = (id: number | string, file: File): Promise<Result<PublicCertAttachment>> => {
  const form = new FormData();
  form.append('file', file);
  return request({
    url: `/ra/v1/public-certs/${id}/attachments`,
    method: 'post',
    data: form,
    timeout: 120_000
  }) as any;
};
