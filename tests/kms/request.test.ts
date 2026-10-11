import { beforeEach, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import service from '@/utils/request';
import { decrypt, encrypt } from '@/api/kms';
vi.mock('@/utils/auth', () => ({
  getToken: () => '',
  setToken: vi.fn(),
  getRefreshToken: () => '',
  setRefreshToken: vi.fn(),
  removeToken: vi.fn(),
  removeRefreshToken: vi.fn()
}));
vi.mock('@/utils/ruoyi', () => ({ tansParams: () => '', blobValidate: vi.fn() }));
vi.mock('@/lang', () => ({ getLanguage: () => 'zh-CN' }));
vi.mock('@/utils/crypto', () => ({
  encryptBase64: vi.fn(),
  encryptWithAes: vi.fn(),
  generateAesKey: vi.fn(),
  decryptWithAes: vi.fn(),
  decryptBase64: vi.fn()
}));
vi.mock('@/utils/jsencrypt', () => ({ encrypt: vi.fn(), decrypt: vi.fn() }));
vi.mock('@/router', () => ({ default: { currentRoute: { value: { fullPath: '/kms/console' } }, resolve: () => ({ href: '/login' }) } }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it('does not cache password payloads in the actual shared request interceptor', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  service.defaults.adapter = async (config) => ({
    data: { code: 'OK', data: { keyId: id, keyVersion: 1, ciphertextBlob: 'cipher-canary' } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {}
  });
  expect((await encrypt(id, 'plaintext-canary', { canary: 'context-canary' })).keyVersion).toBe(1);
  expect(storage).not.toHaveBeenCalled();
});
it('sanitizes actual network failures before logging or exposing the Axios request config', async () => {
  const log = vi.spyOn(console, 'log');
  service.defaults.adapter = async (config) => {
    throw new AxiosError('plaintext-canary', 'ERR_NETWORK', config);
  };
  const error = await decrypt(id, 'ciphertext-canary', {}).catch((failure) => failure);
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain('KMS 请求失败');
  expect(error.config).toBeUndefined();
  expect(JSON.stringify(error)).not.toContain('canary');
  expect(log).not.toHaveBeenCalled();
});
it('preserves the existing duplicate-alias business message through the actual shared response interceptor', async () => {
  service.defaults.adapter = async (config) => ({
    data: { code: 'Bad_Request', msg: '密钥别名已存在' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {}
  });
  await expect(encrypt(id, 'test', {})).rejects.toThrow('密钥别名已存在');
});
