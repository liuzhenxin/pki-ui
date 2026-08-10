export interface OpsContainer {
  name: string;
  containerId: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  running: boolean;
  present: boolean;
}

export interface OpsContainerLogs {
  serverCode: string;
  serverName: string;
  containerName: string;
  tail: number;
  collectedAt: string;
  lines: string[];
}

export interface OpsComponent {
  name: string;
  displayName: string;
  layer: string;
  dependencies: string[];
  container?: OpsContainer;
}

export interface OpsLayer {
  code: string;
  name: string;
  order: number;
  components: OpsComponent[];
}

export interface OpsOverview {
  collectedAt: string;
  layers: OpsLayer[];
}

export interface OpsServer {
  code: string;
  name: string;
  host: string;
  role: string;
  status: string;
  online: boolean;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  loadAverage?: number;
  logicalProcessorCount?: number;
  lastHeartbeatAt?: string;
  runningContainerCount: number;
  components: OpsComponent[];
  containers: OpsContainer[];
}

export interface OpsSummary {
  serverCount: number;
  onlineServerCount: number;
  containerCount: number;
  runningContainerCount: number;
  componentCount: number;
  runningComponentCount: number;
  abnormalComponentCount: number;
}

export type CryptoMonitorState = 'UNKNOWN' | 'SUSPECTED' | 'UP' | 'DOWN' | 'RECOVERING';

export interface CryptoMonitorInstance {
  instanceId: string;
  baseUrl: string;
  state: CryptoMonitorState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  firstFailureAt?: string;
  lastCheckedAt?: string;
  lastAlertAt?: string;
  liveHttpStatus?: number;
  readyHttpStatus?: number;
  liveStatus?: string;
  readyStatus?: string;
  readyLatencyMs?: number;
  message?: string;
}

export interface RadiusServerConfig {
  host: string;
  port: number;
  secret?: string;
  secretMask?: string;
  configured?: boolean;
}

export interface RadiusConfig {
  enabled: boolean;
  scopes: Array<'ALL' | 'CA' | 'KMC' | 'RA'>;
  primary: RadiusServerConfig;
  secondary?: RadiusServerConfig;
  nasIdentifier: string;
  authMethod: 'PAP' | 'CHAP';
  timeoutMillis: number;
  retries: number;
  rescueUsername?: string;
  rescueNetworks: string[];
  tested?: boolean;
  lastTestTime?: string;
}

export interface RadiusStatus {
  enabled: boolean;
  authMethod: 'PAP' | 'CHAP';
}

export interface RadiusTestRequest {
  config: RadiusConfig;
  username: string;
  password: string;
}

export type SyslogProtocol = 'UDP' | 'TCP' | 'TLS';

export interface SyslogServerConfig {
  host: string;
  port: number;
  protocol: SyslogProtocol;
}

export interface SyslogConfig {
  enabled: boolean;
  serviceScopes: string[];
  eventTypes: string[];
  primary: SyslogServerConfig;
  secondary?: SyslogServerConfig;
  format: 'RFC5424';
  facility: string;
  minimumSeverity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  appNamePrefix: string;
  tlsServerName?: string;
  trustSecretRef?: string;
  clientCertSecretRef?: string;
  clientKeySecretRef?: string;
  connectTimeoutMillis: number;
  writeTimeoutMillis: number;
  retries: number;
  maxMessageBytes: number;
  tested?: boolean;
  lastTestTime?: string;
}

export interface SyslogStatus {
  enabled: boolean;
  sentCount: number;
  failedCount: number;
  lastSuccessTime?: string;
  lastFailureTime?: string;
  lastError?: string;
}

export interface BusinessServiceItem {
  code: string;
  name: string;
  layerCode: string;
  layerName: string;
  layerOrder: number;
  componentOrder: number;
  containerMatchRule?: string;
  description?: string;
  enabled: boolean;
  dependencies: string[];
}

export interface BusinessServiceConfig {
  services: BusinessServiceItem[];
}
