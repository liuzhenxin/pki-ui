import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type { OcspDashboardSummary } from '@/api/ocsp/types';

export const getOcspDashboardSummary = (range = '24h') => {
  return request({
    url: '/ocsp/v1/dashboard/summary',
    method: 'get',
    params: { range }
  }).then((res) => unwrapOcspData<OcspDashboardSummary>(res));
};
