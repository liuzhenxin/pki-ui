import request from '@/utils/request';
import { Result } from '@/api/types';

export type RaCertificateValidityStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NOT_YET_VALID' | 'PARSE_ERROR';

export interface RaCertificateInfo {
  id?: string | number;
  certificateName: string;
  issuer: string;
  subjectDn?: string;
  issuerDn?: string;
  notBefore?: string;
  notAfter?: string;
  serialNumber?: string;
  fingerprint?: string;
  pem?: string;
  remainingDays?: number;
  validityStatus: RaCertificateValidityStatus;
}

export interface RaRootCertificate extends RaCertificateInfo {
  name: string;
  caStatus?: string;
  cert?: string;
  certchain?: string;
  intermediateCount: number;
  intermediates?: RaCertificateInfo[];
  profiles?: any[];
  profileNames?: string[];
  profileCount?: number;
  parseError?: string;
}

export interface RaIntermediateCertificate extends RaCertificateInfo {
  rootId: string | number;
  rootCertificateName: string;
  rootManagementName?: string;
}

export interface RaCertificatePage<T> {
  records: T[];
  rows: T[];
  total: number;
}

export interface RaRootImportPreview {
  root: RaCertificateInfo;
  intermediates: RaCertificateInfo[];
  intermediateCount: number;
  warnings: string[];
  importable: boolean;
  id?: string | number;
  managementName?: string;
}

export function listRaRootCa(query: any): Promise<Result<RaCertificatePage<RaRootCertificate>>> {
  return request({
    url: '/ra/v1/roots/page',
    method: 'post',
    data: query
  });
}

export function listRaIntermediateCertificates(query: any): Promise<Result<RaCertificatePage<RaIntermediateCertificate>>> {
  return request({
    url: '/ra/v1/roots/intermediates/page',
    method: 'post',
    data: query
  });
}

export function getRaRootCa(id: string | number): Promise<Result<RaRootCertificate>> {
  return request({
    url: `/ra/v1/roots/${id}`,
    method: 'get'
  });
}

function rootImportRequest(url: string, formData: FormData): Promise<Result<RaRootImportPreview>> {
  return request({
    url,
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

export function previewRaRootImport(formData: FormData): Promise<Result<RaRootImportPreview>> {
  return rootImportRequest('/ra/v1/roots/import/preview', formData);
}

export function importRaRootCertificate(formData: FormData): Promise<Result<RaRootImportPreview>> {
  return rootImportRequest('/ra/v1/roots/import', formData);
}

export interface RaAuthorizedCaSyncRequest {
  caAddress: string;
}

export interface RaCaAddressConfig {
  caAddress: string;
}

export interface RaAuthorizedCaSyncRoot {
  id: string | number;
  name: string;
  profileCount: number;
  profileNames: string[];
}

export interface RaAuthorizedCaSyncResult {
  rootCount: number;
  profileCount: number;
  relationCount: number;
  profileNames: string[];
  roots?: RaAuthorizedCaSyncRoot[];
}

export function syncAuthorizedCa(data: RaAuthorizedCaSyncRequest): Promise<Result<RaAuthorizedCaSyncResult>> {
  return request({
    url: '/ra/v1/init/sync-ca',
    method: 'post',
    data
  });
}

export function getConfiguredCaAddress(): Promise<Result<RaCaAddressConfig>> {
  return request({
    url: '/ra/v1/init/ca-address',
    method: 'get'
  });
}
