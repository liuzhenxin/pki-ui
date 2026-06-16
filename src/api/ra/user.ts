import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { parseStrEmpty } from '@/utils/ruoyi';
import { RoleVO } from '@/api/system/role/types';
import { UserForm, UserInfoVO, UserQuery, UserVO } from '@/api/system/user/types';

const raScopeHeaders = {
  'X-RA-Scope': 'true'
};

const RA_AUTH_ROLE_OPTIONS = [
  { roleId: '503', roleName: '录入员', roleSort: 503 },
  { roleId: '504', roleName: '审核员', roleSort: 504 },
  { roleId: '505', roleName: '制证员', roleSort: 505 }
];
const RA_AUTH_ROLE_IDS = new Set(RA_AUTH_ROLE_OPTIONS.map((role) => role.roleId));

export const listUser = (query: UserQuery): AxiosPromise<UserVO[]> => {
  return request({
    url: '/admin/v1/users/page',
    method: 'post',
    headers: raScopeHeaders,
    data: {
      params: {},
      ...query
    }
  });
};

export const getUser = (userId?: string | number): AxiosPromise<UserInfoVO> => {
  return request({
    url: '/admin/v1/users/' + parseStrEmpty(userId),
    method: 'get',
    headers: raScopeHeaders
  });
};

export const addUser = (data: UserForm) => {
  return request({
    url: '/admin/v1/users',
    method: 'post',
    headers: raScopeHeaders,
    data: { co: data }
  });
};

export const updateUser = (data: UserForm) => {
  return request({
    url: '/admin/v1/users',
    method: 'put',
    headers: raScopeHeaders,
    data: { co: data }
  });
};

export const delUser = (userId: Array<string | number> | string | number) => {
  return request({
    url: '/admin/v1/users',
    method: 'delete',
    headers: raScopeHeaders,
    data: Array.isArray(userId) ? userId : [userId]
  });
};

export const resetUserPwd = (userId: string | number, password: string) => {
  return request({
    url: '/admin/v1/users/reset-pwd',
    method: 'put',
    headers: {
      ...raScopeHeaders,
      isEncrypt: true,
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
    url: '/admin/v1/users/status',
    method: 'put',
    headers: raScopeHeaders,
    data: {
      co: {
        id: userId,
        status
      }
    }
  });
};

export const getAuthRole = (userId: string | number): AxiosPromise<{ user: UserVO; roles: RoleVO[] }> => {
  return Promise.all([
    request({
      url: '/admin/v1/users/' + userId,
      method: 'get',
      headers: raScopeHeaders
    }),
    request({
      url: '/admin/v1/roles/page',
      method: 'post',
      data: {
        pageNum: 1,
        pageSize: 1000,
        params: {}
      }
    })
  ]).then(([userRes, roleRes]: any) => {
    const userData = userRes?.data ?? {};
    const selectedRoleIds = (userData.roleIds ?? []).map((id: string | number) => String(id));
    const roleRecords = roleRes?.data?.records ?? roleRes?.rows ?? roleRes?.data ?? [];
    const roleMap = new Map<string, any>();
    roleRecords.forEach((role: any) => {
      const roleId = role.roleId ?? role.id;
      if (RA_AUTH_ROLE_IDS.has(String(roleId))) {
        roleMap.set(String(roleId), role);
      }
    });
    const roles = RA_AUTH_ROLE_OPTIONS.map((option) => {
      const role = roleMap.get(option.roleId) ?? {};
      const roleId = role.roleId ?? role.id ?? option.roleId;
      return {
        ...role,
        roleId,
        roleName: role.roleName ?? role.name ?? option.roleName,
        roleKey: role.roleKey ?? String(roleId ?? ''),
        roleSort: role.roleSort ?? role.sort ?? option.roleSort,
        status: role.status ?? '0',
        flag: selectedRoleIds.includes(String(roleId))
      };
    });

    return {
      code: 'OK',
      data: {
        user: {
          ...userData,
          userId: userData.userId ?? userData.id,
          userName: userData.userName ?? userData.username,
          nickName: userData.nickName ?? userData.username
        },
        roles
      }
    };
  }) as AxiosPromise<{ user: UserVO; roles: RoleVO[] }>;
};

export const updateAuthRole = (data: { userId: string; roleIds: string }) => {
  const roleIds = data.roleIds ? data.roleIds.split(',').filter(Boolean) : [];
  return request({
    url: '/admin/v1/users/authority',
    method: 'put',
    headers: raScopeHeaders,
    data: {
      co: {
        id: data.userId,
        roleIds
      }
    }
  });
};
