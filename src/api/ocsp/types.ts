export interface OcspAdminPage<T> {
  records: T[];
  total: number;
}

export interface OcspResponder {
  id?: number;
  name: string;
  caId: number;
  signerCert?: string;
  signerType: 'HSM' | 'SOFTWARE' | string;
  signerConf?: string;
  status?: string;
  responseValidity?: number;
  includeCerts?: boolean;
  nonceEnabled?: boolean;
  protocolExtensionPolicy?: {
    archiveCutoffEnabled?: boolean;
    archiveCutoff?: string;
    crlReferenceEnabled?: boolean;
    crlUrl?: string;
    crlNumber?: string;
    preferredSignatureEnabled?: boolean;
  };
  updateTime?: string;
}

export interface OcspResponderCsr {
  name?: string;
  csrPending?: boolean;
  csrPem?: string;
  subject?: string;
  algorithm?: string;
  alias?: string;
  status?: string;
}

export interface OcspResponderCsrCmd {
  name: string;
  commonName: string;
  organization?: string;
  country?: string;
  alias?: string;
}

export interface OcspResponderCertImportCmd {
  name: string;
  certificatePem: string;
  certificateChainPem?: string;
}

export interface OcspResponderPageQry {
  pageNum?: number;
  pageSize?: number;
  name?: string;
  status?: string;
}

export interface OcspDashboardSummary {
  range: string;
  requestCount: number;
  successCount: number;
  unknownCount: number;
  activeResponderCount: number;
  series: Array<{ hour: string; success: number; malformed: number; other: number }>;
  statusPie: Record<string, number>;
  responders: OcspResponder[];
}

export interface OcspCertStatus {
  serialNumber: string;
  caId: number;
  status: string;
  notBefore?: string;
  notAfter?: string;
  isRevoked?: boolean;
  revocationTime?: string;
  revocationReason?: number;
  cacheHit: boolean;
  sourceType?: string;
}

export interface OcspRequestLog {
  id: number;
  requestId?: string;
  responderId?: number;
  caId?: number;
  certSerialNumber?: string;
  certStatus?: string;
  revocationTime?: string;
  revocationReason?: number;
  requestTime?: string;
  responseTime?: string;
  responseStatus?: string;
  clientIp?: string;
  userAgent?: string;
  hasNonce?: boolean;
}

export interface OcspRequestLogPageQry {
  pageNum?: number;
  pageSize?: number;
  requestTimeFrom?: string;
  requestTimeTo?: string;
  responderId?: number;
  caId?: number;
  certSerialNumber?: string;
  certStatus?: string;
  responseStatus?: string;
  clientIp?: string;
  hasNonce?: boolean | null;
}

export interface OcspStatusSource {
  type: 'DB' | 'LDAP' | string;
  /** 按 CA 配置时必填（CA 与数据源 1:1）；为空表示平台默认数据源 */
  caId?: number;
  name?: string;
  enabled?: boolean;
  db?: {
    url?: string;
    username?: string;
    passwordRef?: string;
    certTable?: string;
    /** 归档证书表（吊销后移入，如 ca_archive_cert）；空表示不查归档表 */
    archiveCertTable?: string;
    serialNumberColumn?: string;
    caIdColumn?: string;
    statusColumn?: string;
    isRevokedColumn?: string;
    revocationTimeColumn?: string;
    revocationReasonColumn?: string;
    notBeforeColumn?: string;
    notAfterColumn?: string;
    /** 空表示不按删除标识过滤 */
    delFlagColumn?: string;
  };
  ldap?: {
    url?: string;
    baseDn?: string;
    bindDn?: string;
    passwordRef?: string;
    searchFilter?: string;
    serialNumberAttribute?: string;
    caIdAttribute?: string;
    statusAttribute?: string;
    revocationTimeAttribute?: string;
    revocationReasonAttribute?: string;
    connectTimeout?: number;
    readTimeout?: number;
  };
}

export interface OcspRuntimeConfig {
  cacheEnabled?: boolean;
  ttlSeconds?: number;
  responderTtlSeconds?: number;
  maximumSize?: number;
  responseCacheEnabled?: boolean;
  responseCacheTtlSeconds?: number;
  responseCacheMaximumSize?: number;
  protocolPort?: string;
  keystorePath?: string;
}

export interface OcspProbe {
  ok: boolean;
  sourceType?: string;
  message?: string;
}

export interface OcspRoutingPreviewCmd {
  caId: number;
  issuerHashAlgorithm?: 'SHA1' | 'SHA256';
  issuerNameHash?: string;
  issuerKeyHash?: string;
  clientIp?: string;
}

export interface OcspRoutingPreview {
  caId: number;
  authorityMode?: string;
  candidateId?: number;
  candidateVersion?: number;
  candidateSourceVersion?: number;
  sourceType?: string;
  sourceRevision?: string;
  sourcePublished?: boolean;
  sourceEnabled?: boolean;
  sourceValidationOk?: boolean;
  sourceFailureCode?: string;
  responderId?: number;
  responderName?: string;
  responderStatus?: string;
  algorithm?: string;
  provider?: string;
  selfTestOk?: boolean;
  rejectionCode?: string;
  safeMessage?: string;
  wouldActivate: boolean;
}

export interface OcspConfigHistory {
  id: number;
  targetType?: string;
  targetKey?: string;
  action?: string;
  revision: number;
  beforeJson?: string;
  afterJson?: string;
  validationEvidence?: string;
  reason?: string;
  actorUserId?: number;
  createTime?: string;
  rollbackOf?: number;
  rolledBackBy?: number[];
}

export interface OcspConfigHistoryQry {
  pageNum?: number;
  pageSize?: number;
  targetType?: string;
  targetKey?: string;
  action?: string;
  createTimeFrom?: string;
  createTimeTo?: string;
}

export interface OcspCanaryScope {
  percent?: number;
  type?: string;
  value?: string;
}

export interface OcspCanaryCandidate {
  id: number;
  version: number;
  caId: number;
  responderId?: number;
  candidateVersion?: number;
  canaryEnabled?: boolean;
  canaryScope?: OcspCanaryScope;
  healthStatus?: string;
  validationEvidence?: string;
  reason?: string;
  source?: OcspStatusSource;
  updateTime?: string;
}

export interface OcspMonitoringSummary {
  openAlertCount: number;
  worstSeverity?: string;
  sourceAlertCount: number;
  signerAlertCount: number;
  sloAlertCount: number;
  syntheticAlertCount: number;
}

export interface OcspAlert {
  id: number;
  componentType?: string;
  componentKey?: string;
  code?: string;
  severity?: string;
  status?: string;
  safeMessage?: string;
  evidence?: string;
  occurrenceCount?: number;
  firstSeenTime?: string;
  lastSeenTime?: string;
  clearedTime?: string;
  updateTime?: string;
}

export interface OcspRetentionStatus {
  enabled?: boolean;
  retentionDays?: number;
  batchSize?: number;
  totalRows?: number;
  expiredRows?: number;
  oldestRequestTime?: string;
}

export interface OcspRetentionResult {
  deletedTotal?: number;
  batches?: number;
  lockAcquired?: boolean;
  startedAt?: string;
  finishedAt?: string;
}

export interface OcspResponseCacheStatus {
  enabled?: boolean;
  ttlSeconds?: number;
  maximumSize?: number;
  hits?: number;
  misses?: number;
  bypasses?: number;
  invalidations?: number;
  size?: number;
}
