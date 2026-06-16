import request from '@/utils/request';
import { Result } from '@/api/types';

export interface CaConfigCO {
  id?: string | number;
  type: string;
  config?: string;
}

export interface CaConfigTestCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface CaConfigTestCO {
  passed: boolean;
  type: string;
  checks: CaConfigTestCheck[];
}

export function getCaConfig(type: string): Promise<Result<CaConfigCO>> {
  return request({
    url: `/ca/v1/config/${type}`,
    method: 'get'
  }) as any;
}

export function saveCaConfig(data: CaConfigCO): Promise<Result<void>> {
  return request({
    url: '/ca/v1/config',
    method: 'post',
    data
  }) as any;
}

export function testCaConfig(data: CaConfigCO): Promise<Result<CaConfigTestCO>> {
  return request({
    url: '/ca/v1/config/test',
    method: 'post',
    data
  }) as any;
}
