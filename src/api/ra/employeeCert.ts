import request from '@/utils/request';
import { Result } from '@/api/types';

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
}

export interface AccountResolveResult {
  employees: EmployeeCertEmployee[];
  missingAccounts: string[];
}

export interface EmployeeCertTask {
  id: number | string;
  taskNo: string;
  certTypeCode: string;
  certTypeName: string;
  selectionMode: string;
  rootId?: number | string;
  profileId?: number | string;
  profileNameSnapshot?: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  taskStatus: string;
  taskStatusName?: string;
  remark?: string;
  createTime?: string;
}

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
  raCertId?: number | string;
  issueStatus?: string;
  issueMessage?: string;
  distributionStatus: string;
  distributionStatusName?: string;
  distributionTime?: string;
  distributionMessage?: string;
  emailStatus?: string;
  dingtalkStatus?: string;
  createTime?: string;
}

export interface EmployeeCertTaskDetail {
  task: EmployeeCertTask;
  certs: EmployeeCert[];
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

export interface EmployeeCertTemplate {
  id?: number | string;
  templateCode: string;
  channel: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface EmployeeEmailCertProfile {
  rootId: number | string;
  rootName: string;
  profileId: number | string;
  profileName: string;
  profileType?: string;
  profileUpdatedTime?: string;
  enabled: boolean;
}

export interface DistributionLog {
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

export const createEmployeeCertTask = (data: {
  accounts: string;
  rootId: number | string;
  profileId: number | string;
  notBefore?: string;
  notAfter?: string;
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

export const pageEmployeeCertTasks = (query: { pageNum: number; pageSize: number; taskNo?: string; certTypeCode?: string }): Promise<Result<any>> =>
  request({
    url: '/ra/v1/employee-certs/tasks/page',
    method: 'post',
    data: cleanPage(query)
  }) as any;

export const getEmployeeCertTask = (taskNo: string): Promise<Result<EmployeeCertTaskDetail>> =>
  request({
    url: `/ra/v1/employee-certs/tasks/${taskNo}`,
    method: 'get'
  }) as any;

export const distributeEmployeeCertTask = (taskNo: string): Promise<Result<EmployeeCertTaskDetail>> =>
  request({
    url: `/ra/v1/employee-certs/tasks/${taskNo}/distribute`,
    method: 'post'
  }) as any;

export const pageEmployeeCerts = (query: {
  pageNum: number;
  pageSize: number;
  serialNumber?: string;
  domainAccount?: string;
  employeeName?: string;
  certTypeCode?: string;
  distributionStatus?: string;
}): Promise<Result<any>> =>
  request({
    url: '/ra/v1/employee-certs/page',
    method: 'post',
    data: cleanPage(query)
  }) as any;

export const getEmployeeCert = (id: number | string): Promise<Result<EmployeeCertDetail>> =>
  request({
    url: `/ra/v1/employee-certs/${id}`,
    method: 'get'
  }) as any;

export const distributeEmployeeCert = (id: number | string): Promise<Result<EmployeeCert>> =>
  request({
    url: `/ra/v1/employee-certs/${id}/distribute`,
    method: 'post'
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

export const downloadEmployeeCertAccountTemplate = () =>
  request({
    url: '/ra/v1/employee-certs/account-template',
    method: 'get',
    responseType: 'blob'
  });
