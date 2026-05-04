import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { KmcRuntimeConfig } from './types';

export const getKmcRuntimeConfig = (): AxiosPromise<KmcRuntimeConfig> => {
  return request({
    url: '/kmc/v1/config/runtime',
    method: 'get'
  });
};

export const updateKmcRuntimeConfig = (data: KmcRuntimeConfig): AxiosPromise<KmcRuntimeConfig> => {
  return request({
    url: '/kmc/v1/config/runtime',
    method: 'put',
    data
  });
};

export const refreshKmcRuntimeConfig = (): AxiosPromise<KmcRuntimeConfig> => {
  return request({
    url: '/kmc/v1/config/refresh',
    method: 'post'
  });
};
