import request from '@/utils/request';
export interface InitializationStatus {
  revision: number;
  step: number;
  locked: boolean;
  canInitialize: boolean;
  completedAt: number;
}
export interface InitializationCheck {
  code: string;
  step: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  required: boolean;
  checkedAt: number;
  remedy: string;
}
export interface InitializationPlan {
  status: InitializationStatus;
  checks: InitializationCheck[];
  revisions: Record<string, string>;
  summary: Record<string, string>;
  boundAccounts: string[];
  verificationId: string;
  expiresAt: number;
}
export interface InitializationCommand {
  revision: number;
  revisions: Record<string, string>;
  accepted: boolean;
  agreementVersion: string;
  hostType: 'STANDALONE';
  verificationId: string;
  requestId: string;
}
async function call<T>(path: string, data?: unknown): Promise<T> {
  const result = (await request({
    url: `/kms/v1/initialization${path}`,
    method: data === undefined ? 'get' : 'post',
    data,
    headers: { repeatSubmit: false, hideErrorNotify: true },
    timeout: 120000
  })) as unknown as { data: T };
  return result.data;
}
export const getKmsInitialization = () => call<InitializationStatus>('');
export const getKmsInitializationPlan = () => call<InitializationPlan>('/plan');
export const recheckKmsInitialization = () => call<InitializationPlan>('/checks', {});
export const confirmKmsInitializationStep = (step: number, data: InitializationCommand) => {
  if (!Number.isInteger(step) || step < 1 || step > 7) throw new Error('初始化步骤无效');
  return call<InitializationPlan>(step === 4 ? '/device/verify' : step === 7 ? '/accounts/verify' : `/steps/${step}/confirm`, data);
};
export const testKmsInitialization = (data: InitializationCommand) => call<InitializationPlan>('/self-test', data);
export const completeKmsInitialization = (data: InitializationCommand) => call<InitializationPlan>('/complete', data);
