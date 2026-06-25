export interface PublisherQuery {
  pageNum?: number;
  pageSize?: number;
  name?: string;
  type?: string;
  createTime?: [string, string];
}

export interface PublisherForm {
  id?: string | number;
  name?: string;
  type?: string;
  conf?: string;
}

export interface PublisherCO {
  id: string | number;
  name: string;
  type?: string;
  conf?: string;
  createTime?: string;
  updateTime?: string;
}

/** 证书发布命令 */
export interface CertPublishForm {
  certId: number;
  publisherId?: number;
  rootId?: number;
}

/** 发布队列查询 */
export interface PublishQueueQuery {
  pageNum?: number;
  pageSize?: number;
  rootId?: number;
  certId?: number;
  publisherId?: number;
  status?: string;
}

/** 发布队列 CO */
export interface PublishQueueCO {
  id: number;
  rootId: number;
  certId: number;
  certType?: string;
  publisherId: number;
  status: string;
  retryCount: number;
  errorMessage?: string;
  nextRetryTime?: string;
  lastAttemptTime?: string;
}

/** 发布者类型配置模板 */
export const PUBLISHER_CONF_TEMPLATES: Record<string, string> = {
  LDAP: JSON.stringify({
    url: 'ldap://ad.example.com:389',
    baseDn: 'dc=example,dc=com',
    bindDn: 'cn=admin,dc=example,dc=com',
    password: '',
    useSsl: false,
    useTls: true,
    certAttribute: 'userCertificate;binary',
    searchBase: 'ou=Users,dc=example,dc=com',
    searchFilter: '(cn={subjectCn})'
  }, null, 2),
  DATABASE: JSON.stringify({
    url: 'jdbc:mysql://db.example.com:3306/certstore',
    driverClass: 'com.mysql.cj.jdbc.Driver',
    username: 'certuser',
    password: '',
    tableName: 'cert_records',
    certColumn: 'cert_pem',
    serialColumn: 'serial_number',
    subjectColumn: 'subject_dn',
    issueTimeColumn: 'issue_time',
    expireTimeColumn: 'expire_time',
    upsertEnabled: true
  }, null, 2),
  FILE: JSON.stringify({
    path: '/data/certs/published',
    filenamePattern: '{serialNumber}.pem',
    createDirs: true
  }, null, 2),
  OCSP: JSON.stringify({
    url: 'http://ocsp.example.com/responder',
    timeout: 5000
  }, null, 2)
};
