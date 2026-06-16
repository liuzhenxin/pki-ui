import request from '@/utils/request';
import { Result } from '@/api/types';

export interface StatItem {
  name: string;
  value: number;
}

export interface TrendItem {
  date: string;
  value: number;
}

export interface UserStatisticsOverview {
  totalUserCount: number;
  activeUserCount: number;
  disabledUserCount: number;
  signedUserCertCount: number;
  totalApplyCount: number;
  periodApplyCount: number;
  pendingApplyCount: number;
  approvedApplyCount: number;
  rejectedApplyCount: number;
  totalOwnedCertCount: number;
}

export interface UserStatistics {
  overview: UserStatisticsOverview;
  applyStatusStats: StatItem[];
  deptStats: StatItem[];
  userCertStats: StatItem[];
  trendStats: TrendItem[];
}

export interface UserStatisticsQuery {
  startDate?: string;
  endDate?: string;
}

export function getRaUserStatistics(query: UserStatisticsQuery): Promise<Result<UserStatistics>> {
  return request({
    url: '/ra/v1/statistics/user/overview',
    method: 'get',
    params: query
  }) as any;
}
