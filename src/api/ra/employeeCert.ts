import type { RaCertDetail, RaCertFilterOption } from '@/api/ra/cert';
import request from '@/utils/request';
import { Result } from '@/api/types';

export const getEmployeeAdUploadEnabled = () => request({ url: '/ra/v1/employee-certs/ad-upload-enabled', method: 'get' }) as any;
export const saveEmployeeAdUploadEnabled = (enabled: boolean) => request({ url: '/ra/v1/employee-certs/ad-upload-enabled', method: 'put', data: { enabled } }) as any;
export const getNoticeAdministrators = () => request({ url: '/ra/v1/employee-certs/notice-administrators', method: 'get' }) as any;
export const saveNoticeAdministrators = (data: { emails: string[]; domainAccounts: string[] }) => request({ url: '/ra/v1/employee-certs/notice-administrators', method: 'put', data }) as any;

export interface EmployeeCertEmployee {
  id: number | string;
  identityKey: string;
  employeeNo?: string;
  domainAccount: string;
  cnName: string;
  email?: string;
  departmentId?: string;
  departmentName?: string;
  departmentPath?: string;
  jobName?: string;
  positionName?: string;
  sourceStatus?: string;
  recordSource?: string;
  raUserId?: number | string;
}

export interface AccountResolveResult {
  employees: EmployeeCertEmployee[];
  missingAccounts: string[];
  blockedAccounts?: { domainAccount: string; reason: string }[];
  duplicateCount?: number;
}

export type EmployeeMailType = 'MIXED' | 'TEXT';
export type EmployeeSendPurpose = 'CERTIFICATE' | 'NOTICE';
export type EmployeeNoticeChannel = 'EMAIL' | 'DINGTALK';

export interface EmployeeDistributionSelection {
  ids?: (number | string)[];
  taskNo?: string;
  resend?: boolean;
  freshBatch?: boolean;
  certificateChannel?: EmployeeNoticeChannel;
}

export interface EmployeeDistributionBatch {
  batchNo: string;
  taskNo?: string;
  taskCount: number;
  createTime: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  notice?: boolean;
  taskType?: 'DISTRIBUTION' | 'UPLOAD';
}

export interface EmployeeDistributionBatchItem {
  schemeName?: string;
  schemeRevision?: string;
  certId: number | string;
  taskNo?: string;
  employeeName: string;
  domainAccount: string;
  recipientEmail?: string;
  serialNumber?: string;
  certTypeName?: string;
  rootName?: string;
  profileNameSnapshot?: string;
  validityYears?: number;
  messageType: EmployeeMailType | 'NOTICE' | 'CERTIFICATE_EMAIL' | 'CERTIFICATE_DINGTALK';
  sendStatus: number;
  emailStatus?: string;
  dingtalkStatus?: string;
  errorMessage?: string;
  createTime: string;
}

export interface EmployeeDistributionOptions {
  messageType: EmployeeMailType | null;
  maxAttachmentBytes: number;
  profileName?: string;
  count?: number;
  defaultSchemeId?: string;
  retryDingtalkCount?: number;
  recipients?: { name: string; domainAccount: string; email?: string }[];
  schemes?: { id: string; name: string; messageType: EmployeeMailType; confirmation: string;
    groups?: { name: string; count: number; attachmentNames: string[]; retryOnly: boolean }[] }[];
}

export interface EmployeeDistributionScheme {
  id?: string;
  name: string;
  profileId: string;
  enabled: boolean;
  isDefault: boolean;
  revision?: string;
  attachmentNames?: string[];
  email: { type: EmployeeMailType; title: string; body: string };
  dingtalk: { type: 'text' | 'markdown'; title: string; body: string };
}

export interface EmployeePfxPasswordRule {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
}

export const getEmployeePfxPasswordDefault = (): Promise<Result<EmployeePfxPasswordRule | null>> =>
  request({ url: '/ra/v1/employee-certs/pfx-password-default', method: 'get' }) as any;

export const saveEmployeePfxPasswordDefault = (data: EmployeePfxPasswordRule): Promise<Result<EmployeePfxPasswordRule>> =>
  request({ url: '/ra/v1/employee-certs/pfx-password-default', method: 'put', data }) as any;

export interface EmployeeCertTask {
  id: number | string;
  taskNo: string;
  certTypeCode: string;
  certTypeName: string;
  selectionMode: string;
  rootId?: number | string;
  profileId?: number | string;
  profileNameSnapshot?: string;
  validityYears?: number | null;
  pfxPasswordRule?: EmployeePfxPasswordRule | null;
  rsaKeySize?: number | null;
  totalCount: number;
  successCount: number;
  failedCount: number;
  taskStatus: string;
  taskStatusName?: string;
  remark?: string;
  createTime?: string;
}

export type EmployeeCertStatus = 'VALID' | 'EXPIRED' | 'EXPIRING' | 'REVOKED' | 'ARCHIVED';

export interface EmployeeCert {
  id: number | string;
  taskNo?: string;
  employeeId?: number | string;
  employeeNo?: string;
  domainAccount: string;
  employeeName: string;
  employeeEmail?: string;
  departmentName?: string;
  departmentPath?: string;
  jobName?: string;
  positionName?: string;
  certTypeCode: string;
  certTypeName: string;
  subject: string;
  serialNumber: string;
  certPassword?: string;
  notBefore?: string;
  notAfter?: string;
  publicKeyId?: number | string;
  publicKeyName?: string;
  keySource?: string;
  rootId?: number | string;
  profileId?: number | string;
  raApplyId?: number | string;
  profileNameSnapshot?: string;
  raCertId?: number | string;
  issueStatus?: string;
  version?: number | string;
  certStatus?: EmployeeCertStatus | 'NOT_YET_VALID' | 'UNKNOWN';
  remainingDays?: number;
  pfxStatus?: string;
  issueMessage?: string;
  issueHistory?: EmployeeCertIssueAttempt[];
  issueTime?: string;
  superseded?: boolean;
  adUploadEligible?: boolean;
  productionMode?: 'AUTO' | 'NEW' | 'SELECTED' | 'FALLBACK' | 'RECOVER' | 'RENEW';
  originalSerialNumbers?: string[];
  distributionStatus: string;
  distributionStatusName?: string;
  distributionTime?: string;
  distributionMessage?: string;
  emailStatus?: string;
  dingtalkStatus?: string;
  createTime?: string;
}

export function canDistributeEmployeeCert(cert: EmployeeCert, allowResend = false) {
  return (
    !cert.superseded && cert.issueStatus === 'ISSUED' && cert.raCertId != null && cert.certStatus === 'VALID' && cert.pfxStatus !== 'INVALID' &&
    !['SENDING', 'ARCHIVED'].includes(cert.distributionStatus) && (allowResend || cert.distributionStatus !== 'SENT')
  );
}

export interface EmployeeCertIssueAttempt {
  startedAt: string;
  finishedAt?: string;
  status: string;
  message?: string;
  originalSerialNumbers?: string[];
}

export interface EmployeeCertTaskDetail {
  task: EmployeeCertTask;
  certs: EmployeeCert[];
  requestedValidity?: { notBefore: string; notAfter: string } | null;
}

export interface EmployeeCertKey {
  id?: number | string;
  employeeId?: number | string;
  employeeIdentityKey?: string;
  domainAccount?: string;
  keyName: string;
  keyAlgorithm: string;
  publicKey: string;
  keySource?: string;
  legacyRef?: string;
  enabled?: boolean;
  createTime?: string;
}

export type EmployeePublicKey = Pick<EmployeeCertKey, 'id' | 'keyName' | 'keyAlgorithm' | 'keySource' | 'enabled' | 'createTime'> & {
  publicKey?: string | null;
};

export interface EmployeeCertTemplate {
  id?: number | string;
  templateCode: string;
  channel: string;
  messageType?: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface EmployeeCertDistributionConfig {
  emailServerUrl?: string;
  dingtalkServerUrl?: string;
  appKey?: string;
  secretKey?: string;
  emailAccount?: string;
  dingtalkApp?: string;
  attachmentMaxSizeMb?: number;
  secretKeyConfigured?: boolean;
  smtpServer?: string;
  guideHtml?: string;
}

export interface EmployeeEmailCertProfile {
  rootId: number | string;
  rootName: string;
  profileId: number | string;
  profileName: string;
  profileType?: string;
  extendedKeyUsages?: string[];
  profileUpdatedTime?: string;
  enabled: boolean;
  algorithmRestriction?: string | null;
  maxValidityYears?: number;
  templateValidity?: string | null;
  issuerNotAfter?: string | null;
  supportedRsaKeySizes?: number[];
}

export interface DistributionLog {
  gatewayTraceId?: string;
  id: number | string;
  channel: string;
  status: string;
  recipient?: string;
  message?: string;
  createTime?: string;
}

export interface EmployeeCertDetail {
  cert: EmployeeCert;
  logs: DistributionLog[];
}

const cleanPage = (query: any) => ({
  ...query,
  serialNumber: query.serialNumber || undefined,
  domainAccount: query.domainAccount || undefined,
  employeeName: query.employeeName || undefined,
  certTypeCode: query.certTypeCode || undefined,
  distributionStatus: query.distributionStatus || undefined,
  certStatus: query.certStatus || undefined,
  taskNo: query.taskNo || undefined,
  pageNum: Number(query.pageNum || 1),
  pageSize: Number(query.pageSize || 10)
});

export const resolveEmployeeCertAccounts = (accounts: string): Promise<Result<AccountResolveResult>> =>
  request({
    url: '/ra/v1/employee-certs/accounts/resolve',
    method: 'post',
    data: { accounts }
  }) as any;

export const importEmployeeCertAccounts = (file: File): Promise<Result<AccountResolveResult>> => {
  const form = new FormData();
  form.append('file', file);
  return request({
    url: '/ra/v1/employee-certs/accounts/import',
    method: 'post',
    data: form
  }) as any;
};

export interface EmployeeProductionChoice {
  employeeId: number | string;
  mode: 'NEW' | 'SELECTED';
  certId?: string;
}

export interface EmployeeProductionCandidate {
  id: string;
  serialNumber: string;
  subject: string;
  publicKey: string;
  keySize: number;
  source: 'NEW' | 'LEGACY';
  issuedAt: string;
  notBefore: string;
  notAfter: string;
  renewalRequired: boolean;
}

interface EmployeeProductionCandidateScope {
  rootId: number | string;
  profileId: number | string;
  rsaKeySize: number;
}

export const getEmployeeProductionCandidateAvailability = (
  data: EmployeeProductionCandidateScope & { employeeIds: string[]; identityKeys: string[] }
): Promise<Result<string[]>> =>
  request({ url: '/ra/v1/employee-certs/employees/production-candidate-availability', method: 'post', data, headers: { repeatSubmit: false } }) as any;

export const listEmployeeProductionCandidates = (
  employeeId: number | string,
  params: EmployeeProductionCandidateScope
): Promise<Result<EmployeeProductionCandidate[]>> =>
  request({ url: `/ra/v1/employee-certs/employees/${employeeId}/production-candidates`, method: 'get', params }) as any;

export const getEmployeeProductionCandidateDetail = (
  employeeId: number | string,
  certificateId: number | string,
  params: EmployeeProductionCandidateScope
): Promise<Result<RaCertDetail>> =>
  request({ url: '/ra/v1/employee-certs/employees/' + employeeId + '/production-candidates/' + certificateId, method: 'get', params }) as any;

export type EmployeeCertIssuanceMode = 'NEW' | 'RENEW';

export interface EmployeeCertIssuanceDefault {
  rootId?: string | null;
  profileId?: string | null;
  rsaKeySize?: number | null;
  issuanceMode: EmployeeCertIssuanceMode;
}

export const getEmployeeCertIssuanceDefault = (): Promise<Result<EmployeeCertIssuanceDefault>> =>
  request({ url: '/ra/v1/employee-certs/issuance-default', method: 'get' }) as any;

export const saveEmployeeCertIssuanceDefault = (data: EmployeeCertIssuanceDefault): Promise<Result<EmployeeCertIssuanceDefault>> =>
  request({ url: '/ra/v1/employee-certs/issuance-default', method: 'put', data }) as any;

export const createEmployeeCertTask = (data: {
  employeeIds: Array<number | string>;
  identityKeys: string[];
  userIds?: Array<number | string | null>;
  rootId: number | string;
  profileId: number | string;
  validityYears?: number;
  notBefore?: string;
  notAfter?: string;
  issuanceMode?: EmployeeCertIssuanceMode;
  rsaKeySize: number;
  pfxPasswordRule?: EmployeePfxPasswordRule | null;
  productionChoices?: EmployeeProductionChoice[];
  selectionMode?: string;
  remark?: string;
}): Promise<Result<EmployeeCertTaskDetail>> =>
  request({
    url: '/ra/v1/employee-certs/tasks',
    method: 'post',
    data
  }) as any;

export const listEmployeeEmailCertProfiles = (): Promise<Result<EmployeeEmailCertProfile[]>> =>
  request({
    url: '/ra/v1/employee-certs/email-profiles',
    method: 'get'
  }) as any;

export const saveEmployeeEmailCertProfilePolicy = (data: {
  rootId: number | string;
  profileId: number | string;
  enabled: boolean;
}): Promise<Result<EmployeeEmailCertProfile>> =>
  request({
    url: '/ra/v1/employee-certs/email-profiles/policy',
    method: 'put',
    data
  }) as any;

export const listEmployeeCertTaskProfiles = (): Promise<Result<RaCertFilterOption[]>> =>
  request<unknown, Result<RaCertFilterOption[]>>({ url: '/ra/v1/employee-certs/tasks/profiles', method: 'get' });

export const pageEmployeeCertTasks = (query: {
  pageNum: number;
  pageSize: number;
  taskNo?: string;
  certTypeCode?: string;
  profileId?: string;
}): Promise<Result<any>> =>
  request({
    url: '/ra/v1/employee-certs/tasks/page',
    method: 'post',
    data: cleanPage({ ...query, profileId: query.profileId || undefined })
  }) as any;

export const getEmployeeCertTask = (taskNo: string, background = false): Promise<Result<EmployeeCertTaskDetail>> =>
  request({
    url: `/ra/v1/employee-certs/tasks/${taskNo}`,
    method: 'get',
    headers: { hideErrorNotify: background }
  }) as any;

export const issueEmployeeCertTask = (taskNo: string, certIds: string[]): Promise<Result<EmployeeCertTaskDetail>> =>
  request({
    url: `/ra/v1/employee-certs/tasks/${encodeURIComponent(taskNo)}/issue-selected`,
    method: 'post',
    data: { certIds },
    timeout: 120_000
  }) as any;

export const downloadEmployeeCertTaskPackage = (taskNo: string): Promise<Blob> =>
  request({
    url: `/ra/v1/employee-certs/tasks/${encodeURIComponent(taskNo)}/download`,
    method: 'get',
    responseType: 'blob',
    timeout: 120_000,
    headers: { hideErrorNotify: true }
  }) as any;

export const downloadEmployeeCertPackage = (id: string | number): Promise<Blob> =>
  request({ url: `/ra/v1/employee-certs/${encodeURIComponent(String(id))}/download`, method: 'get',
    responseType: 'blob', timeout: 120_000, headers: { hideErrorNotify: true } }) as any;

export type EmployeeCertDownloadFormat = 'cer' | 'pem' | 'crt' | 'p7b' | 'pfx';

export const downloadSelectedEmployeeCerts = (ids: (string | number)[], format: EmployeeCertDownloadFormat): Promise<Blob> =>
  request({ url: '/ra/v1/employee-certs/download-selected', method: 'post', data: { ids, format },
    responseType: 'blob', timeout: 120_000, headers: { hideErrorNotify: true } }) as any;

export const listEmployeeCertLedgerProfiles = (): Promise<Result<RaCertFilterOption[]>> =>
  request<unknown, Result<RaCertFilterOption[]>>({ url: '/ra/v1/employee-certs/ledger-profiles', method: 'get' });

interface EmployeeCertLedgerFilters {
  taskNo?: string;
  serialNumber?: string;
  domainAccount?: string;
  employeeName?: string;
  certTypeCode?: string;
  profileId?: string;
  distributionStatus?: string;
  certStatus?: EmployeeCertStatus | '';
}

export const pageEmployeeCerts = (query: EmployeeCertLedgerFilters & { pageNum: number; pageSize: number }): Promise<Result<any>> =>
  request({
    url: '/ra/v1/employee-certs/page',
    method: 'post',
    data: { ...cleanPage(query), profileId: query.profileId || undefined }
  }) as any;

export const exportEmployeeCertLedger = (filters: EmployeeCertLedgerFilters): Promise<Blob> =>
  request<unknown, Blob>({
    url: '/ra/v1/employee-certs/export', method: 'post',
    data: { ...filters, profileId: filters.profileId || undefined },
    responseType: 'blob', timeout: 120_000, headers: { sensitive: true, repeatSubmit: false }
  });

export const getEmployeeLedgerCertificate = (id: number | string): Promise<Result<RaCertDetail>> =>
  request({ url: `/ra/v1/employee-certs/${encodeURIComponent(id)}/certificate`, method: 'get' }) as any;

export const getEmployeeCert = (id: number | string): Promise<Result<EmployeeCertDetail>> =>
  request({
    url: `/ra/v1/employee-certs/${id}`,
    method: 'get'
  }) as any;

export const updateEmployeeCertPassword = (id: number | string, password: string): Promise<Result<boolean>> =>
  request<unknown, Result<boolean>>({
    url: `/ra/v1/employee-certs/${id}/password`,
    method: 'put',
    headers: { repeatSubmit: false },
    data: { password }
  });

export const removeEmployeeCertLedgerEntries = (ids: (number | string)[]): Promise<Result<boolean>> =>
  request({ url: '/ra/v1/employee-certs/ledger/remove', method: 'post', data: ids }) as any;

export const getEmployeeCertPasswords = (ids: (number | string)[]): Promise<Result<Record<string, string>>> =>
  request<unknown, Result<Record<string, string>>>({
    url: '/ra/v1/employee-certs/passwords', method: 'post', data: ids, headers: { sensitive: true, repeatSubmit: false }
  });

function certificateDistributionPurpose(selection: EmployeeDistributionSelection) {
  if (selection.certificateChannel) return `CERTIFICATE_${selection.certificateChannel}`;
  return selection.freshBatch ? 'CERTIFICATE_BATCH' : 'CERTIFICATE';
}

export const getEmployeeDistributionOptions = (selection: EmployeeDistributionSelection, purpose: EmployeeSendPurpose = 'CERTIFICATE'): Promise<Result<EmployeeDistributionOptions>> => {
  const { freshBatch, certificateChannel, ...target } = selection;
  return request({
    url: '/ra/v1/employee-certs/distribution-options', method: 'post',
    data: { ...target, purpose: purpose === 'CERTIFICATE' ? certificateDistributionPurpose({ freshBatch, certificateChannel }) : purpose },
    headers: { repeatSubmit: false }
  }) as any;
};

export function submitEmployeeDistribution(selection: EmployeeDistributionSelection, messageType: EmployeeMailType, files: File[],
  scheme?: { id: string; confirmation: string }, channels?: EmployeeNoticeChannel[]): Promise<Result<{ batchNo: string; count: number }>> {
  const data = new FormData();
  const { freshBatch, certificateChannel, ...target } = selection;
  const purpose = scheme ? (channels ? 'NOTICE' : certificateDistributionPurpose({ freshBatch, certificateChannel })) : undefined;
  data.append('selection', new Blob([JSON.stringify({ ...target, purpose, channels, messageType,
    schemeId: scheme?.id, confirmation: scheme?.confirmation })], { type: 'application/json' }));
  files.forEach((file) => data.append('files', file));
  return request({ url: '/ra/v1/employee-certs/distributions', method: 'post', data, timeout: 120_000,
    headers: { sensitive: true } }) as any;
}

export const listEmployeeDistributionSchemes = (): Promise<Result<{ schemes: EmployeeDistributionScheme[]; profiles: RaCertFilterOption[] }>> =>
  request({ url: '/ra/v1/employee-certs/distribution-schemes', method: 'get' }) as any;

export const deleteEmployeeDistributionScheme = (id: string, revision?: string): Promise<Result<boolean>> =>
  request({ url: `/ra/v1/employee-certs/distribution-schemes/${encodeURIComponent(id)}`, method: 'delete', params: { revision } }) as any;

export function saveEmployeeDistributionScheme(scheme: EmployeeDistributionScheme, files: File[] = []): Promise<Result<EmployeeDistributionScheme>> {
  const data = new FormData();
  data.append('scheme', new Blob([JSON.stringify(scheme)], { type: 'application/json' }));
  files.forEach((file) => data.append('files', file));
  return request({ url: '/ra/v1/employee-certs/distribution-schemes', method: 'post', data, timeout: 120_000,
    headers: { repeatSubmit: false } }) as any;
}

export type EmployeeDistributionBatchType = 'DISTRIBUTION' | 'UPLOAD';

export const pageEmployeeDistributionBatches = (params: {
  taskNo?: string;
  batchType?: EmployeeDistributionBatchType;
  pageNum: number;
  pageSize: number;
}): Promise<Result<{ records: EmployeeDistributionBatch[]; total: number }>> =>
  request({ url: '/ra/v1/employee-certs/distribution-batches', method: 'get', params, headers: { hideErrorNotify: true } }) as any;

export const getEmployeeDistributionBatch = (batchNo: string): Promise<Result<EmployeeDistributionBatchItem[]>> =>
  request({
    url: `/ra/v1/employee-certs/distribution-batches/${encodeURIComponent(batchNo)}`,
    method: 'get',
    headers: { hideErrorNotify: true }
  }) as any;

export const listEmployeePublicKeys = (employeeId: number | string): Promise<Result<EmployeePublicKey[]>> =>
  request({
    url: `/ra/v1/employee-certs/employees/${employeeId}/public-keys`,
    method: 'get',
    headers: { hideErrorNotify: true }
  }) as any;

export const listEmployeeCertKeys = (employeeId: number | string): Promise<Result<EmployeeCertKey[]>> =>
  request({
    url: `/ra/v1/employee-certs/employees/${employeeId}/keys`,
    method: 'get'
  }) as any;

export const saveEmployeeCertKey = (data: EmployeeCertKey): Promise<Result<EmployeeCertKey>> =>
  request({
    url: '/ra/v1/employee-certs/keys',
    method: 'post',
    data
  }) as any;

export const listEmployeeCertTemplates = (): Promise<Result<EmployeeCertTemplate[]>> =>
  request({
    url: '/ra/v1/employee-certs/templates',
    method: 'get'
  }) as any;

export const saveEmployeeCertTemplate = (data: EmployeeCertTemplate): Promise<Result<EmployeeCertTemplate>> =>
  request({
    url: '/ra/v1/employee-certs/templates',
    method: 'put',
    data
  }) as any;

export const getEmployeeCertDistributionConfig = (): Promise<Result<EmployeeCertDistributionConfig>> =>
  request({
    url: '/ra/v1/employee-certs/distribution-config',
    method: 'get'
  }) as any;

export const saveEmployeeCertDistributionConfig = (data: EmployeeCertDistributionConfig): Promise<Result<EmployeeCertDistributionConfig>> =>
  request({
    url: '/ra/v1/employee-certs/distribution-config',
    method: 'put',
    data
  }) as any;

export const testEmployeeCertDistributionConfig = (data: {
  channel: 'EMAIL' | 'DINGTALK';
  send: boolean;
  recipient?: string;
  config: EmployeeCertDistributionConfig;
}): Promise<Result<string>> =>
  request({ url: '/ra/v1/employee-certs/distribution-config/test', method: 'post', data, timeout: 40_000,
    headers: { sensitive: true, repeatSubmit: false } }) as any;

export const downloadEmployeeCertAccountTemplate = () =>
  request({
    url: '/ra/v1/employee-certs/account-template',
    method: 'get',
    responseType: 'blob'
  });
