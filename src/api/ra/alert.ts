import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaAlertRule {
  id?: number | string;
  ruleName: string;
  alertType: string;
  alertLevel: string;
  triggerCondition: Record<string, any>;
  thresholdValue?: string;
  notificationType: string;
  notificationConfig?: Record<string, any>;
  coolDownMinutes: number;
  ruleStatus: number;
  effectiveTime?: string;
  expireTime?: string;
  description?: string;
  createTime?: string;
  updateTime?: string;
}

export interface RaAlertRuleQuery {
  pageNum: number;
  pageSize: number;
  ruleName?: string;
  alertType?: string;
  alertLevel?: string;
  ruleStatus?: number | string;
}

export interface RaAlertHistory {
  id?: number | string;
  ruleId?: number | string;
  ruleName?: string;
  alertType: string;
  alertLevel: string;
  triggerTime?: string;
  triggerValue?: string;
  businessType?: string;
  businessId?: number | string;
  alertMessage?: string;
  handleStatus?: number;
  handlerName?: string;
  handleTime?: string;
  handleComment?: string;
  notifyStatus?: number;
  recoveryTime?: string;
  isResolved?: number;
  createTime?: string;
  updateTime?: string;
}

export interface RaAlertHistoryQuery {
  pageNum: number;
  pageSize: number;
  alertType?: string;
  alertLevel?: string;
  handleStatus?: number | string;
  isResolved?: number | string;
  triggerTimeStart?: string;
  triggerTimeEnd?: string;
}

function withPage(query: { pageNum: number; pageSize: number; [key: string]: any }) {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return {
    ...query,
    ruleStatus: query.ruleStatus === '' ? undefined : query.ruleStatus,
    handleStatus: query.handleStatus === '' ? undefined : query.handleStatus,
    isResolved: query.isResolved === '' ? undefined : query.isResolved,
    alertType: query.alertType === '' ? undefined : query.alertType,
    alertLevel: query.alertLevel === '' ? undefined : query.alertLevel,
    pageNum,
    pageSize,
    pageIndex: (pageNum - 1) * pageSize
  };
}

export function pageRaAlertRule(query: RaAlertRuleQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/alert-rules/page',
    method: 'post',
    data: withPage(query)
  }) as any;
}

export function getRaAlertRule(id: number | string): Promise<Result<RaAlertRule>> {
  return request({
    url: `/ra/v1/alert-rules/${id}`,
    method: 'get'
  }) as any;
}

export function saveRaAlertRule(data: RaAlertRule): Promise<Result<void>> {
  return request({
    url: '/ra/v1/alert-rules',
    method: 'post',
    data
  }) as any;
}

export function modifyRaAlertRule(data: RaAlertRule): Promise<Result<void>> {
  return request({
    url: '/ra/v1/alert-rules',
    method: 'put',
    data
  }) as any;
}

export function removeRaAlertRule(ids: Array<number | string>): Promise<Result<void>> {
  return request({
    url: '/ra/v1/alert-rules',
    method: 'delete',
    data: ids
  }) as any;
}

export function updateRaAlertRuleStatus(id: number | string, ruleStatus: number): Promise<Result<void>> {
  return request({
    url: `/ra/v1/alert-rules/${id}/status`,
    method: 'put',
    data: { ruleStatus }
  }) as any;
}

export function validateRaAlertRule(data: RaAlertRule): Promise<Result<void>> {
  return request({
    url: '/ra/v1/alert-rules/validate',
    method: 'post',
    data
  }) as any;
}

export function scanRaAlerts(): Promise<Result<{ ruleCount: number; generatedCount: number }>> {
  return request({
    url: '/ra/v1/alert-rules/scan',
    method: 'post'
  }) as any;
}

export function pageRaAlertHistory(query: RaAlertHistoryQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/alert-histories/page',
    method: 'post',
    data: withPage(query)
  }) as any;
}

export function getRaAlertHistory(id: number | string): Promise<Result<RaAlertHistory>> {
  return request({
    url: `/ra/v1/alert-histories/${id}`,
    method: 'get'
  }) as any;
}

export function handleRaAlertHistory(id: number | string, data: { handleStatus: number; handleComment?: string; isResolved?: number }): Promise<Result<void>> {
  return request({
    url: `/ra/v1/alert-histories/${id}/handle`,
    method: 'put',
    data
  }) as any;
}
