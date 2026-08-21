import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaProfileQuery {
  name?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface RaProfileCO {
  id: number;
  name: string;
  type?: string;
  approvalMode: 'required' | 'optional';
  approvalModeName?: string;
  updateTime?: string;
  rootNames?: string;
}

export function pageRaProfile(query: RaProfileQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/profiles/page',
    method: 'post',
    data: query
  }) as any;
}

export function getRaProfile(id: string | number): Promise<Result<RaProfileCO>> {
  return request({
    url: `/ra/v1/profiles/${id}`,
    method: 'get'
  }) as any;
}

export function saveRaProfileApprovalMode(id: string | number, approvalMode: 'required' | 'optional'): Promise<Result<void>> {
  return request({
    url: `/ra/v1/profiles/${id}/approval-mode`,
    method: 'post',
    data: { approvalMode }
  }) as any;
}
