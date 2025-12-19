/**
 * 注册
 */
export type RegisterForm = {
  tenantId: string;
  username: string;
  password: string;
  confirmPassword?: string;
  code?: string;
  uuid?: string;
  userType?: string;
};

/**
 * 登录请求
 */
export interface LoginData {
  tenantId?: string;
  tenantCode?: string;
  username?: string;
  password?: string;
  rememberMe?: boolean;
  socialCode?: string;
  socialState?: string;
  source?: string;
  code?: string;
  uuid?: string;
  clientId: string;
  grantType: string;
}

/**
 * 登录响应
 */
export interface LoginResult {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}

/**
 * 密钥数据
 */
export interface SecretsResult {
  extValues: any;
  publicKey: string;
}

// /**
//  * 租户
//  */
// export interface TenantVO {
//   companyName: string;
//   domain: any;
//   tenantId: string;
// }
//
// export interface TenantInfo {
//   tenantEnabled: boolean;
//   voList: TenantVO[];
// }

export interface Result<T = any> {
  /** 状态编码 */
  code?: string;
  /** 响应描述 */
  msg?: string;
  /** 响应结果 */
  data?: T;
  /** 链路ID */
  traceId?: string;
  /** 标签ID */
  spanId?: string;
}
