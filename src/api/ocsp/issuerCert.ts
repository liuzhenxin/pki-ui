import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';

export interface OcspIssuerCert {
  id: string | number;
  caId: string | number;
  subjectDn?: string;
  hashAlgorithm?: string;
  fingerprint?: string;
  enabled?: boolean;
}

export const listOcspIssuerCerts = (caId: string) =>
  request({ url: '/ocsp/v1/issuer-certs', method: 'get', params: { caId } }).then((res) => unwrapOcspData<OcspIssuerCert[]>(res));

export const saveOcspIssuerCert = (caId: string, certificatePem: string) =>
  request({ url: '/ocsp/v1/issuer-certs', method: 'post', data: { caId, certificatePem } }).then((res) => unwrapOcspData<OcspIssuerCert[]>(res));

export const removeOcspIssuerCert = (id: string) =>
  request({ url: `/ocsp/v1/issuer-certs/${id}`, method: 'delete' }).then((res) => unwrapOcspData<boolean>(res));
