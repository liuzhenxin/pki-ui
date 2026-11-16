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
export interface ManagedDevice {
  deviceKey: string;
  poolKey: string;
  agentKey: string;
  softwareVersion: string;
  maxConcurrency: number;
  state: 'REGISTERED' | 'ACTIVE' | 'DRAINING' | 'SUSPENDED' | 'RETIRED';
  health: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
  version: string;
}
export interface ConsoleNavigation {
  initialized?: boolean;
  canInitialize?: boolean;
  canManageServices?: boolean;
  canManageDevices?: boolean;
  canOperateApplications?: boolean;
  canManageAuditors?: boolean;
  canReadLoginLogs?: boolean;
  canReadOperationLogs?: boolean;
}
export interface AuditPage {
  items: Record<string, string | number | null>[];
  total: number;
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
  accounts: { role: 'SYSTEM_ADMIN' | 'AUDIT_ADMIN'; valid: boolean }[];
}
export interface InstallationAccount {
  password: string;
  certPem?: string;
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
export interface OwnedApplication {
  applicationId: string;
  name: string;
  appKey: string;
  version: string;
  enabled: boolean;
}
export interface IssuedApplicationCredential {
  applicationId: string;
  appKey: string;
  appSecret: string;
  version: string;
}
export interface OwnedApplicationPolicy {
  grants: ServiceGrant[];
  maxRequests: number;
  windowSeconds: number;
}
export interface OwnedApplicationView {
  application: OwnedApplication;
  quota: Omit<OwnedApplicationPolicy, 'grants'> | null;
  activeGrants: ServiceGrant[];
}
interface OwnedTarget {
  applicationId: string;
  expectedVersion: string;
}

export interface ConsoleResponses {
  'owned-application-list': ManagementPage<OwnedApplication>;
  'owned-application-register': IssuedApplicationCredential;
  'owned-application-view': OwnedApplicationView;
  'owned-application-rename': OwnedApplicationView;
  'owned-application-save-policy': OwnedApplicationView;
  'owned-application-revoke': OwnedApplicationView;
  'owned-application-suspend': OwnedApplicationView;
  'owned-application-remove': { applicationId: string; version: string };
  'owned-application-rotate': IssuedApplicationCredential;
  'owned-service-list': ManagementPage<ServiceResource>;
  'owned-service-save': ServiceResource;
  'owned-quota-list': ManagementPage<SharedQuota>;
  'owned-quota-save': SharedQuota;
  'device-list': ManagementPage<ManagedDevice>;
  'device-save': ManagedDevice;
  'device-state': ManagedDevice;
  'service-list': ManagementPage<ServiceResource>;
  'service-save': ServiceResource;
  'application-list': ManagementPage<ApplicationSummary>;
  'application-view': ApplicationView;
  'application-draft': ApplicationView;
  'application-publish': ApplicationView;
  'application-suspend': ApplicationView;
  'quota-list': ManagementPage<SharedQuota>;
  'quota-save': SharedQuota;
  'auditor-list': AuditPage;
  'auditor-create': { saved: true };
  'auditor-status': { saved: true };
  'login-log-list': AuditPage;
  'operation-log-list': AuditPage;
  session: ConsoleNavigation & { authenticated: boolean };
  installation: InstallationView;
  'installation-advance': InstallationView;
  'installation-complete': InstallationView;
  setup: SetupView;
  'setup-advance': SetupView;
  'setup-complete': SetupView;
}
export interface ConsoleCommands {
  'owned-application-list': { offset: number };
  'owned-application-register': { name: string };
  'owned-application-view': { applicationId: string };
  'owned-application-rename': OwnedTarget & { name: string };
  'owned-application-save-policy': OwnedTarget & { policy: OwnedApplicationPolicy };
  'owned-application-revoke': OwnedTarget & { grant: ServiceGrant };
  'owned-application-suspend': OwnedTarget;
  'owned-application-remove': OwnedTarget;
  'owned-application-rotate': OwnedTarget;
  'owned-service-list': { offset: number; family?: ServiceFamily };
  'owned-service-save': Pick<ServiceResource, 'serviceId' | 'family' | 'poolKey' | 'adapterKey' | 'enabled'> & { expectedVersion: string };
  'owned-quota-list': { offset: number };
  'owned-quota-save': Omit<SharedQuota, 'version'> & { expectedVersion: string };
  'device-list': { offset: number };
  'device-save': Omit<ManagedDevice, 'state' | 'health' | 'version'> & { expectedVersion: string };
  'device-state': { deviceKey: string; expectedVersion: string; operation: 'SUSPEND' | 'RETIRE' };
  'service-list': { offset: number; family?: ServiceFamily };
  'service-save': Pick<ServiceResource, 'serviceId' | 'family' | 'poolKey' | 'adapterKey' | 'enabled'> & { expectedVersion: string };
  'application-list': { offset: number };
  'application-view': { applicationId: string };
  'application-draft': ApplicationPolicy & { applicationId: string; expectedVersion: string };
  'application-publish': { applicationId: string; expectedVersion: string };
  'application-suspend': { applicationId: string; expectedVersion: string };
  'quota-list': { offset: number };
  'quota-save': Omit<SharedQuota, 'version'> & { expectedVersion: string };
  'auditor-list': { page: number };
  'auditor-create': { username: string; password: string };
  'auditor-status': { id: string; status: 0 | 1 };
  'login-log-list': { page: number };
  'operation-log-list': { page: number };
  session: undefined;
  installation: undefined;
  'installation-advance': { draftVersion: number; action: InstallationAction; agreementVersion?: string };
  'installation-complete': { draftVersion: number; confirm: true; admin: InstallationAccount; auditor: InstallationAccount };
  setup: undefined;
  'setup-advance': { draftVersion: number; action: SetupAction };
  'setup-complete': { draftVersion: number; confirm: true };
}
