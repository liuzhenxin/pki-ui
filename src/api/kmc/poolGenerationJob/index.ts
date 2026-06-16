import request from '@/utils/request';
import { parseStrEmpty } from '@/utils/ruoyi';
import type { PoolGenerationJobForm, PoolGenerationJobLogQuery, PoolGenerationJobQuery, PoolGenerationJobVO } from './types';

export const listPoolGenerationJob = (query: PoolGenerationJobQuery) => {
  return request({
    url: '/kmc/v1/pool-generation-jobs/page',
    method: 'post',
    data: query
  });
};

export const getPoolGenerationJob = (id?: string | number) => {
  return request({
    url: '/kmc/v1/pool-generation-jobs/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addPoolGenerationJob = (data: PoolGenerationJobForm) => {
  return request({
    url: '/kmc/v1/pool-generation-jobs',
    method: 'post',
    data
  });
};

export const updatePoolGenerationJob = (data: PoolGenerationJobForm) => {
  return request({
    url: '/kmc/v1/pool-generation-jobs',
    method: 'put',
    data
  });
};

export const delPoolGenerationJob = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/pool-generation-jobs',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export const enablePoolGenerationJob = (id: string | number) => {
  return request({
    url: `/kmc/v1/pool-generation-jobs/${id}/enable`,
    method: 'post'
  });
};

export const disablePoolGenerationJob = (id: string | number) => {
  return request({
    url: `/kmc/v1/pool-generation-jobs/${id}/disable`,
    method: 'post'
  });
};

export const triggerPoolGenerationJob = (id: string | number) => {
  return request({
    url: `/kmc/v1/pool-generation-jobs/${id}/trigger`,
    method: 'post'
  });
};

export const listPoolGenerationJobLog = (query: PoolGenerationJobLogQuery) => {
  return request({
    url: '/kmc/v1/pool-generation-jobs/logs/page',
    method: 'post',
    data: query
  });
};

export default {
  listPoolGenerationJob,
  getPoolGenerationJob,
  addPoolGenerationJob,
  updatePoolGenerationJob,
  delPoolGenerationJob,
  enablePoolGenerationJob,
  disablePoolGenerationJob,
  triggerPoolGenerationJob,
  listPoolGenerationJobLog
};
