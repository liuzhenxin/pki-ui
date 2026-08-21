import request from '@/utils/request';
import { Result } from '@/api/types';

export type IntranetCertStatus = 'VALID' | 'EXPIRED' | 'NOT_YET_VALID' | 'REVOKED' | 'UNKNOWN';
export type IntranetApplicantStatus = 'ACTIVE' | 'LEFT' | 'UNKNOWN';

export interface IntranetCertQuery {
  pageNum: number;
  pageSize: number;
  serialNumber?: string;
  systemName?: string;
  applicantKeyword?: string;
  deptName?: string;
  certStatus?: IntranetCertStatus | '';
  reminderEnabled?: boolean | null;
  applicantStatus?: IntranetApplicantStatus | '';
  ownerChangeRequired?: boolean | null;
  notAfterStart?: string;
  notAfterEnd?: string;
}

export interface IntranetCert {
  id?: string | number;
  sourceType?: 'ISSUED' | 'MANUAL';
  sourceCertId?: string | number;
  serialNumber: string;
  subject?: string;
  issuer?: string;
  rootId?: string | number;
  rootName?: string;
  profileId?: string | number;
  profileName?: string;
  notBefore?: string;
  notAfter?: string;
  certStatus?: IntranetCertStatus;
  certStatusName?: string;
  applicantEmployeeId?: string | number;
  applicantIdentityKey?: string;
  applicantName?: string;
  applicantAccount?: string;
  applicantEmail?: string;
  applicantDeptId?: string;
  applicantDeptName?: string;
  applicantDeptPath?: string;
  applicantStatus?: IntranetApplicantStatus;
  applicantStatusName?: string;
  systemName: string;
  usageScenario?: string;
  managerName?: string;
  managerEmail?: string;
  reminderEnabled?: boolean;
  reminderDays?: string;
  lastRemindTime?: string;
  ownerChangeRequired?: boolean;
  ledgerStatus?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface IntranetCertPrefill {
  existing?: IntranetCert;
  cert?: {
    id: string | number;
    serialNumber: string;
    subject?: string;
    rootId?: string | number;
    rootName?: string;
    profileId?: string | number;
    profileName?: string;
    notBefore?: string;
    notAfter?: string;
  };
}

export interface IntranetReminderTemplate {
  id?: string | number;
  templateCode: string;
  channel: string;
  title: string;
  content: string;
  enabled: boolean;
  updateTime?: string;
}

function cleanQuery(query: IntranetCertQuery) {
  return {
    ...query,
    serialNumber: query.serialNumber || undefined,
    systemName: query.systemName || undefined,
    applicantKeyword: query.applicantKeyword || undefined,
    deptName: query.deptName || undefined,
    certStatus: query.certStatus || undefined,
    reminderEnabled: query.reminderEnabled === null ? undefined : query.reminderEnabled,
    applicantStatus: query.applicantStatus || undefined,
    ownerChangeRequired: query.ownerChangeRequired === null ? undefined : query.ownerChangeRequired,
    notAfterStart: query.notAfterStart || undefined,
    notAfterEnd: query.notAfterEnd || undefined,
    pageNum: Number(query.pageNum || 1),
    pageSize: Number(query.pageSize || 10)
  };
}

export function pageIntranetCerts(query: IntranetCertQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/intranet-certs/page',
    method: 'post',
    data: cleanQuery(query)
  }) as any;
}

export function getIntranetCert(id: string | number): Promise<Result<IntranetCert>> {
  return request({
    url: `/ra/v1/intranet-certs/${id}`,
    method: 'get'
  }) as any;
}

export function prefillIntranetCert(params: { sourceCertId?: string | number; serialNumber?: string }): Promise<Result<IntranetCertPrefill>> {
  return request({
    url: '/ra/v1/intranet-certs/prefill',
    method: 'get',
    params
  }) as any;
}

export function saveIntranetCert(data: Partial<IntranetCert>): Promise<Result<IntranetCert>> {
  return request({
    url: '/ra/v1/intranet-certs',
    method: 'post',
    data
  }) as any;
}

export function removeIntranetCert(id: string | number): Promise<Result<IntranetCert>> {
  return request({
    url: `/ra/v1/intranet-certs/${id}`,
    method: 'delete'
  }) as any;
}

export function updateIntranetCertReminder(id: string | number, data: { reminderEnabled: boolean; reminderDays?: string }): Promise<Result<IntranetCert>> {
  return request({
    url: `/ra/v1/intranet-certs/${id}/reminder`,
    method: 'put',
    data
  }) as any;
}

export function exportIntranetCerts(query: IntranetCertQuery) {
  return request({
    url: '/ra/v1/intranet-certs/export',
    method: 'post',
    data: cleanQuery(query),
    responseType: 'blob'
  });
}

export function listIntranetCertTemplates(): Promise<Result<IntranetReminderTemplate[]>> {
  return request({
    url: '/ra/v1/intranet-certs/templates',
    method: 'get'
  }) as any;
}

export function saveIntranetCertTemplate(data: IntranetReminderTemplate): Promise<Result<IntranetReminderTemplate>> {
  return request({
    url: '/ra/v1/intranet-certs/templates',
    method: 'put',
    data
  }) as any;
}

export function refreshIntranetOwnerStatus(): Promise<Result<number>> {
  return request({
    url: '/ra/v1/intranet-certs/owner-status/refresh',
    method: 'post'
  }) as any;
}
