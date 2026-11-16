import request from '@/utils/request';

export interface AuditPage<T> {
  rows: T[];
  hasMore: boolean;
}

export interface Auditor {
  id: string;
  username: string;
  enabled: boolean;
  createdAt: string;
}

export interface OperationLog {
  eventId: string;
  action: string;
  target: string;
  version: number;
  createdAt: string;
}

export interface CallLog {
  eventId: string;
  requestId: string;
  applicationId: string;
  capability: string;
  objectId: string;
  serviceId: string | null;
  endpointId: string | null;
  resourceVersion: number;
  grantVersion: number;
  outcome: string;
  elapsedMillis: number;
  createdAt: string;
}

const base = '/ucsp/v1/audit';

export const listAuditors = async (offset: number): Promise<AuditPage<Auditor>> =>
  (await request({ url: base + '/auditors', method: 'get', params: { offset } })).data;

export const createAuditor = async (username: string, password: string): Promise<Auditor> =>
  (await request({ url: base + '/auditors', method: 'post', headers: { sensitive: true, repeatSubmit: false }, data: { username, password } })).data;

export const listOperations = async (offset: number): Promise<AuditPage<OperationLog>> =>
  (await request({ url: base + '/operations', method: 'get', params: { offset } })).data;

export const listCalls = async (offset: number, requestId?: string): Promise<AuditPage<CallLog>> =>
  (await request({ url: base + '/calls', method: 'get', params: { offset, requestId } })).data;
