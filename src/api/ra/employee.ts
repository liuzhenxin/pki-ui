import request from '@/utils/request';
import { Result } from '@/api/types';
import type { RaApplicantUserInfo } from './user';

export interface FawvwEmployeeQuery {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  domainAccount?: string;
  departmentId?: string;
  employeeTypeId?: string;
  foreignFlag?: boolean | null;
  status?: string;
}

export interface FawvwEmployee {
  id: number | string;
  identityKey: string;
  employeeNo: string;
  domainAccount: string;
  birthday?: string;
  cnName: string;
  enName?: string;
  gender?: string;
  genderName?: string;
  email?: string;
  enterTime?: string;
  jobId?: string;
  jobName?: string;
  positionCode?: string;
  positionName?: string;
  jobGrade?: string;
  employeeTypeId?: string;
  employeeTypeName?: string;
  foreignFlag?: boolean;
  levelId?: string;
  levelName?: string;
  managerLevel?: string;
  sourceStatus?: string;
  sourceStatusName?: string;
  identityStatus?: string;
  employeeStatus?: string;
  departmentId?: string;
  departmentCode?: string;
  departmentName?: string;
  departmentPath?: string;
  departmentNamePath?: string;
  lastSeenTime?: string;
  recordSource?: 'API' | 'MANUAL' | 'IMPORT' | 'LOCAL_USER';
  localEnabled?: boolean;
  raUserId?: number | string;
}

export interface EmployeeInput {
  employeeNo?: string;
  gender?: string;
  jobName?: string;
  domainAccount: string;
  birthday: string;
  cnName: string;
  email?: string;
  departmentId?: string;
}

export function createFawvwEmployee(data: EmployeeInput): Promise<Result<number>> {
  return request({ url: '/ra/v1/employees', method: 'post', data }) as any;
}

export function deleteFawvwEmployee(id: number | string): Promise<Result<void>> {
  return request({ url: `/ra/v1/employees/${id}`, method: 'delete' }) as any;
}

export function downloadFawvwEmployeeImportTemplate(): Promise<Blob> {
  return request({ url: '/ra/v1/employees/import-template', method: 'get', responseType: 'blob' }) as unknown as Promise<Blob>;
}

export function importFawvwEmployees(data: EmployeeInput[]): Promise<Result<number>> {
  return request({ url: '/ra/v1/employees/import', method: 'post', data }) as any;
}

export function importFawvwEmployeeFile(file: File): Promise<Result<number>> {
  const data = new FormData();
  data.append('file', file);
  return request({ url: '/ra/v1/employees/import-file', method: 'post', data }) as any;
}

export function previewFawvwEmployeeFile(file: File): Promise<Result<EmployeeInput[]>> {
  const data = new FormData();
  data.append('file', file);
  return request({ url: '/ra/v1/employees/import-preview', method: 'post', data }) as any;
}

export interface EmployeeActivityCertificate {
  cert_id: number | string;
  serial_number: string;
  profile_name?: string;
}

export interface EmployeeActivity {
  applies: Array<{
    id: number | string; status: number; create_time: string; review_comment?: string; certificates?: EmployeeActivityCertificate[];
  }>;
  employeeCertificates: Array<{
    id: number | string; task_no?: string; serial_number?: string; ra_cert_id?: string | number;
    issue_status: string; issue_message?: string; profile_name?: string; key_source?: string; create_time: string; process_time?: string;
  }>;
}

export function getFawvwEmployeeActivity(id: number | string): Promise<Result<EmployeeActivity>> {
  return request({ url: `/ra/v1/employees/${id}/activity`, method: 'get' }) as any;
}

export interface EmployeeCertificateRecord {
  id: string;
  serialNumber: string;
  subject?: string;
  usage?: string;
  employeeCertificateType?: string;
  profileName?: string;
  issuerName?: string;
  status: 'VALID' | 'NOT_YET_VALID' | 'EXPIRED' | 'HOLD' | 'REVOKED' | 'UNKNOWN';
  source?: string;
  taskNo?: string;
  superseded: boolean;
  productionAction?: string;
  productionTime?: string;
  adUploadEligible?: boolean;
  createTime?: string;
  notBefore?: string;
  notAfter?: string;
}

export function getEmployeeCertificates(params: {
  userId?: number | string;
  employeeId?: number | string;
  certificateId?: number | string;
  pageNum: number;
  pageSize: number;
}): Promise<Result<{ records: EmployeeCertificateRecord[]; total: number }>> {
  return request({ url: '/ra/v1/employees/certificates', method: 'get', params, headers: { hideErrorNotify: true } }) as any;
}

export function setFawvwEmployeeEnabled(id: number | string, enabled: boolean): Promise<Result<void>> {
  return request({ url: `/ra/v1/employees/${id}/enabled`, method: 'patch', data: enabled }) as any;
}

export function confirmFawvwAccountOwner(id: number | string): Promise<Result<void>> {
  return request({ url: `/ra/v1/employees/sync-conflicts/${id}/confirm`, method: 'post' }) as any;
}

export function getFawvwEmployeeApplicant(id: number | string): Promise<Result<RaApplicantUserInfo>> {
  return request({ url: `/ra/v1/employees/${id}/applicant`, method: 'get' }) as any;
}

export function getFawvwEmployeeIdByApplicant(userId: number | string): Promise<Result<number | string | null>> {
  return request({ url: `/ra/v1/employees/applicant-links/${userId}`, method: 'get', headers: { hideErrorNotify: true } }) as any;
}

export interface FawvwOrgNode {
  id: string;
  parentId?: string;
  label: string;
  path?: string;
  depth: number;
  childCount: number;
  children?: FawvwOrgNode[];
}

export interface FawvwEmployeeSummary {
  exportAllowed?: boolean;
  localEmployees: number;
  activeEmployees: number;
  foreignEmployees: number;
  chineseEmployees: number;
  departments: number;
  latestSyncStatus?: string;
  latestSyncTime?: string;
  latestSyncEmployees?: number;
  demoEnabled: boolean;
  canViewLocalRecovery?: boolean;
  canRestoreLocalAccounts?: boolean;
}

export interface FawvwEmployeeDataExplanation {
  summary: FawvwEmployeeSummary;
  totalRecords: number;
  apiRecords: number;
  localRecords: number;
  leftRecords: number;
  disabledRecords: number;
  activeUnlinkedRecords: number;
  leftUnlinkedRecords: number;
  chineseTypeMissing: number;
}

export interface FawvwSyncConfig {
  exportAllowed?: boolean;
  enabled: boolean;
  scheduleType: string;
  dailyTime: string;
  intervalHours: number;
  pageSize: number;
  sourceMode: string;
  apiBaseUrl?: string;
  apiAppKey?: string;
  apiSecretKey?: string;
  apiSecretConfigured?: boolean;
  nextRunTime?: string;
  lastRunTime?: string;
}

export interface FawvwSyncLog {
  taskNo: string;
  triggerType: string;
  sourceMode: string;
  status: string;
  totalOrgs: number;
  totalEmployees: number;
  createdCount: number;
  updatedCount: number;
  disabledCount: number;
  invalidCount: number;
  employeeNoChangeCount?: number;
  errorMessage?: string;
  startTime?: string;
  finishTime?: string;
}

export interface FawvwEmployeeNumberChange {
  domainAccount: string;
  cnName: string;
  previousEmployeeNo: string;
  employeeNo: string;
}

function withPage(query: FawvwEmployeeQuery) {
  return {
    ...query,
    keyword: query.keyword || undefined,
    domainAccount: query.domainAccount || undefined,
    departmentId: query.departmentId || undefined,
    employeeTypeId: query.employeeTypeId || undefined,
    status: query.status || undefined,
    foreignFlag: query.foreignFlag === null ? undefined : query.foreignFlag,
    pageNum: Number(query.pageNum || 1),
    pageSize: Number(query.pageSize || 10)
  };
}

export function pageFawvwEmployees(query: FawvwEmployeeQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/employees/page',
    method: 'post',
    data: withPage(query)
  }) as any;
}

export type EmployeeDirectoryRow = { employee?: FawvwEmployee; applicant: RaApplicantUserInfo; name: string; source: 'API' | 'LOCAL'; eligible: boolean; localRecoveryRequired?: boolean };
export type EmployeeDirectoryQuery = FawvwEmployeeQuery & { source?: string; userCategory?: string; mobile?: string };

export function getEmployeeDirectoryDetails(userId: number | string): Promise<Result<{ person: EmployeeDirectoryRow; activity: EmployeeActivity }>> {
  return request({ url: `/ra/v1/employees/directory/${userId}`, method: 'get' }) as any;
}

export function pageEmployeeDirectory(query: EmployeeDirectoryQuery, signal?: AbortSignal):
  Promise<Result<{ records: EmployeeDirectoryRow[]; total: number }>> {
  return request({
    url: '/ra/v1/employees/directory/page',
    method: 'post',
    headers: { repeatSubmit: false },
    signal,
    data: { ...query, departmentId: query.departmentId || undefined }
  }) as any;
}

export function exportEmployeeDirectory(query: EmployeeDirectoryQuery): Promise<Blob> {
  return request({
    url: '/ra/v1/employees/directory/export',
    method: 'post',
    headers: { repeatSubmit: false },
    data: { ...query, departmentId: query.departmentId || undefined },
    responseType: 'blob'
  }) as unknown as Promise<Blob>;
}

export function getFawvwEmployee(id: number | string): Promise<Result<FawvwEmployee>> {
  return request({
    url: `/ra/v1/employees/${id}`,
    method: 'get'
  }) as any;
}

export function getFawvwEmployeeSummary(): Promise<Result<FawvwEmployeeSummary>> {
  return request({
    url: '/ra/v1/employees/summary',
    method: 'get',
    headers: { hideErrorNotify: true }
  }) as any;
}

export function getFawvwEmployeeDataExplanation(): Promise<Result<FawvwEmployeeDataExplanation>> {
  return request({ url: '/ra/v1/employees/data-explanation', method: 'get' }) as any;
}

export function getFawvwOrgTree(): Promise<Result<FawvwOrgNode[]>> {
  return request({
    url: '/ra/v1/employees/org-tree',
    method: 'get'
  }) as any;
}

export function getFawvwSyncConfig(): Promise<Result<FawvwSyncConfig>> {
  return request({
    url: '/ra/v1/employees/sync-config',
    method: 'get'
  }) as any;
}

export function saveFawvwSyncConfig(data: FawvwSyncConfig): Promise<Result<FawvwSyncConfig>> {
  return request({
    url: '/ra/v1/employees/sync-config',
    method: 'put',
    data
  }) as any;
}

export function syncFawvwEmployees(): Promise<Result<FawvwSyncLog>> {
  return request({
    url: '/ra/v1/employees/sync-tasks',
    method: 'post'
  }) as any;
}

export function getFawvwSyncTask(taskNo: string): Promise<Result<FawvwSyncLog>> {
  return request({
    url: `/ra/v1/employees/sync-tasks/${encodeURIComponent(taskNo)}`,
    method: 'get'
  }) as any;
}

export function pageFawvwSyncLogs(query: { pageNum: number; pageSize: number; status?: string }): Promise<Result<any>> {
  return request({
    url: '/ra/v1/employees/sync-tasks/page',
    method: 'post',
    data: {
      ...query,
      status: query.status || undefined,
      pageNum: Number(query.pageNum || 1),
      pageSize: Number(query.pageSize || 10)
    }
  }) as any;
}

export function pageFawvwInvalidEmployees(taskNo: string, pageNum = 1, pageSize = 10): Promise<Result<any>> {
  return request({
    url: `/ra/v1/employees/sync-tasks/${taskNo}/invalid-records`,
    method: 'get',
    params: { pageNum, pageSize }
  }) as any;
}

export function pageFawvwEmployeeNumberChanges(
  taskNo: string,
  pageNum: number,
  pageSize: number
): Promise<Result<{ records: FawvwEmployeeNumberChange[]; total: number }>> {
  return request({
    url: `/ra/v1/employees/sync-tasks/${encodeURIComponent(taskNo)}/employee-number-changes`,
    method: 'get',
    params: { pageNum, pageSize }
  }) as any;
}

export function exportFawvwEmployees(query: FawvwEmployeeQuery) {
  return request({
    url: '/ra/v1/employees/export',
    method: 'post',
    data: withPage(query),
    responseType: 'blob'
  });
}
