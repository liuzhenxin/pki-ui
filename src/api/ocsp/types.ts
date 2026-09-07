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
  protocolPort?: string;
  keystorePath?: string;
}

export interface OcspProbe {
  ok: boolean;
  sourceType?: string;
  message?: string;
}
