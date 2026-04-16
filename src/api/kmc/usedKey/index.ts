import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { UsedKeyVO, UsedKeyForm, UsedKeyQuery } from './types';
import { parseStrEmpty } from '@/utils/ruoyi';

export const listUsedKey = (query: UsedKeyQuery): AxiosPromise<UsedKeyVO[]> => {
  return request({
    url: '/v1/used-keys/page',
    method: 'post',
    data: query
  });
};

export const getUsedKey = (id?: string | number): AxiosPromise<UsedKeyVO> => {
  return request({
    url: '/v1/used-keys/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addUsedKey = (data: UsedKeyForm) => {
  return request({
    url: '/v1/used-keys',
    method: 'post',
    data: data
  });
};

export const updateUsedKey = (data: UsedKeyForm) => {
  return request({
    url: '/v1/used-keys',
    method: 'put',
    data: data
  });
};

export const delUsedKey = (id: Array<string | number> | string | number) => {
  return request({
    url: '/v1/used-keys',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export default {
  listUsedKey,
  getUsedKey,
  addUsedKey,
  updateUsedKey,
  delUsedKey
};
