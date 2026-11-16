import { isAxiosError } from 'axios';
import type { Result } from '@/api/types';
import request from '@/utils/request';

export interface Application {
  applicationId: string;
  name: string;
  appKey: string;
  version: string;
  credentialVersion: string;
  enabled: boolean;
}

export interface Grant {
  serviceId: string;
  operation: string;
  algorithm: string;
  objectId: string;
}

export interface ServiceOption extends Omit<Grant, 'objectId'> {
  name: string;
  family: string;
  objectId: string | null;
}

export interface Quota {
  maxRequests: number;
  windowSeconds: number;
}

export interface Summary {
  application: Application;
  grantCount: number;
  quota: Quota | null;
}

export interface ApplicationView {
  application: Application;
  quota: Quota | null;
  activeGrants: Grant[];
}

export interface Credential {
  applicationId: string;
  appKey: string;
  appSecret: string;
}

interface Page<T> {
  items: T[];
  hasMore: boolean;
}

const base = '/ucsp/v3/registered-applications';
const appPath = (id: string) => base + '/' + encodeURIComponent(id);
const headers = { sensitive: true, repeatSubmit: false, hideErrorNotify: true };

async function send<T>(url: string, method: 'get' | 'put' | 'post' = 'get', data?: object, params?: object): Promise<T> {
  const response = await request<unknown, Result<T>>({ url, method, data, params, headers });
  return response.data;
}

export const listApplications = (offset: number, query: string) => send<Page<Summary>>(base + '/summaries', 'get', undefined, { offset, query });
export const listGrantOptions = (offset: number) => send<Page<ServiceOption>>(base + '/service-options', 'get', undefined, { offset });
export const getApplication = (id: string) => send<ApplicationView>(appPath(id));
export const registerApplication = (name: string) => send<Credential>(base, 'post', { name });
export const rotateCredential = ({ applicationId, version }: Application) =>
  send<Credential>(appPath(applicationId) + '/rotate-secret', 'post', { expectedVersion: version });
export const saveApplicationPolicy = ({ applicationId, version }: Application, grants: Grant[], quota: Quota) =>
  send<ApplicationView>(appPath(applicationId) + '/policy', 'put', { expectedVersion: version, policy: { grants, ...quota } });
export const revokeApplicationGrant = ({ applicationId, version }: Application, grant: Grant) =>
  send<ApplicationView>(appPath(applicationId) + '/revoke-grant', 'post', { expectedVersion: version, grant });
export const suspendApplication = ({ applicationId, version }: Application) =>
  send<ApplicationView>(appPath(applicationId) + '/suspend', 'post', { expectedVersion: version });

export function applicationError(error: unknown, fallback: string) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 409) return '应用或服务配置已变更，请刷新详情后重试。';
  if (status === 400) return '提交内容无效，请检查授权和配额配置。';
  if (status === 403) return '当前账号没有应用接入权限。';
  return fallback;
}
