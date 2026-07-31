import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaWorkflowTaskQuery {
  pageNum: number;
  pageSize: number;
  businessType?: string;
  keyword?: string;
}

export interface RaWorkflowTask {
  id: string | number;
  instanceId: string | number;
  instanceNo: string;
  businessType: string;
  businessTypeName: string;
  businessId: string | number;
  businessKey: string;
  taskName: string;
  taskStatus: string;
  taskStatusName: string;
  instanceStatus: string;
  userId?: string | number;
  userName?: string;
  deptId?: string | number;
  deptName?: string;
  serialNumber?: string;
  subject?: string;
  rootId?: string | number;
  rootName?: string;
  profileId?: string | number;
  profileName?: string;
  reason?: string;
  csr?: string;
  initiatorId?: string | number;
  initiatorName?: string;
  assigneeId?: string | number;
  assigneeName?: string;
  comment?: string;
  taskStartTime?: string;
  taskEndTime?: string;
  instanceStartTime?: string;
  instanceEndTime?: string;
}

export interface RaOperationCertQuery {
  pageNum: number;
  pageSize: number;
  operationType?: string;
  serialNumber?: string;
  subject?: string;
}

export interface RaOperationCert {
  id: string | number;
  serialNumber: string;
  subject: string;
  profileId?: string | number;
  profileName?: string;
  userId?: string | number;
  deptId?: string | number;
  deptName?: string;
  notAfter?: string;
  statusName?: string;
}

export interface RaOperationSubmitForm {
  operationType: string;
  certId: string | number;
  reason: string;
  csr?: string;
  notBefore?: string;
  notAfter?: string;
}

export function pageRaWorkflowTodo(query: RaWorkflowTaskQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/workflow-tasks/todo/page',
    method: 'post',
    data: query
  }) as any;
}

export function pageRaWorkflowDone(query: RaWorkflowTaskQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/workflow-tasks/done/page',
    method: 'post',
    data: query
  }) as any;
}

export function getRaWorkflowTask(id: string | number): Promise<Result<RaWorkflowTask>> {
  return request({
    url: `/ra/v1/workflow-tasks/${id}`,
    method: 'get'
  }) as any;
}

export function approveRaWorkflowTask(id: string | number, comment?: string): Promise<Result<void>> {
  return request({
    url: `/ra/v1/workflow-tasks/${id}/approve`,
    method: 'post',
    data: { comment }
  }) as any;
}

export function rejectRaWorkflowTask(id: string | number, comment: string): Promise<Result<void>> {
  return request({
    url: `/ra/v1/workflow-tasks/${id}/reject`,
    method: 'post',
    data: { comment }
  }) as any;
}

export function pageRaOperationCert(query: RaOperationCertQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/workflow-tasks/certs/page',
    method: 'post',
    data: query
  }) as any;
}

export function submitRaOperation(data: RaOperationSubmitForm): Promise<Result<void>> {
  return request({
    url: '/ra/v1/workflow-tasks/operations',
    method: 'post',
    data
  }) as any;
}
