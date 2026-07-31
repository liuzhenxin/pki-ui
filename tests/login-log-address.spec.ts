import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const VIEW_SOURCE = new URL('../src/views/system/loginlog/index.vue', import.meta.url);
const TYPES_SOURCE = new URL('../src/api/system/loginlog/types.ts', import.meta.url);

test('登录日志使用 Admin API 的 ipAddress 字段展示和查询登录地址', async () => {
  const viewSource = await readFile(VIEW_SOURCE, 'utf8');
  const typesSource = await readFile(TYPES_SOURCE, 'utf8');

  expect(viewSource).toContain('v-model="queryParams.ipAddress"');
  expect(viewSource).toContain('prop="ipAddress"');
  expect(viewSource).toContain('ipAddress: undefined');
  expect(viewSource).not.toContain('v-model="queryParams.ip"');
  expect(typesSource).toContain('ipAddress?: string;');
  expect(typesSource).not.toContain('ip?: string;');
});
