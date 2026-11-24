import { requestRaPfx, type PfxExportFields } from './cert';
import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaCertIssueQuery {
  pageNum: number;
  pageSize: number;
  businessType?: string;
  keyword?: string;
  userInfo?: string;
}

export interface RaCertIssue {
  businessType: string;
  businessTypeName: string;
  businessId: string | number;
  userId?: string | number;
  userName?: string;
  domainAccount?: string;
  deptId?: string | number;
  deptName?: string;
  rootId?: string | number;
  rootName?: string;
  profileId?: string | number;
  profileName?: string;
  profileConf?: string;
  encryptionProfileValidity?: string;
  issuerNotAfter?: string;
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
  keyAlgorithm?: 'RSA';
  keySize?: number;
  issueType?: 'csr' | 'usb_key' | 'file';
  csr?: string;
  subject?: string;
  notBefore?: string;
  notAfter?: string;
  startAtIssuance?: boolean;
  validityAmount?: number;
  validityUnit?: string;
  extensions?: string;
  fileFormat?: 'PKCS12';
  filePassword?: string;
  provider?: string;
  device?: string;
  application?: string;
  container?: string;
  originalPrivateKeyConfirmed?: boolean;
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
  storageType?: string;
  storageInfo?: string;
  encStorageType?: string;
  encStorageInfo?: string;
  renewalId?: string | number;
  encryptionPrivateKey?: string;
  certificateChain?: string;
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

export function downloadRaIssuedChain(certId: string | number) {
  return request({ url: `/ra/v1/cert-issues/${certId}/issued-download/p7b`, method: 'get', responseType: 'blob' });
}

export function packageRaIssuedPfx(certId: string | number, form: PfxExportFields, verifyOnly: boolean) {
  return requestRaPfx(`/ra/v1/cert-issues/${certId}/issued-download/pfx`, form, verifyOnly);
}

export function requestRaIssueNotification(certId: string | number): Promise<Result<void>> {
  return request({ url: `/ra/v1/cert-issues/notifications/${certId}`, method: 'post' }) as any;
}

export function executeRaCert(businessType: string, businessId: string | number): Promise<Result<RaCertIssueResult>> {
  return request({
    url: `/ra/v1/cert-issues/${businessType}/${businessId}/execute`,
    method: 'post'
  }) as any;
}

export function confirmRaRenewalDistribution(businessId: string | number, success: boolean, message?: string): Promise<Result<void>> {
  return request({
    url: `/ra/v1/cert-issues/cert_renewal/${businessId}/distribution`,
    method: 'post',
    data: { success, message }
  }) as any;
}
