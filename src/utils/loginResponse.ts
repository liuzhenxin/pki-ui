import type { LoginResult } from '@/api/types';

export function loginVersion(version?: string): string {
  return version?.trim().replace(/-faw-[a-z0-9_.-]+$/i, '') || '未知';
}

export function isLoginTokenRequest(config: any): boolean {
  if (
    !String(config?.url || '')
      .split('?')[0]
      .endsWith('/oauth2/token') ||
    config?._isRefreshRequest
  )
    return false;
  const grant = typeof config.data === 'string' ? new URLSearchParams(config.data).get('grant_type') : config.data?.grant_type;
  return grant !== 'refresh_token';
}

export function assertLoginResult(data: any): LoginResult {
  const code = data?.code;
  const success = code == null || code === 200 || code === '200' || code === 'OK';
  const token = data?.access_token;
  if (!data || data.error || !success || typeof token !== 'string' || !token.trim() || ['undefined', 'null'].includes(token.trim())) {
    throw new Error(data?.error_description || data?.msg || data?.message || '登录失败，认证服务未返回有效令牌');
  }
  return data as LoginResult;
}
