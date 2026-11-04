import { beforeEach, expect, it, vi } from 'vitest';
import request from '@/utils/request';
import {
  completeKmsInitialization,
  confirmKmsInitializationStep,
  getKmsInitialization,
  getKmsInitializationPlan,
  recheckKmsInitialization,
  testKmsInitialization
} from '@/api/kms/initialization';
import { kmsInitializationRedirect, kmsInitializationRoute } from '@/utils/kmsInitializationRoute';
vi.mock('@/utils/request', () => ({ default: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({ data: { status: { revision: 5 } } });
});
it('uses compatible Result envelopes and keeps initialization evidence out of browser request caching', async () => {
  const command = {
    revision: 5,
    revisions: { device: 'd1' },
    accepted: true,
    agreementVersion: '2026-10-12',
    hostType: 'STANDALONE' as const,
    verificationId: 'e1',
    requestId: 'request-1111111111'
  };
  await getKmsInitialization();
  await getKmsInitializationPlan();
  await recheckKmsInitialization();
  expect(await confirmKmsInitializationStep(4, command)).toEqual({ status: { revision: 5 } });
  await confirmKmsInitializationStep(7, command);
  await testKmsInitialization(command);
  await completeKmsInitialization(command);
  expect(vi.mocked(request).mock.calls.map(([value]) => value.url)).toEqual([
    '/kms/v1/initialization',
    '/kms/v1/initialization/plan',
    '/kms/v1/initialization/checks',
    '/kms/v1/initialization/device/verify',
    '/kms/v1/initialization/accounts/verify',
    '/kms/v1/initialization/self-test',
    '/kms/v1/initialization/complete'
  ]);
  expect(vi.mocked(request).mock.calls.every(([value]) => value.headers?.repeatSubmit === false)).toBe(true);
  expect(() => confirmKmsInitializationStep(9, command)).toThrow();
});
it('keeps KMS initialization isolated and only locks from server state', () => {
  expect(kmsInitializationRoute.path).toBe('/kms');
  expect(kmsInitializationRedirect(false, '/kms/console')).toBe('/kms/init');
  expect(kmsInitializationRedirect(false, '/kms/init')).toBe('');
  expect(kmsInitializationRedirect(true, '/kms/init')).toBe('/index');
  expect(kmsInitializationRedirect(true, '/kms/console')).toBe('');
});
