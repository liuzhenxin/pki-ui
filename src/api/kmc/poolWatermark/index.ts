import request from '@/utils/request';

export const getPoolWatermarkStatus = () => {
  return request({
    url: '/kmc/v1/pool-watermark/status',
    method: 'get'
  });
};

export const checkAndReplenishPools = () => {
  return request({
    url: '/kmc/v1/pool-watermark/check-and-replenish',
    method: 'post'
  });
};

export const checkAndReplenishPool = (strategyId: string | number) => {
  return request({
    url: `/kmc/v1/pool-watermark/check-and-replenish/${strategyId}`,
    method: 'post'
  });
};

export const generatePoolKeys = (strategyId: string | number) => {
  return request({
    url: `/kmc/v1/pool-watermark/generate/${strategyId}`,
    method: 'post'
  });
};

