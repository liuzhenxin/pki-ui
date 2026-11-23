import request from '@/utils/request';
import { Result } from '@/api/types';

export type RaConfigGroup = 'BASIC' | 'RA_IDENTITY' | 'NOTICE_AUDIT';

export interface RaConfigCO {
  group: RaConfigGroup;
  config?: string;
}

export interface RaConfigTestCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface RaConfigTestCO {
  passed: boolean;
  group: RaConfigGroup;
  checks: RaConfigTestCheck[];
}

export interface RaIdentityRotation {
  csrPem: string;
  subject: string;
  algorithm: 'RSA' | 'SM2';
}

const identityRotationUrl = '/ra/v1/config/identity/rotation';

export function getRaIdentityRotation(): Promise<Result<RaIdentityRotation | null>> {
  return request({ url: identityRotationUrl, method: 'get' }) as any;
}

export function generateRaIdentityRotation(data: { subject: string; replaceCsrPem?: string }): Promise<Result<RaIdentityRotation>> {
  return request({ url: `${identityRotationUrl}/csr`, method: 'post', data }) as any;
}

export function activateRaIdentityRotation(certPem: string): Promise<Result<void>> {
  return request({ url: `${identityRotationUrl}/certificate`, method: 'post', data: { certPem } }) as any;
}

export function getRaConfig(group: RaConfigGroup): Promise<Result<RaConfigCO>> {
  return request({
    url: `/ra/v1/config/${group}`,
    method: 'get'
  }) as any;
}

export function saveRaConfig(data: RaConfigCO): Promise<Result<void>> {
  return request({
    url: '/ra/v1/config',
    method: 'post',
    data
  }) as any;
}

export function testRaConfig(data: RaConfigCO): Promise<Result<RaConfigTestCO>> {
  return request({
    url: '/ra/v1/config/test',
    method: 'post',
    data
  }) as any;
}
