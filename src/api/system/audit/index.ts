import request from '@/utils/request';
import { AuditVerifyCmd, AuditVerifyRecordQuery } from './types';

/** 校验审计完整性 */
export function verifyAudit(data: AuditVerifyCmd) {
  return request({
    url: '/admin/v1/audit/verify',
    method: 'post',
    data: data
  });
}

/** 分页查询审计校验记录 */
export function pageVerifyRecord(query: AuditVerifyRecordQuery) {
  return request({
    url: '/admin/v1/audit/verify-records/page',
    method: 'post',
    data: query
  });
}
