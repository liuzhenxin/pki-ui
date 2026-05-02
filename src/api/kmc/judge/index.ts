import request from '@/utils/request';
import { parseStrEmpty } from '@/utils/ruoyi';
import { JudgeApproveForm, JudgeForm, JudgeQuery } from './types';

export const listJudge = (query: JudgeQuery) => {
  return request({
    url: '/kmc/v1/judges/page',
    method: 'post',
    data: query
  });
};

export const getJudge = (id?: string | number) => {
  return request({
    url: '/kmc/v1/judges/' + parseStrEmpty(id),
    method: 'get'
  });
};

export const addJudge = (data: JudgeForm) => {
  return request({
    url: '/kmc/v1/judges',
    method: 'post',
    data
  });
};

export const updateJudge = (data: JudgeForm) => {
  return request({
    url: '/kmc/v1/judges',
    method: 'put',
    data
  });
};

export const delJudge = (id: Array<string | number> | string | number) => {
  return request({
    url: '/kmc/v1/judges',
    method: 'delete',
    data: Array.isArray(id) ? id : [id]
  });
};

export const approveJudge = (data: JudgeApproveForm) => {
  return request({
    url: '/kmc/v1/judges/approve',
    method: 'post',
    data
  });
};

