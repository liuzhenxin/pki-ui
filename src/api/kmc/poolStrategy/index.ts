import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { PoolStrategyVO, PoolStrategyForm, PoolStrategyQuery } from './types';
import { parseStrEmpty } from '@/utils/ruoyi';

export const listPoolStrategy = (query: PoolStrategyQuery): AxiosPromise<PoolStrategyVO[]> => {
  return request({
    url: '/kmc/v1/pool-strategies/page',
    method: 'post',
    data: query
  });
};

export const getPoolStrategy = (id?: string | number): AxiosPromise<PoolStrategyVO> => {
  return request({
    url: '/kmc/v1/pool-strategies/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addPoolStrategy = (data: PoolStrategyForm) => {
  return request({
    url: '/kmc/v1/pool-strategies',
    method: 'post',
    data: data
  });
};

export const updatePoolStrategy = (data: PoolStrategyForm) => {
  return request({
    url: '/kmc/v1/pool-strategies',
    method: 'put',
    data: data
  });
};

export const delPoolStrategy = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/pool-strategies',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export default {
  listPoolStrategy,
  getPoolStrategy,
  addPoolStrategy,
  updatePoolStrategy,
  delPoolStrategy
};
