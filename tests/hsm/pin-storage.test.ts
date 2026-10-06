import { beforeEach, expect, test, vi } from 'vitest';
const transportState = vi.hoisted(() => ({ fail: false }));
vi.mock('@/utils/auth', () => ({
  getToken: () => 'fixture-token',
  getRefreshToken: () => '',
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  removeToken: vi.fn(),
  removeRefreshToken: vi.fn()
}));
vi.mock('@/lang', () => ({ getLanguage: () => 'zh-CN' }));
vi.mock('@/utils/crypto', () => ({
  encryptBase64: vi.fn(),
  encryptWithAes: vi.fn(),
  generateAesKey: vi.fn(),
  decryptWithAes: vi.fn(),
  decryptBase64: vi.fn()
}));
vi.mock('@/utils/jsencrypt', () => ({ encrypt: vi.fn(), decrypt: vi.fn() }));
vi.mock('@/router', () => ({ default: { currentRoute: { value: { fullPath: '/hsm/ukeys' } }, resolve: () => ({ href: '/login' }) } }));
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  const axios = actual.default;
  return {
    ...actual,
    default: {
      ...axios,
      defaults: axios.defaults,
      create: (config: object) =>
        axios.create({
          ...config,
          adapter: async (request: any) => {
            if (transportState.fail) throw new actual.AxiosError('fixture failure', 'ERR_NETWORK', request);
            return {
              data: { code: 'OK', data: null },
              status: 200,
              statusText: 'OK',
              request: { responseType: 'json' },
              headers: {},
              config: request
            };
          }
        })
    }
  };
});
import request from '@/utils/request';
import { confirmUkey } from '@/api/hsm/ukeys';
beforeEach(() => {
  transportState.fail = false;
  sessionStorage.clear();
  localStorage.clear();
});
test('ordinary POST fixture demonstrates duplicate-submit persistence exists', async () => {
  await request({ url: '/fixture', method: 'post', data: { harmless: 'fixture' } });
  expect(sessionStorage.getItem('sessionObj')).toContain('fixture');
});
test('appointment and login PIN never reach persistent browser storage through actual interceptors', async () => {
  await confirmUkey('appointment', 'sensitive-fixture-pin', true);
  await confirmUkey('login', 'sensitive-fixture-pin', false);
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
});

test('failed PIN requests discard Axios context and never log sensitive data', async () => {
  transportState.fail = true;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const appointment of [true, false]) {
      await expect(confirmUkey('fixture', 'sensitive-fixture-pin', appointment)).rejects.toThrow('UKey 认证失败');
    }
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
});
