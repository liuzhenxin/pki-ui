import request from '@/utils/request';
import { Result } from '@/api/types';
import { RaDeptForm, RaDeptQuery, RaDeptTreeOption, RaDeptVO } from './types';

export const listDeptTree = (data?: RaDeptQuery): Promise<Result<RaDeptVO[]>> => {
  return request({
    url: '/ra/v1/depts/list-tree',
    method: 'post',
    data: data || {}
  }) as any;
};

export const listDeptSelectTree = (data?: RaDeptQuery): Promise<Result<RaDeptTreeOption[]>> => {
  return request({
    url: '/ra/v1/depts/list-select-tree',
    method: 'post',
    data: data || {}
  }) as any;
};

export const getDept = (id: number | string): Promise<Result<RaDeptVO>> => {
  return request({
    url: `/ra/v1/depts/${id}`,
    method: 'get'
  }) as any;
};

export const saveDept = (data: RaDeptForm): Promise<Result> => {
  return request({
    url: '/ra/v1/depts',
    method: 'post',
    data: { co: data }
  }) as any;
};

export const modifyDept = (data: RaDeptForm): Promise<Result> => {
  return request({
    url: '/ra/v1/depts',
    method: 'put',
    data: { co: data }
  }) as any;
};

export const removeDept = (ids: Array<number | string>): Promise<Result> => {
  return request({
    url: '/ra/v1/depts',
    method: 'delete',
    data: ids
  }) as any;
};
