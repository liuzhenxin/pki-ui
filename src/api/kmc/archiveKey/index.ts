import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { ArchiveKeyVO, ArchiveKeyForm, ArchiveKeyQuery } from './types';
import { parseStrEmpty } from '@/utils/ruoyi';

export const listArchiveKey = (query: ArchiveKeyQuery): AxiosPromise<ArchiveKeyVO[]> => {
  return request({
    url: '/kmc/v1/archive-keys/page',
    method: 'post',
    data: query
  });
};

export const getArchiveKey = (id?: string | number): AxiosPromise<ArchiveKeyVO> => {
  return request({
    url: '/kmc/v1/archive-keys/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addArchiveKey = (data: ArchiveKeyForm) => {
  return request({
    url: '/kmc/v1/archive-keys',
    method: 'post',
    data: data
  });
};

export const updateArchiveKey = (data: ArchiveKeyForm) => {
  return request({
    url: '/kmc/v1/archive-keys',
    method: 'put',
    data: data
  });
};

export const delArchiveKey = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/archive-keys',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export default {
  listArchiveKey,
  getArchiveKey,
  addArchiveKey,
  updateArchiveKey,
  delArchiveKey
};
