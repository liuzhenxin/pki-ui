import request from '@/utils/request';
import { Result } from '@/api/types';

export interface CaConfigCO {
  id?: string | number;
  type: string;
  config?: string;
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
