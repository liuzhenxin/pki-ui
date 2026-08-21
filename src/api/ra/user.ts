import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { parseStrEmpty } from '@/utils/ruoyi';
import { UserForm, UserInfoVO, UserQuery, UserVO } from '@/api/system/user/types';

export const listUser = (query: UserQuery): AxiosPromise<UserVO[]> => {
  return request({
    url: '/ra/v1/users/page',
    method: 'post',
    data: {
      params: {},
      ...query
    }
  });
};

export const getUser = (userId?: string | number): AxiosPromise<UserInfoVO> => {
  return request({
    url: '/ra/v1/users/' + parseStrEmpty(userId),
    method: 'get'
  });
};

export const addUser = (data: UserForm) => {
  return request({
    url: '/ra/v1/users',
    method: 'post',
    data: { co: data }
  });
};

export const updateUser = (data: UserForm) => {
  return request({
    url: '/ra/v1/users',
    method: 'put',
    data: { co: data }
  });
};

export const delUser = (userId: Array<string | number> | string | number) => {
  return request({
    url: '/ra/v1/users',
    method: 'delete',
    data: Array.isArray(userId) ? userId : [userId]
  });
};

export const resetUserPwd = (userId: string | number, password: string) => {
  return request({
    url: '/ra/v1/users/reset-pwd',
    method: 'put',
    headers: {
      repeatSubmit: false
    },
    data: {
      co: {
        id: userId,
        password
      }
    }
  });
};

export const changeStatus = (userId: number | string, status: string | number) => {
  return request({
    url: '/ra/v1/users/status',
    method: 'put',
    data: {
      co: {
        id: userId,
        status
      }
    }
  });
};

export const getAuthRole = (userId: string | number): AxiosPromise<{ user: UserVO; roles: never[] }> => {
  return getUser(userId).then((userRes: any) => {
    const userData = userRes?.data ?? {};
    return {
      ...userRes,
      data: {
        user: {
          ...userData,
          userId: userData.userId ?? userData.id,
          userName: userData.userName ?? userData.username,
          nickName: userData.nickName ?? userData.username
        },
        roles: []
      }
    };
  }) as AxiosPromise<{ user: UserVO; roles: never[] }>;
};

export const updateAuthRole = (_data: { userId: string; roleIds: string }) => {
  return Promise.resolve({ code: 'OK', data: null });
};
