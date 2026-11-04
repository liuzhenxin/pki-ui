import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const CA_FORM_SOURCE = new URL('../src/views/ca/profile/form.vue', import.meta.url);
const RA_FORM_SOURCE = new URL('../src/views/ra/profile/form.vue', import.meta.url);
const TLS_PROFILE_SOURCE = new URL('../../liuzx-ca/liuzx-ca-infrastructure/src/main/resources/profiles/05-certprofile-tls.json', import.meta.url);

function tlsServerConstraint(source: string) {
  const start = source.indexOf('TLS_SERVER: {');
  const end = source.indexOf('TLS_CLIENT: {', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

test('TLS 服务端模板允许后端声明的可选 clientAuth EKU', async () => {
  const [caSource, raSource, profileSource] = await Promise.all([
    readFile(CA_FORM_SOURCE, 'utf8'),
    readFile(RA_FORM_SOURCE, 'utf8'),
    readFile(TLS_PROFILE_SOURCE, 'utf8')
  ]);
  const profile = JSON.parse(profileSource);
  const extendedKeyUsage = profile.extensions.find((extension: any) => extension.type === 'ExtendedKeyUsage')?.extendedKeyUsage;

  expect(extendedKeyUsage.required).toContain('serverAuth');
  expect(extendedKeyUsage.optional).toContain('clientAuth');

  for (const source of [caSource, raSource]) {
    const constraint = tlsServerConstraint(source);
    expect(constraint).toContain("extendedKeyUsages: ['serverAuth', 'clientAuth']");
    expect(constraint).toContain("requiredExtendedKeyUsages: ['serverAuth']");
  }
});
