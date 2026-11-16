import request from '@/utils/request';
import { Result } from '@/api/types';

export interface OcspDbStatusSource {
  url: string;
  username: string;
  passwordRef: string;
  certTable?: string;
  serialNumberColumn?: string;
  caIdColumn?: string;
  statusColumn?: string;
  revocationTimeColumn?: string;
  revocationReasonColumn?: string;
}

export interface OcspLdapStatusSource {
  url: string;
  baseDn: string;
  bindDn: string;
  passwordRef: string;
  searchFilter: string;
  serialNumberAttribute?: string;
  caIdAttribute?: string;
  statusAttribute?: string;
  revocationTimeAttribute?: string;
  revocationReasonAttribute?: string;
  connectTimeout?: number;
  readTimeout?: number;
}

export interface OcspInitResponderPayload {
  name: string;
  caId: number | string;
  signerCert: string;
  signerType: 'HSM' | 'SOFTWARE';
  signerConf: string;
  responseValidity: number;
  includeCerts: boolean;
  nonceEnabled: boolean;
  statusSource: {
    type: 'DB' | 'LDAP';
    db?: OcspDbStatusSource;
    ldap?: OcspLdapStatusSource;
  };
}

export function getOcspEnvInfo(): Promise<Result<any>> {
  return request({
    url: '/ocsp/v1/init/env',
    method: 'get'
  });
}

export interface OcspInitStatus {
  initialized: boolean;
  tenantStatus: -1 | 0 | 1 | null;
}

export function getOcspInitStatus(): Promise<Result<OcspInitStatus>> {
  return request({ url: '/ocsp/v1/init/status', method: 'get' });
}

export function confirmOcspAgreement(): Promise<Result<OcspInitStatus>> {
  return request({ url: '/ocsp/v1/init/agreement', method: 'post', data: { accepted: true } });
}

export function completeOcspInitialization(): Promise<Result<OcspInitStatus>> {
  return request({ url: '/ocsp/v1/init/complete', method: 'post' });
}

export function initOcspResponder(data: OcspInitResponderPayload): Promise<Result<any>> {
  return request({
    url: '/ocsp/v1/init/responder',
    method: 'post',
    data
  });
}
