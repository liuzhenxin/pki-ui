import request from '@/utils/request';
import type { Result } from '@/api/types';

export interface ReviewReportingPreferences {
  collectorConfigured: boolean;
  publicAvailable: boolean;
  standard: boolean;
  publicLedger: boolean;
}

const url = '/ra/v1/review-reporting';

export const getReviewReporting = (): Promise<Result<ReviewReportingPreferences>> =>
  request({ url, method: 'get' });

export const saveReviewReporting = (standard: boolean, publicLedger: boolean): Promise<Result<ReviewReportingPreferences>> =>
  request({ url, method: 'put', data: { standard, publicLedger } });
