import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaCertIssueQuery {
  pageNum: number;
  pageSize: number;
  businessType?: string;
  keyword?: string;
}

export interface RaCertIssue {
  businessType: string;
  businessTypeName: string;
  businessId: string | number;
  userId?: string | number;
  userName?: string;
  deptId?: string | number;
  deptName?: string;
  rootId?: string | number;
  rootName?: string;
  profileId?: string | number;
  profileName?: string;
  profileConf?: string;
  oldCertId?: string | number;
  serialNumber?: string;
  subject?: string;
  csr?: string;
  reason?: string;
  submitTime?: string;
  issueStatusName?: string;
  conf?: string;
}

export interface DualCertIssueInfo {
  certMode: 'single' | 'dual';
  signProfileId?: number;
  signProfileName?: string;
  encryptProfileId?: number;
  encryptProfileName?: string;
}

export interface RaCertIssueForm {
  issueType?: 'csr' | 'usb_key' | 'file';
  csr?: string;
  subject?: string;
  extensions?: string;
  fileFormat?: 'PKCS12';
  filePassword?: string;
}

export interface RaCertIssueResult {
  certId: string | number;
  serialNumber: string;
  subject: string;
  cert: string;
  fileFormat?: string;
  fileBase64?: string;
  fileName?: string;
  encCertId?: number;
  encSerialNumber?: string;
  encCert?: string;
}

export function pageRaCertIssue(query: RaCertIssueQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/cert-issues/page',
    method: 'post',
    data: query
  }) as any;
}

export function getRaCertIssue(businessType: string, businessId: string | number): Promise<Result<RaCertIssue>> {
  return request({
    url: `/ra/v1/cert-issues/${businessType}/${businessId}`,
    method: 'get'
  }) as any;
}

export function issueRaCert(businessType: string, businessId: string | number, data: RaCertIssueForm): Promise<Result<RaCertIssueResult>> {
  return request({
    url: `/ra/v1/cert-issues/${businessType}/${businessId}/issue`,
    method: 'post',
    data
  }) as any;
}
