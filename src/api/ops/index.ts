import request from '@/utils/request';
import type {
  CryptoMonitorInstance,
  OpsContainer,
  OpsContainerLogs,
  OpsOverview,
  OpsServer,
  RadiusConfig,
  RadiusStatus,
  RadiusTestRequest,
  SyslogConfig,
  SyslogStatus
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

export function getOpsServers(): Promise<OpsServer[]> {
  return request({
    baseURL,
    url: '/v1/servers',
    method: 'get'
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
