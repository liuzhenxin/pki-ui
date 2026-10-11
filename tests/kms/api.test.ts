import { beforeEach, expect, it, vi } from 'vitest';
import request from '@/utils/request';
import { changeKeyState, createKey, decrypt, describeKey, encrypt, generateDataKey } from '@/api/kms';
import { canRunAction, parseEncryptionContext, requireBase64, requireKeyId } from '@/utils/kms';
vi.mock('@/utils/request', () => ({ default: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({ data: { keyId: id } });
});
it('uses only existing KMS endpoints and opts out of session request-body caching', async () => {
  const form = { alias: 'orders/demo', algorithm: 'SM4_128' as const, keyUsage: 'ENCRYPT_DECRYPT' as const, description: '' };
  expect(await createKey(form)).toEqual({ keyId: id });
  await describeKey(id);
  for (const action of ['rotate', 'enable', 'disable', 'cancel-deletion'] as const) await changeKeyState(id, action);
  await changeKeyState(id, 'schedule-deletion', 7);
  await encrypt(id, 'dGVzdA==', { purpose: 'test' });
  await decrypt(id, 'dGVzdA==', {});
  await generateDataKey(id, 'SM4_128', {});
  const calls = vi.mocked(request).mock.calls.map(([config]) => config);
  expect(calls.map((v) => v.url)).toEqual([
    '/kms/v1/keys',
    `/kms/v1/keys/${id}`,
    ...['rotate', 'enable', 'disable', 'cancel-deletion', 'schedule-deletion'].map((v) => `/kms/v1/keys/${id}/${v}`),
    '/kms/v1/crypto/encrypt',
    '/kms/v1/crypto/decrypt',
    '/kms/v1/data-keys'
  ]);
  expect(calls.every((v) => v.headers?.repeatSubmit === false && v.headers?.hideErrorNotify === true)).toBe(true);
  expect(calls[6].data).toEqual({ pendingWindowDays: 7 });
  expect(calls[7].data).toEqual({ keyId: id, plaintext: 'dGVzdA==', encryptionContext: { purpose: 'test' } });
});
it('rejects unsafe identifiers, invalid deletion windows and malformed crypto input before dispatch', () => {
  for (const value of ['../keys', 'alias/key', '', `${id}/enable`]) expect(() => requireKeyId(value)).toThrow();
  for (const days of [6, 31, 7.5, NaN]) expect(() => changeKeyState(id, 'schedule-deletion', days)).toThrow();
  for (const value of ['', 'not base64', 'A===', 'AB==']) expect(() => requireBase64(value, 4096)).toThrow();
  expect(() => requireBase64(btoa('x'.repeat(4097)), 4096)).toThrow();
  expect(requireBase64('dGVzdA==', 4096)).toBe('dGVzdA==');
  expect(parseEncryptionContext('')).toEqual({});
  expect(parseEncryptionContext('{"scope":"test"}')).toEqual({ scope: 'test' });
  for (const value of ['[]', 'null', '{"scope":1}', '{']) expect(() => parseEncryptionContext(value)).toThrow();
  expect(request).not.toHaveBeenCalled();
});
it('permits lifecycle actions only in their existing domain states', () => {
  expect(canRunAction('ENABLED', 'rotate')).toBe(true);
  expect(canRunAction('DISABLED', 'rotate')).toBe(false);
  expect(canRunAction('PRE_ACTIVE', 'enable')).toBe(true);
  expect(canRunAction('PENDING_DELETION', 'cancel-deletion')).toBe(true);
  expect(canRunAction('DESTROYED', 'schedule-deletion')).toBe(false);
  expect(canRunAction('COMPROMISED', 'enable')).toBe(false);
});
