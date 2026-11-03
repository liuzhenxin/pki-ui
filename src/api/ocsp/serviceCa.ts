import request from '@/utils/request';
import { unwrapNullableOcspData, unwrapOcspData } from '@/api/ocsp/common';
import type { OcspStatusSource } from '@/api/ocsp/types';

export interface ServiceCaDraft {
  caId: string;
  version: number | string;
  verifiedVersion?: number | string | null;
  publishedVersion?: number | string | null;
  responderId?: string | null;
  issuerPem?: string | null;
  sourceType?: string | null;
  sourceCaId?: string | null;
  sampleSerialHex?: string | null;
  expectedStatus?: string | null;
  sourceConfigured: boolean;
  sampleConfigured: boolean;
}

export interface ServiceCaSave {
  caId?: string;
  expectedVersion: number;
  responderId?: string;
  issuerPem: string;
  source?: OcspStatusSource;
  sampleSerialHex?: string;
  expectedStatus?: 'GOOD' | 'REVOKED';
}

export const listServiceCaDrafts = () =>
  request({ url: '/ocsp/v1/service-ca-drafts', method: 'get' }).then((res) => unwrapOcspData<ServiceCaDraft[]>(res));

export const getServiceCaDraft = (caId: string) =>
  request({ url: `/ocsp/v1/service-ca-drafts/${caId}`, method: 'get' }).then((res) => unwrapNullableOcspData<ServiceCaDraft>(res));

export const saveServiceCaDraft = (data: ServiceCaSave) =>
  request({ url: '/ocsp/v1/service-ca-drafts', method: 'put', data }).then((res) => unwrapOcspData<ServiceCaDraft>(res));

export const validateServiceCaDraft = (caId: string, version: number) =>
  request({
    url: `/ocsp/v1/service-ca-drafts/${caId}/validate`,
    method: 'post',
    params: { version }
  }).then((res) => unwrapOcspData<ServiceCaDraft>(res));

export const publishServiceCaDraft = (caId: string, version: number) =>
  request({
    url: `/ocsp/v1/service-ca-drafts/${caId}/publish`,
    method: 'post',
    params: { version }
  }).then((res) => unwrapOcspData<ServiceCaDraft>(res));
