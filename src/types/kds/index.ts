/** KDS 管理后台类型定义；字段严格限制为 Phase 9–11 的元数据白名单。 */

export type KdsRole = 'ADMIN' | 'KEY_ADMIN' | 'AUDITOR';

export interface KdsNodeView {
  instanceId: string;
  lastSeen: string;
  stale: boolean;
  version: string;
  role: string;
}

export interface OpsStatus {
  instanceId: string;
  dependencies: Record<string, string>;
  maintenance: boolean;
  destroyed: boolean;
  nodes: KdsNodeView[];
}

export interface AlertSettings {
  enabled: boolean;
  webhookHost: string;
  webhookMasked: string;
  timeout: string;
  throttle: string;
  monitorInterval: string;
}

export interface AlertEventView {
  occurredAt: string;
  severity: string;
  source: string;
  code: string;
  message: string;
}

export interface AlertTestResult {
  delivered: boolean;
  code: string;
  message: string;
}

export interface DestructionStep {
  name: string;
  completed: boolean;
  elapsedMillis: number;
}

export interface DestructionStatus {
  taskId?: string;
  completed: boolean;
  steps: DestructionStep[];
  state: string;
  auditId?: string;
}

export interface EvidenceSummary {
  evidenceId: string;
  type: string;
  reference: string;
  sha256: string;
  occurredAt: string;
  operator: string;
  environment?: string;
  note?: string;
}

export interface DeviceView {
  deviceSn: string;
  deviceType: string;
  role: string;
  status: string;
  notBefore: string;
  notAfter: string;
}

export interface DeviceList {
  items: DeviceView[];
  total: number;
  page: number;
  size: number;
}

export interface DeviceDetail {
  deviceSn: string;
  role: string;
  status: string;
  certificateSha256?: string;
  notBefore: string;
  notAfter: string;
  sBoxVersion?: string;
  channels: Record<string, string>;
  dependencies: Record<string, string>;
  pending: string[];
}

export interface KeySnapshot {
  channels: Record<string, string>;
  stateCounts: Record<string, number>;
  pending: Array<{ keyId: string; version: string; channelName?: string }>;
}

export interface ChannelStatus {
  channels: Record<string, string>;
  previous: Record<string, string>;
}

export interface ChannelRollbackResult {
  deviceSn: string;
  channelName: string;
  previousVersion: string;
  state: string;
}

export interface SBoxVersionView {
  version: string;
  state: string;
  effectiveTime?: string;
  previousVersion?: string;
  rollbackSupported: boolean;
  checksumSha256?: string;
}

export interface SBoxHistory {
  versions: SBoxVersionView[];
}

export interface SBoxActivateResult {
  deviceSn: string;
  version: string;
  activated: boolean;
  state: string;
}

export interface RestoreCreateResult {
  recoveryId: string;
  status: string;
}

export interface RestoreStatus {
  taskId: string;
  state: string;
  stage: string;
  progress: number;
  maintenance: boolean;
  rolledBack: boolean;
  message?: string;
}
