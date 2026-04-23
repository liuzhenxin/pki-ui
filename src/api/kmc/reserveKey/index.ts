import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { ReserveKeyVO, ReserveKeyForm, ReserveKeyQuery } from './types';
import { parseStrEmpty } from '@/utils/ruoyi';

export const listReserveKey = (query: ReserveKeyQuery): AxiosPromise<ReserveKeyVO[]> => {
  return request({
    url: '/kmc/v1/reserve-keys/page',
    method: 'post',
    data: query
  });
};

export const getReserveKey = (id?: string | number): AxiosPromise<ReserveKeyVO> => {
  return request({
    url: '/kmc/v1/reserve-keys/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addReserveKey = (data: ReserveKeyForm) => {
  return request({
    url: '/kmc/v1/reserve-keys',
    method: 'post',
    data: data
  });
};

export const updateReserveKey = (data: ReserveKeyForm) => {
  return request({
    url: '/kmc/v1/reserve-keys',
    method: 'put',
    data: data
  });
};

export const delReserveKey = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/reserve-keys',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export default {
  listReserveKey,
  getReserveKey,
  addReserveKey,
  updateReserveKey,
  delReserveKey
};
