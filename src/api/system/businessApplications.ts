import request from '@/utils/request';
export interface BusinessApplication {
  applicationId: string;
  productTenantId: number;
  name: string;
  ownerUserId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  version: string;
  credentialVersion: string;
}
export interface Credential {
  application: BusinessApplication;
  clientSecret: string | null;
}
const base = '/admin/v1/business-applications';
export const listBusinessApplications = () => request({ url: base, method: 'get' });
export const registerBusinessApplication = (data: { requestId: string; name: string; ownerUserId: string }) =>
  request({ url: base, method: 'post', data });
export const rotateBusinessApplication = (application: BusinessApplication) =>
  request({ url: `${base}/${application.applicationId}/rotate-secret`, method: 'post', data: { expectedVersion: application.version } });
export const suspendBusinessApplication = (application: BusinessApplication) =>
  request({ url: `${base}/${application.applicationId}/suspend`, method: 'post', data: { expectedVersion: application.version } });
