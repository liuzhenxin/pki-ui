import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { LicenseForm, LicenseQuery, LicenseVerifyForm, LicenseVerifyVO, LicenseVO, ProductQuery, ProductVO } from './types';
import { parseStrEmpty } from '@/utils/ruoyi';

export const listLicense = (query: LicenseQuery, silent = false): AxiosPromise<LicenseVO[]> => {
  return request({
    url: '/license/v1/licenses/page',
    method: 'post',
    data: query,
    headers: silent ? { hideErrorNotify: true } : undefined
  });
};

export const getLicense = (id?: string | number): AxiosPromise<LicenseVO> => {
  return request({
    url: '/license/v1/licenses/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const issueLicense = (data: LicenseForm): AxiosPromise<LicenseVO> => {
  return request({
    url: '/license/v1/licenses/issue',
    method: 'post',
    data
  });
};

export const delLicense = (id: Array<string | number> | string | number) => {
  return request({
    url: '/license/v1/licenses',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export const downloadLicense = (id: string | number) => {
  return request({
    url: '/license/v1/licenses/' + id + '/download',
    method: 'get',
    responseType: 'blob'
  });
};

export const revokeLicense = (id: string | number): AxiosPromise<LicenseVO> => {
  return request({
    url: '/license/v1/licenses/' + id + '/revoke',
    method: 'post'
  });
};

export const verifyLicense = (data: LicenseVerifyForm): AxiosPromise<LicenseVerifyVO> => {
  return request({
    url: '/license/v1/licenses/verify',
    method: 'post',
    data
  });
};

export const listProduct = (query: ProductQuery, silent = false): AxiosPromise<ProductVO[]> => {
  return request({
    url: '/license/v1/products/page',
    method: 'post',
    data: query,
    headers: silent ? { hideErrorNotify: true } : undefined
  });
};
