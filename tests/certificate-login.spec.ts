import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { normalizeSm2SignatureForApi } from '../src/utils/sm2SignatureDigest';

const LOGIN_SOURCE = new URL('../src/views/login.vue', import.meta.url);

test('证书登录按挑战、PIN、SM2签名、验证和换取令牌的顺序执行', async () => {
  const source = await readFile(LOGIN_SOURCE, 'utf8');
  const steps = [
    'createCertificateLoginChallenge',
    'skf.checkPIN',
    'calculateSm2SignatureDigest',
    'skf.signData',
    'verifyCertificateLoginSignature',
    'userStore.certificateLogin'
  ];
  let previous = -1;
  for (const step of steps) {
    const current = source.indexOf(step, previous + 1);
    expect(current, `${step} 应出现在证书登录闭环中`).toBeGreaterThan(previous);
    previous = current;
  }
  expect(source).toContain("import.meta.env.VITE_APP_SKF_WS_URL || 'ws://127.0.0.1:9001'");
  expect(source).toContain('new SKFClient(skfServiceUrl)');
  expect(source).not.toContain('证书登录暂未接入');
});

test('将 SKF r||s 签名转换为认证服务要求的 ASN.1 DER', () => {
  const raw = Uint8Array.from({ length: 64 }, (_, index) => index + 1);
  const rawBase64 = Buffer.from(raw).toString('base64');
  const der = Buffer.from(normalizeSm2SignatureForApi(rawBase64), 'base64');

  expect(der[0]).toBe(0x30);
  expect(der[2]).toBe(0x02);
  expect(der.length).toBe(70);
  expect(Buffer.from(normalizeSm2SignatureForApi(der.toString('base64')), 'base64')).toEqual(der);
});
