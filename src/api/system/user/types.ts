import { RoleVO } from '@/api/system/role/types';
import { PostVO } from '@/api/system/post/types';
import { Result } from '@/api/types';

/**
 * 用户信息
 */
export interface UserInfo {
  id: number;
  username: string;
  avatar: string | null;
  permissions: string[];
  extValues: any;
}

/**
 * 用户查询对象类型
 */
export interface UserQuery extends PageQuery {
  userName?: string;
  nickName?: string;
  phonenumber?: string;
  status?: string;
  deptId?: string | number;
  roleId?: string | number;
  userIds?: string | number | (string | number)[] | undefined;
}

/**
 * 用户返回对象
 */
export interface UserVO {
  id: number;
  username: string;
  avatar: string | null;
  permissions: string[];
  extValues: object;
}

/**
 * 用户表单类型
 */
export interface UserForm {
  id?: string;
  userId?: string;
  deptId?: number;
  userName: string;
  nickName?: string;
  password: string;
  phonenumber?: string;
  email?: string;
  sex?: string;
  status: string;
  remark?: string;
  postIds: string[];
  roleIds: string[];
}

export interface UserInfoVO {
  user: UserVO;
  roles: RoleVO[];
  roleIds: string[];
  posts: PostVO[];
  postIds: string[];
  roleGroup: string;
  postGroup: string;
}

export interface ResetPwdForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}
