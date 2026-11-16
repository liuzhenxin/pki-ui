import { isAxiosError } from 'axios';
import type { Result } from '@/api/types';
import request from '@/utils/request';
import type { AuditPage, ConsoleCommands, ConsoleResponses, InstallationView, SetupView, SharedQuota } from './console';

export class ConsoleRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

type Method = 'get' | 'post' | 'put';
type GatewayRoute = { url: string; method: Method; params?: object; data?: object };
type AuditAction = 'auditor-list' | 'auditor-create' | 'auditor-status' | 'login-log-list' | 'operation-log-list';
type CspAction = Exclude<keyof ConsoleResponses, AuditAction>;

const application = '/csp/v3/applications';
const owned = '/csp/v3/registered-applications';
const installation = '/csp/v2/setup';
const setup = '/csp/v3/setup';

function read(url: string, params?: object): GatewayRoute {
  return { url, method: 'get', params };
}

function write(url: string, method: 'post' | 'put', data: object): GatewayRoute {
  return { url, method, data };
}

const routes: { [K in CspAction]: (body: ConsoleCommands[K]) => GatewayRoute } = {
  session: () => read('/csp/v1/console/session'),
  installation: () => read(installation),
  'installation-advance': (body) => write(installation + '/advance', 'post', body),
  'installation-complete': (body) => write(installation + '/complete', 'post', body),
  setup: () => read(setup),
  'setup-advance': (body) => write(setup + '/advance', 'post', body),
  'setup-complete': (body) => write(setup + '/complete', 'post', body),
  'service-list': (params) => read('/csp/v3/services', params),
  'service-save': (body) => write('/csp/v3/services', 'put', body),
  'device-list': (params) => read('/csp/v3/devices', params),
  'device-save': (body) => write('/csp/v3/devices', 'put', body),
  'device-state': (body) => write('/csp/v3/devices/state', 'post', body),
  'application-list': (params) => read(application, params),
  'application-view': ({ applicationId }) => read(`${application}/${encodeURIComponent(applicationId)}/onboarding`),
  'application-draft': ({ applicationId, ...body }) => write(`${application}/${encodeURIComponent(applicationId)}/authorization-draft`, 'put', body),
  'application-publish': ({ applicationId, ...body }) =>
    write(`${application}/${encodeURIComponent(applicationId)}/authorization-publish`, 'post', body),
  'application-suspend': ({ applicationId, ...body }) => write(`${application}/${encodeURIComponent(applicationId)}/suspend`, 'post', body),
  'quota-list': (params) => read('/csp/v3/quotas', params),
  'quota-save': (body) => write('/csp/v3/quotas', 'put', body),
  'owned-service-list': (params) => read(owned + '/services', params),
  'owned-service-save': (body) => write(owned + '/services', 'put', body),
  'owned-quota-list': (params) => read(owned + '/quotas', params),
  'owned-quota-save': (body) => write(owned + '/quotas', 'put', body),
  'owned-application-list': (params) => read(owned, params),
  'owned-application-register': (body) => write(owned, 'post', body),
  'owned-application-view': ({ applicationId }) => read(`${owned}/${encodeURIComponent(applicationId)}`),
  'owned-application-rename': ({ applicationId, ...body }) => write(`${owned}/${encodeURIComponent(applicationId)}/name`, 'put', body),
  'owned-application-save-policy': ({ applicationId, ...body }) => write(`${owned}/${encodeURIComponent(applicationId)}/policy`, 'put', body),
  'owned-application-revoke': ({ applicationId, ...body }) => write(`${owned}/${encodeURIComponent(applicationId)}/revoke-grant`, 'post', body),
  'owned-application-suspend': ({ applicationId, ...body }) => write(`${owned}/${encodeURIComponent(applicationId)}/suspend`, 'post', body),
  'owned-application-remove': ({ applicationId, ...body }) => write(`${owned}/${encodeURIComponent(applicationId)}/remove`, 'post', body),
  'owned-application-rotate': ({ applicationId, ...body }) => write(`${owned}/${encodeURIComponent(applicationId)}/rotate-secret`, 'post', body)
};

async function call<T>(route: GatewayRoute): Promise<T> {
  try {
    const result = await request<unknown, Result<T>>({
      ...route,
      headers: { sensitive: true, repeatSubmit: false, hideErrorNotify: true }
    });
    return result.data as T;
  } catch (failure) {
    const response = isAxiosError<Result>(failure) ? failure.response : undefined;
    const code = response?.data?.code;
    const status = code === 'Unauthorized' ? 401 : code === 'Forbidden' ? 403 : response?.status;
    const statusCode = Number(code);
    const errorStatus = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : status;
    throw new ConsoleRequestError(response?.data?.msg || (failure instanceof Error ? failure.message : '请求未完成，请刷新后重试。'), status ?? 502);
  }
}

type Page = { records: Record<string, string | number | null>[]; total: number | string };
type AuditContext = { mode: string; multiRoleEnabled: boolean; actions: string[]; createCandidates: { roleId: string; departmentId: string }[] };

function projectPage(data: Page, fields: string[]): AuditPage {
  const total = Number(data?.total);
  if (!Array.isArray(data?.records) || !Number.isSafeInteger(total) || total < 0) throw new Error('审计数据格式无效。');
  return { total, items: data.records.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))) };
}

const auditorRoleId = import.meta.env.VITE_APP_CSP_AUDITOR_ROLE_ID || '702';
const auditorDepartmentId = import.meta.env.VITE_APP_CSP_AUDITOR_DEPARTMENT_ID || '701';
const users = '/admin/v1/users';

async function auditContext(userId?: string) {
  const context = await call<AuditContext>(read('/admin/v1/application-authorization/ui-context', userId ? { userId } : undefined));
  if (context?.mode !== 'ENFORCE' || context.multiRoleEnabled !== false) throw new ConsoleRequestError('审计员管理策略尚未启用。', 403);
  return context;
}

const audit: { [K in AuditAction]: (body: ConsoleCommands[K]) => Promise<ConsoleResponses[K]> } = {
  'login-log-list': async ({ page }) =>
    projectPage(await call<Page>(write('/admin/v1/login-logs/page', 'post', { pageNum: page, pageSize: 20 })), [
      'username',
      'ipAddress',
      'status',
      'createTime'
    ]),
  'operation-log-list': async ({ page }) =>
    projectPage(await call<Page>(write('/admin/v1/operate-logs/page', 'post', { pageNum: page, pageSize: 20 })), [
      'operator',
      'moduleName',
      'name',
      'status',
      'createTime'
    ]),
  'auditor-list': async ({ page }) => {
    await auditContext();
    const data = await call<Page>(write(users + '/page', 'post', { pageNum: page, pageSize: 20, roleIds: [auditorRoleId] }));
    return projectPage(data, ['id', 'username', 'status']);
  },
  'auditor-create': async (body) => {
    const context = await auditContext();
    if (
      !context.actions?.includes('CREATE_USER') ||
      !context.createCandidates?.some(({ roleId, departmentId }) => roleId === auditorRoleId && departmentId === auditorDepartmentId)
    )
      throw new ConsoleRequestError('当前授权不允许新增审计员。', 403);
    await call(write(users, 'post', { co: { ...body, deptId: auditorDepartmentId, roleIds: [auditorRoleId] } }));
    return { saved: true };
  },
  'auditor-status': async (body) => {
    const context = await auditContext(body.id);
    if (!context.actions?.includes('SET_STATUS')) throw new ConsoleRequestError('当前授权不允许修改审计员状态。', 403);
    const target = await call<{ id: string; roleIds: string[] }>(read(users + '/' + encodeURIComponent(body.id)));
    if (String(target?.id) !== body.id || target.roleIds?.length !== 1 || String(target.roleIds[0]) !== auditorRoleId)
      throw new ConsoleRequestError('目标账号不是可管理的审计员。', 403);
    await call(write(users + '/status', 'put', { co: body }));
    return { saved: true };
  }
};

function normalizeQuota(quota: SharedQuota): SharedQuota {
  return { ...quota, maxRequests: Number(quota.maxRequests) };
}

export async function consoleRequest<K extends keyof ConsoleResponses>(action: K, body?: ConsoleCommands[K]): Promise<ConsoleResponses[K]> {
  if (Object.hasOwn(audit, action)) {
    const handler = audit[action as AuditAction] as (command?: ConsoleCommands[K]) => Promise<ConsoleResponses[K]>;
    return handler(body);
  }
  if (!Object.hasOwn(routes, action)) throw new Error('请求不受支持。');
  const route = routes[action as CspAction] as (command?: ConsoleCommands[K]) => GatewayRoute;
  const data = await call<ConsoleResponses[K]>(route(body));
  if (action === 'installation' || action.startsWith('installation-') || action === 'setup' || action.startsWith('setup-')) {
    const state = data as InstallationView | SetupView;
    const draftVersion =
      typeof state?.draftVersion === 'string' && /^\d+$/.test(state.draftVersion) ? Number(state.draftVersion) : state?.draftVersion;
    return { ...state, draftVersion } as ConsoleResponses[K];
  }
  if (action.endsWith('quota-list')) {
    const page = data as ConsoleResponses['quota-list'];
    return { ...page, items: page.items.map(normalizeQuota) } as ConsoleResponses[K];
  }
  if (action.endsWith('quota-save')) return normalizeQuota(data as SharedQuota) as ConsoleResponses[K];
  if (action.startsWith('owned-application-') && data && 'quota' in data && data.quota) {
    return { ...data, quota: { ...data.quota, maxRequests: Number(data.quota.maxRequests) } };
  }
  if (action.startsWith('application-') && data && 'policy' in data && data.policy) {
    return { ...data, policy: { ...data.policy, maxRequests: Number(data.policy.maxRequests) } };
  }
  return data;
}
