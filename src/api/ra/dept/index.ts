import request from '@/utils/request';
import { Result } from '@/api/types';
import { RaDeptForm, RaDeptQuery, RaDeptTreeOption, RaDeptVO } from './types';

const raScopeHeaders = {
  'X-RA-Scope': 'true'
};

export const listDeptTree = (data?: RaDeptQuery): Promise<Result<RaDeptVO[]>> => {
  return request({
    url: '/admin/v1/depts/list-tree',
    method: 'post',
    headers: raScopeHeaders,
    data: data || {}
  }) as any;
};

export const listDeptSelectTree = (data?: RaDeptQuery): Promise<Result<RaDeptTreeOption[]>> => {
  return request({
    url: '/admin/v1/depts/list-select-tree',
    method: 'post',
    headers: raScopeHeaders,
    data: data || {}
  }) as any;
};

export const getDept = (id: number | string): Promise<Result<RaDeptVO>> => {
  return request({
    url: `/admin/v1/depts/${id}`,
    method: 'get',
    headers: raScopeHeaders
  }) as any;
};

export const saveDept = (data: RaDeptForm): Promise<Result> => {
  return request({
    url: '/admin/v1/depts',
    method: 'post',
    headers: raScopeHeaders,
    data: { co: data }
  }) as any;
};

export const modifyDept = (data: RaDeptForm): Promise<Result> => {
  return request({
    url: '/admin/v1/depts',
    method: 'put',
    headers: raScopeHeaders,
    data: { co: data }
  }) as any;
};

export const removeDept = (ids: Array<number | string>): Promise<Result> => {
  return request({
    url: '/admin/v1/depts',
    method: 'delete',
    headers: raScopeHeaders,
    data: ids
  }) as any;
};
