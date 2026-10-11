import request from '@/utils/request';
import type { AxiosRequestConfig } from 'axios';
import type { CreateKeyRequest, CryptoResult, EncryptionContext, KeyAction, KeyDetail, KeyMetadata, KeyStateResult } from './types';
import { requireKeyId } from '@/utils/kms';

// KMS 的密码数据不得进入公共重复提交检查所用的 sessionStorage。
async function call<T>(config: AxiosRequestConfig): Promise<T> {
  const body = (await request({ ...config, headers: { repeatSubmit: false, hideErrorNotify: true } })) as unknown as { data: T };
  return body.data;
}
export const createKey = (data: CreateKeyRequest) => call<KeyMetadata>({ url: '/kms/v1/keys', method: 'post', data });
export const describeKey = (keyId: string) => call<KeyDetail>({ url: `/kms/v1/keys/${requireKeyId(keyId)}`, method: 'get' });
export function changeKeyState(keyId: string, action: KeyAction, pendingWindowDays?: number) {
  if (action === 'schedule-deletion' && (!Number.isInteger(pendingWindowDays) || pendingWindowDays < 7 || pendingWindowDays > 30)) {
    throw new Error('删除等待期必须为 7–30 天');
  }
  return call<KeyStateResult | KeyDetail>({
    url: `/kms/v1/keys/${requireKeyId(keyId)}/${action}`,
    method: 'post',
    ...(action === 'schedule-deletion' ? { data: { pendingWindowDays } } : {})
  });
}
export const encrypt = (keyId: string, plaintext: string, encryptionContext: EncryptionContext) =>
  call<CryptoResult>({
    url: '/kms/v1/crypto/encrypt',
    method: 'post',
    data: { keyId: requireKeyId(keyId), plaintext, encryptionContext }
  });
export const decrypt = (keyId: string, ciphertextBlob: string, encryptionContext: EncryptionContext) =>
  call<CryptoResult>({
    url: '/kms/v1/crypto/decrypt',
    method: 'post',
    data: { keyId: requireKeyId(keyId), ciphertextBlob, encryptionContext }
  });
export const generateDataKey = (keyId: string, keySpec: 'SM4_128' | 'AES_256', encryptionContext: EncryptionContext) =>
  call<CryptoResult>({
    url: '/kms/v1/data-keys',
    method: 'post',
    data: { keyId: requireKeyId(keyId), keySpec, encryptionContext }
  });
