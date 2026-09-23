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

export interface CertStatisticsOverview {
  totalCertCount: number;
  validCertCount: number;
  revokedCertCount: number;
  expiredCertCount: number;
  pendingCertCount: number;
  newCertCount: number;
  renewedCertCount: number;
  updatedCertCount: number;
  todayExpireCertCount: number;
  weekExpireCertCount: number;
  monthExpireCertCount: number;
}

export interface CertStatistics {
  overview: CertStatisticsOverview;
  statusStats: StatItem[];
  rootStats: StatItem[];
  profileStats: StatItem[];
  trendStats: TrendItem[];
}

export interface CertStatisticsQuery {
  startDate?: string;
  endDate?: string;
}

export function getRaCertStatistics(query: CertStatisticsQuery): Promise<Result<CertStatistics>> {
  return request({
    url: '/ra/v1/statistics/cert/overview',
    method: 'get',
    params: query
  }) as any;
}
