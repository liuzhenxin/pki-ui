import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaWorkflowStep {
  key: string;
  name: string;
  role?: string;
  assigneeUserId?: number | string;
  allowReject: boolean;
  sortNo: number;
}

export interface RaWorkflowScope {
  rootScope: 'all' | 'selected';
  rootId?: number | string;
  profileScope: 'all' | 'selected';
  profileId?: number | string;
}

export interface RaWorkflowDefinition {
  id?: number | string;
  workflowName: string;
  workflowKey: string;
  workflowType: string;
  definition?: string;
  versionNo?: number;
  effectiveTime?: string;
  expireTime?: string;
  status?: number;
  description?: string;
  scope: RaWorkflowScope;
  steps: RaWorkflowStep[];
  createTime?: string;
  updateTime?: string;
}

export interface RaWorkflowProfileOption {
  id: number | string;
  name: string;
  type?: string;
}

export interface RaWorkflowRootOption {
  id: number | string;
  name: string;
  status?: number;
  profiles: RaWorkflowProfileOption[];
}

export interface RaWorkflowDefinitionQuery {
  pageNum: number;
  pageSize: number;
  workflowName?: string;
  workflowKey?: string;
  workflowType?: string;
  status?: number | string;
}

export function pageRaWorkflowDefinition(query: RaWorkflowDefinitionQuery): Promise<Result<any>> {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return request({
    url: '/ra/v1/workflow-definitions/page',
    method: 'post',
    data: {
      ...query,
      workflowType: query.workflowType === '' ? undefined : query.workflowType,
      status: query.status === '' ? undefined : query.status,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    }
  }) as any;
}

export function getRaWorkflowDefinition(id: number | string): Promise<Result<RaWorkflowDefinition>> {
  return request({
    url: `/ra/v1/workflow-definitions/${id}`,
    method: 'get'
  }) as any;
}

export function saveRaWorkflowDefinition(data: RaWorkflowDefinition): Promise<Result<void>> {
  return request({
    url: '/ra/v1/workflow-definitions',
    method: 'post',
    data
  }) as any;
}

export function modifyRaWorkflowDefinition(data: RaWorkflowDefinition): Promise<Result<void>> {
  return request({
    url: '/ra/v1/workflow-definitions',
    method: 'put',
    data
  }) as any;
}

export function removeRaWorkflowDefinition(ids: Array<number | string>): Promise<Result<void>> {
  return request({
    url: '/ra/v1/workflow-definitions',
    method: 'delete',
    data: ids
  }) as any;
}

export function publishRaWorkflowDefinition(id: number | string): Promise<Result<void>> {
  return request({
    url: `/ra/v1/workflow-definitions/${id}/publish`,
    method: 'post'
  }) as any;
}

export function copyRaWorkflowDefinition(id: number | string): Promise<Result<void>> {
  return request({
    url: `/ra/v1/workflow-definitions/${id}/copy`,
    method: 'post'
  }) as any;
}

export function updateRaWorkflowDefinitionStatus(id: number | string, status: number): Promise<Result<void>> {
  return request({
    url: `/ra/v1/workflow-definitions/${id}/status`,
    method: 'put',
    data: { status }
  }) as any;
}

export function validateRaWorkflowDefinition(data: RaWorkflowDefinition): Promise<Result<void>> {
  return request({
    url: '/ra/v1/workflow-definitions/validate',
    method: 'post',
    data
  }) as any;
}

export function listRaWorkflowScopeOptions(): Promise<Result<RaWorkflowRootOption[]>> {
  return request({
    url: '/ra/v1/workflow-definitions/scope-options',
    method: 'get'
  }) as any;
}
