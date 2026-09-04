import request from '@/utils/request';
import { Result } from '@/api/types';

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
  totalEmployees: number;
  activeEmployees: number;
  foreignEmployees: number;
  departments: number;
  latestSyncStatus?: string;
  latestSyncTime?: string;
  latestSyncEmployees?: number;
  demoEnabled: boolean;
}

export interface FawvwSyncConfig {
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
  errorMessage?: string;
  startTime?: string;
  finishTime?: string;
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

export function getFawvwEmployee(id: number | string): Promise<Result<FawvwEmployee>> {
  return request({
    url: `/ra/v1/employees/${id}`,
    method: 'get'
  }) as any;
}

export function getFawvwEmployeeSummary(): Promise<Result<FawvwEmployeeSummary>> {
  return request({
    url: '/ra/v1/employees/summary',
    method: 'get'
  }) as any;
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

export function exportFawvwEmployees(query: FawvwEmployeeQuery) {
  return request({
    url: '/ra/v1/employees/export',
    method: 'post',
    data: withPage(query),
    responseType: 'blob'
  });
}
