import request from '@/utils/request';
export type Kind = 'APPLICATION' | 'GRANT' | 'KEY_REFERENCE' | 'BINDING' | 'TRUST_ANCHOR' | 'POLICY' | 'ROLE_BINDING' | 'AUDIT_OPINION';
export interface Resource {
  id: string;
  kind: Kind;
  version: number;
  fields: Record<string, string>;
}
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  size: number;
}
export interface Approval {
  id: string;
  proposed: Resource;
  applicant: string;
  approver: string;
  state: string;
  expiresAt: string;
  createdAt: string;
  reason: string;
}
export interface Session {
  username: string;
  tenantId: number;
  role: string;
  permissions: string[];
}
export interface Menu {
  title: string;
  mutable: boolean;
  path: string;
  children: Menu[];
}
const base = '/admin/svs/product';
export const session = (): Promise<Session> => request({ url: base + '/session' });
export const menus = (): Promise<Menu[]> => request({ url: '/admin/svs/menus' });
export const resources = (kind: Kind, page = 1, size = 20): Promise<Page<Resource>> =>
  request({ url: `${base}/resources/${kind}`, params: { page, size } });
export const history = (kind: Kind, id: string): Promise<Resource[]> =>
  request({ url: `${base}/resources/${kind}/${encodeURIComponent(id)}/history` });
export const maintain = (data: Resource, reason: string): Promise<Resource> =>
  request({ url: base + '/resources', method: 'post', params: { reason }, data });
export const approvals = (page = 1): Promise<Page<Approval>> => request({ url: base + '/approvals', params: { page, size: 20 } });
export const runtime = (): Promise<Record<string, unknown>> => request({ url: '/admin/svs/runtime' });
export const metrics = (): Promise<{ counts: Record<string, unknown>[] }> => request({ url: '/admin/svs/operations/metrics' });
export const backup = (): Promise<Record<string, unknown>> => request({ url: '/admin/svs/operations/backup' });
export interface AuditRow {
  id: string;
  time: string;
  user: string;
  operation: string;
  result: string;
  objectName: string;
  message: string;
}
export const audit = (page: number, operation: string, result: string): Promise<Page<AuditRow>> =>
  request({ url: '/admin/svs/audit', params: { page, size: 20, operation: operation || undefined, result: result || undefined } });
export const exportAudit = (operation: string, result: string): Promise<Blob> =>
  request({ url: '/admin/svs/audit/export', params: { operation: operation || undefined, result: result || undefined }, responseType: 'blob' });

export const diagnostics = (id: string): Promise<Record<string, unknown>> =>
  request({ url: `/admin/svs/operations/diagnostics/${encodeURIComponent(id)}` });

export const approval = (id: string): Promise<Approval> => request({ url: `${base}/approvals/${encodeURIComponent(id)}` });
