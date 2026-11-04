import request from '@/utils/request';
export const SVS_TENANT_CODE = 'svs';
export const SVS_INIT_PATH = '/svs/init';
export interface Initialization {
  locked: boolean;
  databaseReady: boolean;
  canInitialize: boolean;
  platformTenantValid: boolean;
  deviceReady: boolean;
  tenantId: number;
  code: string;
}
export const getSvsInitialization = (): Promise<Initialization> => request({ url: '/admin/svs/init', method: 'get', hideErrorNotify: true } as any);
export const completeSvsInitialization = (subjects: Record<string, string>): Promise<void> =>
  request({ url: '/admin/svs/init/complete', method: 'post', data: subjects, hideErrorNotify: true } as any);

export type InitRole = 'SYSADMIN' | 'SECADMIN' | 'AUDITOR';
export interface AccountValidation {
  ready: boolean;
  rows: { username: string; role: InitRole; valid: boolean; message: string }[];
}
export const getSvsInitAccounts = (): Promise<Record<string, InitRole>> =>
  request({ url: '/admin/svs/init/accounts', method: 'get', hideErrorNotify: true } as any);
export const validateSvsInitAccounts = (subjects: Record<string, string>): Promise<AccountValidation> =>
  request({ url: '/admin/svs/init/validate', method: 'post', data: subjects, hideErrorNotify: true } as any);

export interface InitPlan {
  nextStep: number;
  keyId: string;
  keys: string[];
  hostType: 'STANDALONE';
  deploymentRevision: string;
  deployment: Record<string, string>;
}
export const getSvsInitPlan = (): Promise<InitPlan> => request({ url: '/admin/svs/init/plan', method: 'get', hideErrorNotify: true } as any);
export const reviewSvsInitStep = (step: number, keyId = '', deploymentRevision = ''): Promise<InitPlan> =>
  request({ url: `/admin/svs/init/steps/${step}`, method: 'post', data: { keyId, deploymentRevision }, hideErrorNotify: true } as any);

export const getSvsInitDeviceKeys = (): Promise<Record<string, string>> =>
  request({ url: '/admin/svs/init/device-keys', method: 'get', hideErrorNotify: true } as any);
export const registerSvsInitDeviceKey = (alias: string, fingerprint: string): Promise<{ keyId: string; alias: string; fingerprint: string }> =>
  request({ url: '/admin/svs/init/device-keys', method: 'post', data: { alias, fingerprint }, hideErrorNotify: true } as any);
