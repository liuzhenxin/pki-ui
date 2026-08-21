import { DeptTreeVO } from './../dept/types';
import { RoleVO } from '@/api/system/role/types';
import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { UserForm, UserQuery, UserVO, UserInfoVO, ModifyPwdForm } from './types';
import { parseStrEmpty } from '@/utils/ruoyi';

const RA_AUTH_ROLE_OPTIONS = [
  { roleId: '503', roleName: '录入员', roleSort: 503 },
  { roleId: '504', roleName: '审核员', roleSort: 504 },
  { roleId: '505', roleName: '制证员', roleSort: 505 }
];
const RA_AUTH_ROLE_IDS = new Set(RA_AUTH_ROLE_OPTIONS.map((role) => role.roleId));

/**
 * 查询用户列表
 * @param query
 */
export const listUser = (query: UserQuery): AxiosPromise<UserVO[]> => {
  return request({
    url: '/admin/v1/users/page',
    method: 'post',
    data: {
      params: {},
      ...query
    }
  });
};

/**
 * 通过用户ids查询用户
 * @param userIds
 */
export const optionSelect = (userIds: (number | string)[]): AxiosPromise<UserVO[]> => {
  return request({
    url: '/system/user/optionselect?userIds=' + userIds,
    method: 'get'
  });
};

/**
 * 获取用户详情
 * @param userId
 */
export const getUser = (userId?: string | number): AxiosPromise<UserInfoVO> => {
  return request({
    url: '/admin/v1/users/' + parseStrEmpty(userId),
    method: 'get'
  });
};

/**
 * 新增用户
 */
export const addUser = (data: UserForm) => {
  return request({
    url: '/admin/v1/users',
    method: 'post',
    data: { co: data }
  });
};

/**
 * 修改用户
 */
export const updateUser = (data: UserForm) => {
  return request({
    url: '/admin/v1/users',
    method: 'put',
    data: { co: data }
  });
};

/**
 * 删除用户
 * @param userId 用户ID
 */
export const delUser = (userId: Array<string | number> | string | number) => {
  return request({
    url: '/admin/v1/users',
    method: 'delete',
    data: Array.isArray(userId) ? userId : [userId]
  });
};

/**
 * 用户密码重置
 * @param userId 用户ID
 * @param password 密码
 */
export const resetUserPwd = (userId: string | number, password: string) => {
  const data = {
    co: {
      id: userId,
      password: password
    }
  };
  return request({
    url: '/admin/v1/users/reset-pwd',
    method: 'put',
    headers: {
      isEncrypt: true,
      repeatSubmit: false
    },
    data: data
  });
};

/**
 * 用户状态修改
 * @param userId 用户ID
 * @param status 用户状态
 */
export const changeUserStatus = (userId: number | string, status: string) => {
  const data = {
    co: {
      id: userId,
      status: status
    }
  };
  return request({
    url: '/admin/v1/users/authority',
    method: 'put',
    data: data
  });
};

/**
 * 用户状态修改（仅修改状态）
 * @param userId 用户ID
 * @param status 用户状态
 */
export const changeStatus = (userId: number | string, status: string) => {
  const data = {
    co: {
      id: userId,
      status: status
    }
  };
  return request({
    url: '/admin/v1/users/status',
    method: 'put',
    data: data
  });
};

/**
 * 用户角色授权
 * @param userId 用户ID
 * @param roleIds 角色ID列表
 */
export const authRole = (userId: number | string, roleIds: string[]) => {
  const data = {
    co: {
      id: userId,
      roleIds: roleIds
    }
  };
  return request({
    url: '/admin/v1/users/authority',
    method: 'put',
    data: data
  });
};

/**
 * 查询用户个人信息
 */
export const getUserProfile = (): AxiosPromise<UserInfoVO> => {
  return request({
    url: '/admin/v1/users/profile',
    method: 'get'
  });
};

/**
 * 修改用户个人信息
 * @param data 用户信息
 */
export const updateUserProfile = (data: UserForm) => {
  return request({
    url: '/admin/v1/users/profile',
    method: 'put',
    data: {
      co: {
        mobile: data.phonenumber || data.mobile,
        mail: data.email || data.mail
      }
    }
  });
};

/**
 * 用户密码重置
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 */
export const updateUserPwd = (oldPassword: string, newPassword: string) => {
  const data = {
    oldPassword,
    newPassword
  };
  return request({
    url: '/admin/v1/users/modify-pwd',
    method: 'put',
    headers: {
      isEncrypt: true,
      repeatSubmit: false
    },
    data: { co: data }
  });
};

/**
 * 用户头像上传
 * @param data 头像文件
 */
export const uploadAvatar = (data: FormData) => {
  return request({
    url: '/admin/v1/users/profile/avatar',
    method: 'post',
    data: data
  });
};

/**
 * 查询授权角色
 * @param userId 用户ID
 */
export const getAuthRole = (userId: string | number): AxiosPromise<{ user: UserVO; roles: RoleVO[] }> => {
  return Promise.all([
    request({
      url: '/admin/v1/users/' + userId,
      method: 'get'
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

/**
 * 保存授权角色
 * @param data 用户ID
 */
export const updateAuthRole = (data: { userId: string; roleIds: string }) => {
  const roleIds = data.roleIds ? data.roleIds.split(',').filter(Boolean) : [];
  return request({
    url: '/admin/v1/users/authority',
    method: 'put',
    data: {
      co: {
        id: data.userId,
        roleIds
      }
    }
  });
};

/**
 * 查询当前部门的所有用户信息
 * @param deptId
 */
export const listUserByDeptId = (deptId: string | number): AxiosPromise<UserVO[]> => {
  return request({
    url: '/system/user/list/dept/' + deptId,
    method: 'get'
  });
};

/**
 * 查询部门下拉树结构
 */
export const deptTreeSelect = (): AxiosPromise<DeptTreeVO[]> => {
  return request({
    url: '/system/user/deptTree',
    method: 'get'
  });
};

/**
 * 修改用户密码
 * @param data
 */
export const modifyUserPwd = (data: ModifyPwdForm) => {
  return request({
    url: '/admin/v1/users/modify-pwd',
    method: 'put',
    headers: {
      isEncrypt: true,
      repeatSubmit: false
    },
    data: { co: data }
  });
};

/**
 * 上传用户证书
 * @param data
 */
export const uploadUserCert = (data: FormData) => {
  return request({
    url: '/admin/v1/users/cert',
    method: 'post',
    data: data
  });
};

/**
 * 新增用户并上传证书
 * @param data
 */
export const saveUserWithCert = (data: FormData) => {
  return request({
    url: '/admin/v1/users/cert/save',
    method: 'post',
    data: data
  });
};

export default {
  listUser,
  getUser,
  optionSelect,
  addUser,
  updateUser,
  delUser,
  resetUserPwd,
  changeUserStatus,
  changeStatus,
  authRole,
  getUserProfile,
  updateUserProfile,
  updateUserPwd,
  uploadAvatar,
  getAuthRole,
  updateAuthRole,
  deptTreeSelect,
  listUserByDeptId,
  modifyUserPwd,
  uploadUserCert,
  saveUserWithCert
};
