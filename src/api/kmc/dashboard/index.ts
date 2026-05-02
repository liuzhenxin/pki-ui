import request from '@/utils/request';

export const getKmcDashboardStats = () => {
  return request({
    url: '/kmc/v1/dashboard/stats',
    method: 'get'
  });
};

