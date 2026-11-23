import { expect, test } from '@playwright/test';
import SKFClient from '../src/api/skf/skf_api.js';

test('SKF 加密密钥导入支持同句柄 PIN，兼容旧调用的参数顺序', async () => {
  const client = new SKFClient('ws://127.0.0.1:9001');
  const calls: unknown[][] = [];
  client.call = async (method, params) => {
    calls.push([method, params]);
    return true;
  };

  await client.importKeyPair('GM3000', 'device', 'app', 'container', 'SM2', 'envelope', '', 'ECB', 'test-pin');
  await client.importKeyPair('OTHER', 'device', 'app', 'container', 'RSA', 'envelope', 'wrap-key', 'CBC');

  expect(calls).toEqual([
    ['ImportKeyPair', ['GM3000', 'device', 'app', 'container', 'SM2', 'envelope', '', 'ECB', 'test-pin']],
    ['ImportKeyPair', ['OTHER', 'device', 'app', 'container', 'RSA', 'envelope', 'wrap-key', 'CBC']]
  ]);
});
