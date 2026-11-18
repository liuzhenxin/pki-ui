import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import type { Result } from '@/api/types';
import type { UserPage } from '@/api/system/user';
import { parseStrEmpty } from '@/utils/ruoyi';
import { RoleVO } from '@/api/system/role/types';
import { UserForm, UserInfoVO, UserQuery, UserVO } from '@/api/system/user/types';
import type { RaUserCertScopeSaveRoot } from './userCertScope';

export const RA_BUSINESS_ROLE_OPTIONS = [
  { roleId: '503', roleName: '录入员', roleSort: 503 },
  { roleId: '504', roleName: '审核员', roleSort: 504 },
  { roleId: '505', roleName: '制证员', roleSort: 505 },
  { roleId: '507', roleName: '机构（部门）管理员', roleSort: 507 }
];

export async function getAssignableRaRoles() {
  const response = await request<unknown, Result<Array<string | number>>>({
    url: '/ra/v1/admin-users/assignable-roles',
    method: 'get'
  });
  const ids = new Set((response.data || []).map(String));
  return RA_BUSINESS_ROLE_OPTIONS.filter((role) => ids.has(role.roleId));
}

export const listAdminUser = (query: UserQuery, signal?: AbortSignal): Promise<Result<UserPage> & UserPage> => {
  return request<UserPage, Result<UserPage> & UserPage>({
    url: '/ra/v1/admin-users/page',
    method: 'post',
    headers: { repeatSubmit: false },
    signal,
    data: { params: {}, ...query }
  });
};

export const getAdminUser = (userId?: string | number): AxiosPromise<UserInfoVO> => {
  return request({
    url: '/ra/v1/admin-users/' + parseStrEmpty(userId),
    method: 'get'
  });
};

export const addAdminUser = (data: UserForm) => {
  return request({
    url: '/ra/v1/admin-users',
    method: 'post',
    data: { co: data }
  });
};

export const updateAdminUser = (data: UserForm) => {
  return request({
    url: '/ra/v1/admin-users',
    method: 'put',
    data: { co: data }
  });
};

export const delAdminUser = (userId: Array<string | number> | string | number) => {
  return request({
    url: '/ra/v1/admin-users',
    method: 'delete',
    data: Array.isArray(userId) ? userId : [userId]
  });
};

export const resetAdminUserPwd = (userId: string | number, password: string) => {
  return request({
    url: '/ra/v1/admin-users/reset-pwd',
    method: 'put',
    headers: { isEncrypt: true, repeatSubmit: false },
    data: { co: { id: userId, password } }
  });
};

export const changeAdminUserStatus = (userId: number | string, status: string | number) => {
  return request({
    url: '/ra/v1/admin-users/status',
    method: 'put',
    data: { co: { id: userId, status } }
  });
};

export const getAdminUserAuthRole = async (userId: string | number): Promise<any> => {
  const [response, options]: [any, typeof RA_BUSINESS_ROLE_OPTIONS] = await Promise.all([getAdminUser(userId), getAssignableRaRoles()]);
  const user = response?.data ?? {};
  const selectedRoleIds = new Set((user.roleIds ?? []).map((id: string | number) => String(id)));
  const roles = options.map((role) => ({
    ...role,
    roleKey: role.roleId,
    status: '0',
    flag: selectedRoleIds.has(role.roleId)
  })) as RoleVO[];
  return {
    code: 'OK',
    data: {
      user: {
        ...user,
        userId: user.id,
        userName: user.username,
        nickName: user.username
      },
      roles
    }
  };
};

export const updateAdminUserAuthority = (userId: string | number, roleIds: Array<string | number>, roots: RaUserCertScopeSaveRoot[]) => {
  return request({
    url: '/ra/v1/admin-users/authority-and-scope',
    method: 'put',
    data: { co: { id: userId, roleIds }, roots }
  });
};
