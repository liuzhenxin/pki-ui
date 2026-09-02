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
