import request from '@/utils/request';
import type {
  AccessControlConfig,
  AccessControlCurrentIp,
  AlertChannel,
  AlertChannelSave,
  AlertDispatchResult,
  AlertEventLog,
  AlertRule,
  AlertRuleSave,
  AppServiceConfig,
  CryptoMonitorInstance,
  OpsContainer,
  OpsContainerLogs,
  OpsContainerActionRequest,
  OpsContainerVersion,
  OpsOperation,
  OpsOverview,
  OpsServer,
  PlatformServiceMenuConfig,
  RadiusConfig,
  RadiusStatus,
  RadiusTestRequest,
  SyslogConfig,
  SyslogStatus,
  AccessControlConfig,
  AccessControlCurrentIp
} from './types';
import type { Result } from '@/api/types';

const gatewayBaseURL = import.meta.env.VITE_APP_BASE_API.replace(/\/$/, '');
const baseURL = import.meta.env.VITE_APP_OPS_API || `${gatewayBaseURL}/ops`;

export function getOpsOverview(): Promise<OpsOverview> {
  return request({
    baseURL,
    url: '/v1/overview',
    method: 'get'
  }) as any;
}

export function getSyslogConfig(): Promise<Result<SyslogConfig>> {
  return request({ baseURL, url: '/v1/security/syslog/config', method: 'get' }) as any;
}

export function saveSyslogConfig(data: SyslogConfig): Promise<Result<void>> {
  return request({ baseURL, url: '/v1/security/syslog/config', method: 'put', data }) as any;
}

export function testSyslogConfig(data: SyslogConfig): Promise<Result<void>> {
  return request({ baseURL, url: '/v1/security/syslog/test', method: 'post', data }) as any;
}

export function getSyslogStatus(): Promise<Result<SyslogStatus>> {
  return request({ baseURL, url: '/v1/security/syslog/status', method: 'get' }) as any;
}

export function getAccessControlConfig(): Promise<Result<AccessControlConfig>> {
  return request({ baseURL, url: '/v1/security/access-control/config', method: 'get' }) as any;
}

export function saveAccessControlConfig(data: AccessControlConfig): Promise<Result<void>> {
  return request({ baseURL, url: '/v1/security/access-control/config', method: 'put', data }) as any;
}

export function getAccessControlCurrentIp(): Promise<Result<AccessControlCurrentIp>> {
  return request({ baseURL, url: '/v1/security/access-control/current-ip', method: 'get' }) as any;
}

export function getOpsServers(): Promise<OpsServer[]> {
  return request({
    baseURL,
    url: '/v1/servers',
    method: 'get'
  }) as any;
}

export function getAppServiceConfig(): Promise<Result<AppServiceConfig>> {
  return request({
    baseURL,
    url: '/v1/app-services',
    method: 'get'
  }) as any;
}

export function saveAppServiceConfig(data: AppServiceConfig): Promise<Result<void>> {
  return request({
    baseURL,
    url: '/v1/app-services',
    method: 'put',
    data
  }) as any;
}

export function getPlatformServiceMenuConfig(): Promise<Result<PlatformServiceMenuConfig>> {
  return request({
    baseURL,
    url: '/v1/platform-services/menus/config',
    method: 'get'
  }) as any;
}

export function savePlatformServiceMenuConfig(data: PlatformServiceMenuConfig): Promise<Result<void>> {
  return request({
    baseURL,
    url: '/v1/platform-services/menus/config',
    method: 'put',
    data
  }) as any;
}

export function getOpsContainers(): Promise<OpsContainer[]> {
  return request({
    baseURL,
    url: '/v1/containers',
    method: 'get'
  }) as any;
}

export function getOpsContainerLogs(serverCode: string, containerName: string, tail = 200): Promise<OpsContainerLogs> {
  return request({
    baseURL,
    url: `/v1/servers/${encodeURIComponent(serverCode)}/containers/${encodeURIComponent(containerName)}/logs`,
    method: 'get',
    params: { tail }
  }) as any;
}

export function checkOpsContainerUpdates(): Promise<OpsContainerVersion[]> {
  return request({ baseURL, url: '/v1/containers/check-updates', method: 'post' }) as any;
}

export function getOpsContainerVersions(serverCode: string, containerName: string): Promise<OpsContainerVersion> {
  return request({
    baseURL,
    url: `/v1/containers/${encodeURIComponent(serverCode)}/${encodeURIComponent(containerName)}/versions`,
    method: 'get'
  }) as any;
}

export function submitOpsContainerAction(serverCode: string, containerName: string, data: OpsContainerActionRequest): Promise<OpsOperation> {
  return request({
    baseURL,
    url: `/v1/containers/${encodeURIComponent(serverCode)}/${encodeURIComponent(containerName)}/actions`,
    method: 'post',
    data
  }) as any;
}

export function getOpsOperation(operationNo: string): Promise<OpsOperation> {
  return request({ baseURL, url: `/v1/operations/${encodeURIComponent(operationNo)}`, method: 'get' }) as any;
}

export function getOpsOperations(): Promise<OpsOperation[]> {
  return request({ baseURL, url: '/v1/operations', method: 'get' }) as any;
}

export function getCryptoMonitorInstances(): Promise<CryptoMonitorInstance[]> {
  return request({
    baseURL,
    url: '/v1/monitors/crypto',
    method: 'get'
  }) as any;
}

export function checkCryptoMonitorInstances(): Promise<CryptoMonitorInstance[]> {
  return request({
    baseURL,
    url: '/v1/monitors/crypto/check',
    method: 'post'
  }) as any;
}

export function getRadiusConfig(): Promise<Result<RadiusConfig>> {
  return request({
    url: '/auth/v1/security/radius/config',
    method: 'get'
  }) as any;
}

export function saveRadiusConfig(data: RadiusConfig): Promise<Result<void>> {
  return request({
    url: '/auth/v1/security/radius/config',
    method: 'put',
    data
  }) as any;
}

export function testRadiusAuthentication(data: RadiusTestRequest): Promise<Result<void>> {
  return request({
    url: '/auth/v1/security/radius/test',
    method: 'post',
    data
  }) as any;
}

export function getRadiusStatus(tenantCode?: string): Promise<Result<RadiusStatus>> {
  return request({
    url: '/auth/v1/security/radius/status',
    method: 'get',
    params: { tenantCode },
    headers: { isToken: false }
  }) as any;
}

export function getAlertChannels(): Promise<AlertChannel[]> {
  return request({ baseURL, url: '/v1/alert/channels', method: 'get' }) as any;
}

export function createAlertChannel(data: AlertChannelSave): Promise<AlertChannel> {
  return request({ baseURL, url: '/v1/alert/channels', method: 'post', data }) as any;
}

export function updateAlertChannel(id: number, data: AlertChannelSave): Promise<AlertChannel> {
  return request({ baseURL, url: `/v1/alert/channels/${id}`, method: 'put', data }) as any;
}

export function deleteAlertChannel(id: number): Promise<void> {
  return request({ baseURL, url: `/v1/alert/channels/${id}`, method: 'delete' }) as any;
}

export function testAlertChannel(id: number): Promise<AlertDispatchResult> {
  return request({ baseURL, url: `/v1/alert/channels/${id}/test`, method: 'post' }) as any;
}

export function getAlertRules(serviceCode?: string, eventCode?: string): Promise<AlertRule[]> {
  return request({ baseURL, url: '/v1/alert/rules', method: 'get', params: { serviceCode, eventCode } }) as any;
}

export function createAlertRule(data: AlertRuleSave): Promise<AlertRule> {
  return request({ baseURL, url: '/v1/alert/rules', method: 'post', data }) as any;
}

export function updateAlertRule(id: number, params: { enabled?: boolean; level?: string; cooldownSeconds?: number }): Promise<AlertRule> {
  return request({ baseURL, url: `/v1/alert/rules/${id}`, method: 'put', params }) as any;
}

export function deleteAlertRule(id: number): Promise<void> {
  return request({ baseURL, url: `/v1/alert/rules/${id}`, method: 'delete' }) as any;
}

export function getAlertEventLogs(limit = 100): Promise<AlertEventLog[]> {
  return request({ baseURL, url: '/v1/alert/logs', method: 'get', params: { limit } }) as any;
}
