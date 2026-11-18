import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { assertLoginResult, isLoginTokenRequest, loginVersion } from '../src/utils/loginResponse';

test('login version hides only the FAW delivery suffix', () => {
  expect(loginVersion('3.0.6-faw-20261023.162922')).toBe('3.0.6');
  expect(loginVersion('3.0.6')).toBe('3.0.6');
  expect(loginVersion('3.0.6-rc.1')).toBe('3.0.6-rc.1');
  expect(loginVersion()).toBe('未知');
});

test('captcha and OAuth errors cannot be accepted as login tokens', () => {
  for (const data of [
    { error: 'invalid_grant', error_description: '验证码已过期' },
    { code: 'Bad credentials', msg: '验证码错误' },
    { code: 200, msg: '验证码错误' },
    { code: 401, access_token: 'must-not-use' },
    { error: 'invalid_grant', access_token: 'must-not-use' },
    { access_token: 'undefined' },
    { access_token: 'null' },
    { access_token: ' ' },
    null
  ])
    expect(() => assertLoginResult(data)).toThrow();
  const valid = { access_token: 'new-token', expires_in: 300, token_type: 'Bearer', scope: 'read' };
  expect(assertLoginResult(valid)).toBe(valid);
});

test('login token requests are separate from refresh and normal API requests', () => {
  expect(isLoginTokenRequest({ url: '/auth/v1/oauth2/token', data: 'grant_type=username_password' })).toBe(true);
  expect(isLoginTokenRequest({ url: '/auth/v1/oauth2/token', data: { grant_type: 'refresh_token' } })).toBe(false);
  expect(isLoginTokenRequest({ url: '/auth/v1/oauth2/token', data: 'grant_type=refresh_token' })).toBe(false);
  expect(isLoginTokenRequest({ url: '/auth/v1/oauth2/token', _isRefreshRequest: true })).toBe(false);
  expect(isLoginTokenRequest({ url: '/ra/v1/cert/page' })).toBe(false);
});

function userStoreHarness(result: any) {
  let access: any = 'old-token';
  let refresh: any = 'old-refresh';
  let writes = 0;
  const auth = {
    getToken: () => access,
    removeToken: () => {
      access = null;
    },
    setToken: (value: string) => {
      access = value;
      writes++;
    },
    removeRefreshToken: () => {
      refresh = null;
    },
    setRefreshToken: (value: string) => {
      refresh = value;
    }
  };
  const source = readFileSync(new URL('../src/store/modules/user.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)(
    (name: string) => {
      if (name === 'vue') return vue;
      if (name === 'pinia') return { defineStore: (_name: string, setup: () => unknown) => setup };
      if (name === 'await-to-js')
        return {
          to: async (promise: Promise<any>) =>
            promise.then(
              (value) => [null, value],
              (error) => [error]
            )
        };
      if (name === '@/utils/auth') return auth;
      if (name === '@/utils/loginResponse') return { assertLoginResult };
      if (name === '@/utils/certSessionWatcher') return { markCertLogin: () => {} };
      if (name === '@/api/login') return { login: async () => result };
      if (name.endsWith('.jpg')) return { default: 'avatar' };
      throw new Error(name);
    },
    module,
    module.exports
  );
  return { store: module.exports.useUserStore(), access: () => access, refresh: () => refresh, writes: () => writes };
}

test('failed captcha login clears old session and never saves an error object as a token', async () => {
  const h = userStoreHarness({ error: 'invalid_grant', error_description: '验证码已过期' });
  await expect(h.store.login({ tenantId: '5' })).rejects.toThrow('验证码已过期');
  expect(h.access()).toBeNull();
  expect(h.refresh()).toBeNull();
  expect(h.store.token.value).toBe('');
  expect(h.writes()).toBe(0);
});

test('successful login stores only the new token and never retains an old refresh token', async () => {
  const h = userStoreHarness({ access_token: 'new-token' });
  await h.store.login({ tenantId: '5' });
  expect(h.access()).toBe('new-token');
  expect(h.refresh()).toBeNull();
  expect(h.writes()).toBe(1);
});

test('login SFC compiles and refresh failures invalidate the old captcha before fetching', () => {
  const source = readFileSync(new URL('../src/views/login.vue', import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  expect(compileTemplate({ source: descriptor.template!.content, filename: 'login.vue', id: 'login-validation' }).errors).toEqual([]);
  expect(() => compileScript(descriptor, { id: 'login-validation' })).not.toThrow();
  const getCode = source.slice(source.indexOf('const getCode = async'), source.indexOf('const loadLoginHints = async'));
  expect(getCode.indexOf('clearCaptcha();')).toBeLessThan(getCode.indexOf('await getCodeImg'));
  expect(getCode).toContain('requestId !== captchaRequestId');
  expect(source).toContain("await getCode(String(loginForm.value.tenantCode || ''), true)");
  expect(source).toContain('if (loading.value || captchaLoading.value || loginPageDisposed) return;');
});
