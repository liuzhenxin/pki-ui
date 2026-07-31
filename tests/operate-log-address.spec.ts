import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const VIEW_SOURCE = new URL('../src/views/system/operlog/index.vue', import.meta.url);
const TYPES_SOURCE = new URL('../src/api/system/operlog/types.ts', import.meta.url);

test('业务日志使用 Admin API 的 ipAddress 字段展示 IP 地址', async () => {
  const viewSource = await readFile(VIEW_SOURCE, 'utf8');
  const typesSource = await readFile(TYPES_SOURCE, 'utf8');

  expect(viewSource).toContain('label="IP地址" align="center" prop="ipAddress"');
  expect(viewSource).not.toContain('label="IP地址" align="center" prop="ip"');
  expect(typesSource).toContain('ipAddress?: string;');
  expect(typesSource).not.toContain('ip?: string;');
});
