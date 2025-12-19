import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { LoginData, LoginResult, Result, SecretsResult } from './types';
import { UserInfo } from '@/api/system/user/types';
import { encrypt } from '@/utils/jsencrypt';
import { getToken } from '@/utils/auth';
import setting from '@/settings';

// pc端固定客户端授权id
const clientId = import.meta.env.VITE_APP_CLIENT_ID;
/**
 * @param data {LoginData}
 * @returns
 */
export function login(data: LoginData): Promise<LoginResult> {
  const params = {
    ...data,
    username: encodeURIComponent(encrypt(data.username)),
    password: encodeURIComponent(encrypt(data.password)),
    clientId: data.clientId || clientId,
    tenant_code: data.tenantCode || setting.tenantCode,
    authorization_code: data.tenantCode,
    uuid: data.uuid,
    captcha: data.code,
    grant_type: data.grantType || 'username_password'
  };
  return request({
    url: '/auth/api/v1/oauth2/token',
    headers: {
      isToken: false,
      isEncrypt: false,
      repeatSubmit: false,
      'Authorization': 'Basic OTVUeFNzVFBGQTN0RjEyVEJTTW1VVkswZGE6RnBId0lmdzR3WTkyZE8=',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    // 设置序列化请求函数
    transformRequest: (params = {}) =>
      Object.entries(params)
        .map((ent) => ent.join('='))
        .join('&'),
    method: 'post',
    data: params
  }) as any;
}

// 注册方法
export function register(data: any) {
  const params = {
    ...data,
    clientId: clientId,
    grantType: 'password'
  };
  return request({
    url: '/auth/register',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false
    },
    method: 'post',
    data: params
  });
}

/**
 * 注销
 */
export function logout() {
  if (import.meta.env.VITE_APP_SSE === 'true') {
    request({
      url: '/resource/sse/close',
      method: 'get'
    });
  }

  const data = {
    token: getToken()
  };

  return request({
    url: '/auth/api/v1/tokens',
    data: data,
    method: 'delete'
  });
}

/**
 * 根据UUID获取验证码
 */
export function getCodeImg(uuid: string | number): Promise<string> {
  return request({
    url: '/auth/api/v1/captchas' + '/' + uuid,
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  }) as any;
}

/**
 * 获取密钥
 */
export function getSecrets(): Promise<SecretsResult> {
  return request({
    url: '/auth/api/v1/secrets',
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  }) as any;
}

/**
 * 第三方登录
 */
export function callback(data: LoginData): Promise<any> {
  const LoginData = {
    ...data,
    clientId: clientId,
    grantType: 'social'
  };
  return request({
    url: '/auth/social/callback',
    method: 'post',
    data: LoginData
  }) as any;
}

// 获取用户详细信息
export function getInfo(): Promise<Result<UserInfo>> {
  return request({
    url: '/admin/api/v1/users/profile',
    method: 'get'
  }) as any;
}

// 获取租户列表
export function getTenantList(isToken: boolean): Promise<TenantInfo> {
  return request({
    url: '/auth/tenant/list',
    headers: {
      isToken: isToken
    },
    method: 'get'
  }) as any;
}
