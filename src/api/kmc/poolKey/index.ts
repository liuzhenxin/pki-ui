import request from '@/utils/request';

export const allocatePoolKey = (strategyId: string | number) => {
  return request({
    url: '/kmc/v1/pool-keys/allocate',
    method: 'post',
    params: { strategyId }
  });
};

export const allocatePoolKeyByType = (algType: string, keyUsage: string) => {
  return request({
    url: '/kmc/v1/pool-keys/allocate-by-type',
    method: 'post',
    params: { algType, keyUsage }
  });
};

export const releasePoolKey = (keyId: string | number) => {
  return request({
    url: `/kmc/v1/pool-keys/${keyId}/release`,
    method: 'delete'
  });
};

export const batchAllocatePoolKey = (strategyId: string | number, count: number) => {
  return request({
    url: '/kmc/v1/pool-keys/batch-allocate',
    method: 'post',
    params: { strategyId, count }
  });
};

