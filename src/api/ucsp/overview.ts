import request from '@/utils/request';

export type OverviewRange = 'day' | 'week';

export interface OverviewBucket {
  from: string;
  total: number;
  succeeded: number;
  failed: number;
  rejected: number;
  pending: number;
}

export interface OverviewSnapshot {
  asOf: string;
  applications: { registered: number; enabled: number; granted: number };
  activeApplications: number;
  pools: { family: string; total: number; enabled: number; members: number }[];
  trend: OverviewBucket[];
  ranking: { applicationId: string; name: string | null; calls: number }[];
}

export const getOverview = async (range: OverviewRange): Promise<OverviewSnapshot> =>
  (await request({ url: '/ucsp/v1/overview', method: 'get', params: { range } })).data;
