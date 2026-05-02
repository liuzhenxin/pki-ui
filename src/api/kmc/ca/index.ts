import request from '@/utils/request';
import { parseStrEmpty } from '@/utils/ruoyi';
import { KmcCaForm, KmcCaQuery } from './types';

export const listKmcCa = (query: KmcCaQuery) => {
  return request({
    url: '/kmc/v1/cas/page',
    method: 'post',
    data: query
  });
};

export const getKmcCa = (id?: string | number) => {
  return request({
    url: '/kmc/v1/cas/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addKmcCa = (data: KmcCaForm) => {
  return request({
    url: '/kmc/v1/cas',
    method: 'post',
    data
  });
};

export const updateKmcCa = (data: KmcCaForm) => {
  return request({
    url: '/kmc/v1/cas',
    method: 'put',
    data
  });
};

export const delKmcCa = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/cas',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

