/** 审计日志类型 */
export type AuditLogType = 'LOGIN' | 'OPERATE';

/** 审计完整性校验命令 */
export interface AuditVerifyCmd {
  logType: AuditLogType;
  tenantId: string | number;
}

/** 审计完整性校验结果 */
export interface AuditVerifyResult {
  logType?: string;
  tenantId?: string | number;
  checkedCount?: number;
  brokenCount?: number;
  valid?: boolean;
  firstBrokenId?: number;
  firstBrokenExpectedHash?: string;
  firstBrokenActualHash?: string;
}

/** 审计完整性校验记录 */
export interface AuditVerifyRecord {
  id?: string | number;
  logType?: string;
  tenantId?: string | number;
  checkedCount?: number;
  brokenCount?: number;
  valid?: number;
  firstBrokenId?: number;
  firstBrokenExpectedHash?: string;
  firstBrokenActualHash?: string;
  createTime?: string;
}

/** 审计校验记录分页查询对象 */
export interface AuditVerifyRecordQuery extends PageQuery {
  logType?: AuditLogType;
  tenantId?: string | number;
  valid?: number;
}
