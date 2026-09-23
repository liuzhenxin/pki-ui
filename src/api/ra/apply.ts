import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaApplyQuery {
  pageNum: number;
  pageSize: number;
  userName?: string;
  status?: number | string;
  startTime?: string;
  endTime?: string;
}

export interface RaApplyForm {
  userId?: string | number;
  userName?: string;
  deptName?: string;
  userCategory?: string;
  rootId?: string | number;
  rootName?: string;
  rootAlgorithm?: string;
  certMode?: 'single' | 'dual';
  profileId?: string | number;
  profileName?: string;
  dualProfileIndex?: number;
  signProfileId?: string | number;
  signProfileName?: string;
  encryptProfileId?: string | number;
  encryptProfileName?: string;
  requestSubject?: string;
}

export interface RaApplyVO {
  id: string | number;
  userId: string | number;
  userName: string;
  deptId?: string | number;
  deptName?: string;
  userCategory?: string;
  rootId?: string | number;
  rootName?: string;
  rootAlgorithm?: string;
  certMode?: 'single' | 'dual';
  profileId?: string | number;
  profileName?: string;
  signProfileId?: string | number;
  signProfileName?: string;
  encryptProfileId?: string | number;
  encryptProfileName?: string;
  status: number;
  statusName: string;
  requestSubject?: string;
  createTime?: string;
}

export function pageRaApply(query: RaApplyQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/applies/page',
    method: 'post',
    data: {
      ...query,
      status: query.status === '' ? undefined : query.status
    }
  }) as any;
}

export function getRaApply(id: string | number): Promise<Result<RaApplyVO>> {
  return request({
    url: `/ra/v1/applies/${id}`,
    method: 'get'
  }) as any;
}

export function saveRaApply(data: RaApplyForm): Promise<Result<void>> {
  return request({
    url: '/ra/v1/applies',
    method: 'post',
    data
  }) as any;
}
