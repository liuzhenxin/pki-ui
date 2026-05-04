import request from '@/utils/request';
import { parseStrEmpty } from '@/utils/ruoyi';
import { KmcCaForm, KmcCaIdentityVerifyForm, KmcCaQuery } from './types';

const wrapKmcCaCommand = (data: KmcCaForm) => ({ co: data });

export const listKmcCa = (query: KmcCaQuery) => {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return request({
    url: '/kmc/v1/cas/page',
    method: 'post',
    data: {
      ...query,
      pageIndex: (pageNum - 1) * pageSize,
      pageSize
    }
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
    data: wrapKmcCaCommand(data)
  });
};

export const updateKmcCa = (data: KmcCaForm) => {
  return request({
    url: '/kmc/v1/cas',
    method: 'put',
    data: wrapKmcCaCommand(data)
  });
};

export const delKmcCa = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/cas',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export const verifyKmcCaIdentity = (data: KmcCaIdentityVerifyForm) => {
  return request({
    url: '/kmc/v1/cas/verify-identity',
    method: 'post',
    data
  });
};
