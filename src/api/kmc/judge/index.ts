import request from '@/utils/request';
import { parseStrEmpty } from '@/utils/ruoyi';
import { JudgeApproveForm, JudgeQuery } from './types';

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

export const approveJudge = (data: JudgeApproveForm) => {
  return request({
    url: '/kmc/v1/judges/approve',
    method: 'post',
    data
  });
};
