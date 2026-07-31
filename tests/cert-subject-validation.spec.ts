import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const SOURCE_FILE = new URL('../src/components/CertSubject/index.vue', import.meta.url);

test('CertSubject 识别模板预置的格式限制标记', async () => {
  const source = await readFile(SOURCE_FILE, 'utf8');

  expect(source).toContain("item.regex === ':FQDN'");
  expect(source).toContain("item.regex === ':EMAIL'");
  expect(source).toContain("item.regex === ':IP'");
  expect(source).toContain("item.regex === ':URI'");
  expect(source).toContain("type: 'email'");
});
