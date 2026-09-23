import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type {
  OcspAdminPage,
  OcspAlert,
  OcspCanaryCandidate,
  OcspCanaryScope,
  OcspConfigHistory,
  OcspConfigHistoryQry,
  OcspMonitoringSummary,
  OcspResponseCacheStatus,
  OcspRetentionResult,
  OcspRetentionStatus,
  OcspRoutingPreview,
  OcspRoutingPreviewCmd,
  OcspStatusSource
} from '@/api/ocsp/types';

export const previewOcspRouting = (data: OcspRoutingPreviewCmd) =>
  request({ url: '/ocsp/v1/routing/preview', method: 'post', data }).then((res) => unwrapOcspData<OcspRoutingPreview>(res));

export const pageOcspConfigHistory = (params: OcspConfigHistoryQry) =>
  request({ url: '/ocsp/v1/config-history', method: 'get', params }).then((res) => unwrapOcspData<OcspAdminPage<OcspConfigHistory>>(res));

export const getOcspConfigHistory = (id: number) =>
  request({ url: `/ocsp/v1/config-history/${id}`, method: 'get' }).then((res) => unwrapOcspData<OcspConfigHistory>(res));

export const stageOcspCanary = (source: OcspStatusSource, canaryScope?: OcspCanaryScope) =>
  request({ url: '/ocsp/v1/ca-status-sources/canary/stage', method: 'post', data: { source, canaryScope } }).then((res) =>
    unwrapOcspData<OcspCanaryCandidate>(res)
  );

const canaryAction = (action: 'enable' | 'disable' | 'abort', candidate: OcspCanaryCandidate, reason: string, canaryScope?: OcspCanaryScope) =>
  request({
    url: `/ocsp/v1/ca-status-sources/canary/${action}`,
    method: 'post',
    data: { candidateId: candidate.id, expectedVersion: candidate.version, reason, canaryScope }
  }).then((res) => unwrapOcspData<OcspCanaryCandidate | boolean>(res));

export const enableOcspCanary = (candidate: OcspCanaryCandidate, reason: string, scope: OcspCanaryScope) =>
  canaryAction('enable', candidate, reason, scope) as Promise<OcspCanaryCandidate>;
export const disableOcspCanary = (candidate: OcspCanaryCandidate, reason: string) =>
  canaryAction('disable', candidate, reason, candidate.canaryScope) as Promise<OcspCanaryCandidate>;
export const abortOcspCanary = (candidate: OcspCanaryCandidate, reason: string) => canaryAction('abort', candidate, reason);
export const promoteOcspCanary = (candidate: OcspCanaryCandidate, expectedPublishedVersion: number, reason: string) =>
  request({
    url: '/ocsp/v1/ca-status-sources/canary/promote',
    method: 'post',
    data: { candidateId: candidate.id, expectedVersion: candidate.version, expectedPublishedVersion, reason }
  }).then((res) => unwrapOcspData<OcspStatusSource>(res));

export const getOcspMonitoringSummary = () =>
  request({ url: '/ocsp/v1/monitoring/summary', method: 'get' }).then((res) => unwrapOcspData<OcspMonitoringSummary>(res));
export const listOcspAlerts = (history = false) =>
  request({
    url: history ? '/ocsp/v1/monitoring/alerts/history' : '/ocsp/v1/monitoring/alerts',
    method: 'get',
    params: history ? { limit: 200 } : undefined
  }).then((res) => unwrapOcspData<OcspAlert[]>(res));
export const runOcspMonitoring = (kind: 'consistency' | 'source-health' | 'alerts') =>
  request({ url: `/ocsp/v1/monitoring/run/${kind}`, method: 'post' }).then((res) => unwrapOcspData<unknown>(res));

export const getOcspRetentionStatus = () =>
  request({ url: '/ocsp/v1/request-logs/retention/status', method: 'get' }).then((res) => unwrapOcspData<OcspRetentionStatus>(res));
export const runOcspRetention = () =>
  request({ url: '/ocsp/v1/request-logs/retention/run', method: 'post' }).then((res) => unwrapOcspData<OcspRetentionResult>(res));
export const getOcspResponseCacheStatus = () =>
  request({ url: '/ocsp/v1/config/cache/status', method: 'get' }).then((res) => unwrapOcspData<OcspResponseCacheStatus>(res));
