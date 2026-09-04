import axios from 'axios';
import { PublicCert, PublicCertAttachment, PublicCertDetail, PublicCertQuery, PublicCertType, SelfAccess } from '@/api/ra/publicCert';

const portalClient = axios.create({
  // Employee portal calls bypass the gateway's RA-token filter. Nginx forwards
  // this same-origin path only to the RA portal endpoints.
  baseURL: '/ra-public-cert-api',
  timeout: 50000,
  headers: {
    clientid: import.meta.env.VITE_APP_CLIENT_ID
  }
});

const portalHeaders = (token?: string) =>
  token
    ? {
        'X-FAW-VW-Portal-Token': token
      }
    : undefined;

function unwrap<T>(response: any): T {
  const body = response?.data ?? response;
  const code = body?.code === 'OK' || body?.code === undefined ? 200 : Number(body.code);
  if (code !== 200) {
    throw new Error(body?.msg || '请求失败');
  }
  return (body?.data ?? body) as T;
}

const cleanQuery = (query: PublicCertQuery) => ({
  ...query,
  domainName: query.domainName || undefined,
  serialNumber: query.serialNumber || undefined,
  certTypeName: query.certTypeName || undefined,
  systemName: query.systemName || undefined,
  ownerKeyword: query.ownerKeyword || undefined,
  approvalStatus: query.approvalStatus || undefined,
  certStatus: query.certStatus || undefined,
  ownerChangeRequired: query.ownerChangeRequired === null ? undefined : query.ownerChangeRequired,
  notAfterStart: query.notAfterStart || undefined,
  notAfterEnd: query.notAfterEnd || undefined,
  pageNum: Number(query.pageNum || 1),
  pageSize: Number(query.pageSize || 10)
});

export interface PortalLoginResult {
  token: string;
  access: SelfAccess;
}

export const loginPublicCertPortal = async (domainAccount: string): Promise<PortalLoginResult> =>
  unwrap(await portalClient.post('/ra/v1/public-certs/portal/login', { domainAccount }));

export const logoutPublicCertPortal = async (token: string) =>
  unwrap<void>(await portalClient.post('/ra/v1/public-certs/portal/logout', null, { headers: portalHeaders(token) }));

export const getPublicCertPortalAccess = async (token: string): Promise<SelfAccess> =>
  unwrap(await portalClient.get('/ra/v1/public-certs/portal/access', { headers: portalHeaders(token) }));

export const pagePublicCertPortal = async (token: string, query: PublicCertQuery): Promise<any> =>
  unwrap(await portalClient.post('/ra/v1/public-certs/portal/page', cleanQuery(query), { headers: portalHeaders(token) }));

export const listPublicCertPortalTypes = async (token: string): Promise<PublicCertType[]> =>
  unwrap(await portalClient.get('/ra/v1/public-certs/portal/types', { headers: portalHeaders(token) }));

export const getPublicCertPortal = async (token: string, id: number | string): Promise<PublicCertDetail> =>
  unwrap(await portalClient.get(`/ra/v1/public-certs/portal/${id}`, { headers: portalHeaders(token) }));

export const savePublicCertPortal = async (token: string, data: PublicCert): Promise<PublicCertDetail> =>
  unwrap(await portalClient.post('/ra/v1/public-certs/portal', data, { headers: portalHeaders(token) }));

export const submitPublicCertPortal = async (token: string, id: number | string): Promise<PublicCert> =>
  unwrap(await portalClient.post(`/ra/v1/public-certs/portal/${id}/submit`, null, { headers: portalHeaders(token) }));

export const uploadPublicCertPortalAttachment = async (token: string, id: number | string, file: File): Promise<PublicCertAttachment> => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(await portalClient.post(`/ra/v1/public-certs/portal/${id}/attachments`, form, { headers: portalHeaders(token) }));
};
