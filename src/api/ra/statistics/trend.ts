import request from '@/utils/request';
import { Result } from '@/api/types';

export interface TrendItem {
  date: string;
  value: number;
}

export interface TrendStatisticsOverview {
  periodCertIssueCount: number;
  periodApplyCount: number;
  periodRenewalCount: number;
  periodUpdateCount: number;
  periodRevokeCount: number;
  weekExpireCertCount: number;
  monthExpireCertCount: number;
}

export interface TrendStatistics {
  overview: TrendStatisticsOverview;
  certIssueTrend: TrendItem[];
  applyTrend: TrendItem[];
  renewalTrend: TrendItem[];
  updateTrend: TrendItem[];
  revokeTrend: TrendItem[];
  expireTrend: TrendItem[];
}

export interface TrendStatisticsQuery {
  startDate?: string;
  endDate?: string;
}

export function getRaTrendStatistics(query: TrendStatisticsQuery): Promise<Result<TrendStatistics>> {
  return request({
    url: '/ra/v1/statistics/trend/overview',
    method: 'get',
    params: query
  }) as any;
}
