export type ServiceFamily = 'HSM' | 'SVS' | 'TSA' | 'SEF';
export interface ServiceResource {
  serviceId: string;
  family: ServiceFamily;
  poolKey: string;
  adapterKey: string;
  simulated: boolean;
  enabled: boolean;
  healthy: boolean;
  version: string;
}
export interface ServiceGrant {
  serviceId: string;
  operation: string;
  algorithm: string;
  objectId: string;
}
export interface ApplicationPolicy {
  capabilities: string[];
  poolKey: string;
  maxRequests: number;
  windowSeconds: number;
  services: ServiceGrant[];
}
export interface ApplicationSummary {
  applicationId: string;
  name: string;
  platformStatus: string;
  onboardingState: string;
  version: string;
}
export interface ApplicationView {
  applicationId: string;
  version: string;
  state: string;
  platformVersion: string | null;
  proposerId: string | null;
  approverId: string | null;
  policy: ApplicationPolicy | null;
}
export interface SharedQuota {
  dimension: 'TENANT' | 'CAPABILITY' | 'RESOURCE_POOL';
  key: string;
  capability: string;
  maxRequests: number;
  windowSeconds: number;
  version: string;
}
export interface ManagementPage<T> {
  items: T[];
  hasMore: boolean;
}
export interface InstallationView {
  initialized: boolean;
  draftVersion: number;
  step: number;
  agreed: boolean;
  attempted: boolean;
  agreementVersion: string;
  companyName: string;
  serviceVersion: string;
  environment: string;
  checkedAt: string | null;
  accounts: { role: 'SYSTEM_ADMIN' | 'SECURITY_ADMIN' | 'AUDIT_ADMIN'; valid: boolean }[];
}
export type InstallationAction = 'AGREE' | 'CHECK_ENV' | 'VERIFY_ACCOUNTS';
export interface SetupView {
  workflow: 'SERVICE_ACTIVATION_V3';
  initialized: boolean;
  draftVersion: number;
  step: number;
  attempted: boolean;
  serviceVersion: string;
  environment: string;
  checkedAt: string | null;
  checks: { group: 'ENVIRONMENT' | 'RESOURCES' | 'POLICY'; code: string; ready: boolean }[];
  enabledCapabilities: 'RANDOM'[];
}
export type SetupAction = 'CHECK_ENV' | 'CHECK_RESOURCES' | 'CHECK_POLICY';
/** 固定同源BFF契约；浏览器不持有Auth令牌或OAuth客户端秘密。 */
export interface ConsoleResponses {
  'service-list': ManagementPage<ServiceResource>;
  'service-save': ServiceResource;
  'application-list': ManagementPage<ApplicationSummary>;
  'application-view': ApplicationView;
  'application-draft': ApplicationView;
  'application-publish': ApplicationView;
  'application-suspend': ApplicationView;
  'quota-list': ManagementPage<SharedQuota>;
  'quota-save': SharedQuota;
  session: {
    csrf: string;
    authenticated: boolean;
    canInitialize?: boolean;
    initializationAttempted?: boolean;
    certificateLoginEnabled?: boolean;
    httpTestMode?: boolean;
  };
  challenge: { csrf: string; captchaEnabled: boolean; image: string };
  login: { authenticated: boolean; canInitialize?: boolean };
  'certificate-challenge': { challengeId: string; signData: string; sm2UserId: string };
  'certificate-login': { authenticated: boolean; canInitialize?: boolean };
  state: { initialized: boolean };
  installation: InstallationView;
  'installation-advance': InstallationView;
  'installation-complete': InstallationView;
  setup: SetupView;
  'setup-advance': SetupView;
  'setup-complete': SetupView;
  environment: { checks: { name: string; ok: boolean }[] };
  initialize: { initialized: boolean; reauthenticationRequired: boolean };
  logout: { authenticated: boolean };
}
export interface ConsoleCommands {
  'service-list': { offset: number };
  'service-save': Pick<ServiceResource, 'serviceId' | 'family' | 'poolKey' | 'adapterKey' | 'enabled'> & { expectedVersion: string };
  'application-list': { offset: number };
  'application-view': { applicationId: string };
  'application-draft': ApplicationPolicy & { applicationId: string; expectedVersion: string };
  'application-publish': { applicationId: string; expectedVersion: string };
  'application-suspend': { applicationId: string; expectedVersion: string };
  'quota-list': { offset: number };
  'quota-save': Omit<SharedQuota, 'version'> & { expectedVersion: string };
  session: undefined;
  challenge: undefined;
  login: { username: string; password: string; captcha: string };
  'certificate-challenge': { certificate: string };
  'certificate-login': { challengeId: string; signature: string };
  state: undefined;
  installation: undefined;
  'installation-advance': { draftVersion: number; action: InstallationAction; agreementVersion?: string };
  'installation-complete': { draftVersion: number; confirm: true };
  setup: undefined;
  'setup-advance': { draftVersion: number; action: SetupAction };
  'setup-complete': { draftVersion: number; confirm: true };
  environment: undefined;
  initialize: { confirm: true };
  logout: Record<string, never>;
}
const endpoints = [
  'service-list',
  'service-save',
  'application-list',
  'application-view',
  'application-draft',
  'application-publish',
  'application-suspend',
  'quota-list',
  'quota-save',
  'installation',
  'installation-advance',
  'installation-complete',
  'session',
  'challenge',
  'login',
  'certificate-challenge',
  'certificate-login',
  'state',
  'setup',
  'setup-advance',
  'setup-complete',
  'environment',
  'initialize',
  'logout'
];
export class ConsoleRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
export async function consoleRequest<K extends keyof ConsoleResponses>(
  path: K,
  csrf: string,
  body?: ConsoleCommands[K]
): Promise<ConsoleResponses[K]> {
  if (!endpoints.includes(path)) throw new Error('请求不受支持。');
  const response = await fetch('/console-api/' + path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new ConsoleRequestError(typeof data?.message === 'string' ? data.message : '请求未完成，请稍后手动重试。', response.status);
  return data;
}
