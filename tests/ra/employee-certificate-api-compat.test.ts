import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from '@/utils/request';
import { grantPublicCertPermissions, revokePublicCertPermissions } from '../../src/api/ra/publicCert';
import { getLegacyEmployeeCertificate } from '../../src/api/ra/legacyEmployeeCert';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
const send = vi.mocked(request);
const permissions = '/ra/v1/public-certs/permissions';

function routeError(status: number, code?: string) {
  return new AxiosError('接口错误', code, undefined, undefined, { status, data: { code } } as never);
}

describe('employee certificate APIs across RA versions', () => {
  beforeEach(() => send.mockReset());

  it('falls back to single POST requests when the legacy router only allows DELETE for batch', async () => {
    const commands = [{ employeeId: 12 }, { employeeId: 34 }];
    send.mockRejectedValueOnce(routeError(200, 'Method_Not_Allowed')).mockResolvedValue({});
    await grantPublicCertPermissions(commands);
    expect(send.mock.calls.map(([req]) => [req.url, req.method, req.data])).toEqual([
      [permissions + '/batch', 'post', commands],
      [permissions, 'post', commands[0]],
      [permissions, 'post', commands[1]]
    ]);
  });

  it('uses DELETE for each selected authorization on an older RA', async () => {
    send.mockRejectedValueOnce(routeError(405)).mockResolvedValue({});
    await revokePublicCertPermissions([44, 55]);
    expect(send.mock.calls.map(([req]) => [req.url, req.method])).toEqual([
      [permissions + '/batch-revoke', 'post'],
      [permissions + '/44', 'delete'],
      [permissions + '/55', 'delete']
    ]);
    send.mockClear();
    await revokePublicCertPermissions([44]);
    expect(send.mock.calls.map(([req]) => [req.url, req.method])).toEqual([[permissions + '/44', 'delete']]);
  });

  it('uses only the batch endpoints on a current RA', async () => {
    send.mockResolvedValue({});
    await grantPublicCertPermissions([{ employeeId: 12 }, { employeeId: 34 }]);
    await revokePublicCertPermissions([44, 55]);
    expect(send.mock.calls.map(([req]) => req.url)).toEqual([permissions + '/batch', permissions + '/batch-revoke']);
  });

  it('does not replay writes on access errors or timeouts', async () => {
    const denied = routeError(403);
    send.mockRejectedValueOnce(denied);
    await expect(grantPublicCertPermissions([{ employeeId: 12 }])).rejects.toBe(denied);
    const timeout = new AxiosError('timeout', 'ECONNABORTED');
    send.mockRejectedValueOnce(timeout);
    await expect(revokePublicCertPermissions([44, 55])).rejects.toBe(timeout);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('uses the employee ledger certificate detail when the legacy detail route returns 404', async () => {
    const detail = { data: { cert: 'test public certificate' } };
    send.mockRejectedValueOnce(routeError(404)).mockResolvedValueOnce(detail);
    await expect(getLegacyEmployeeCertificate('123')).resolves.toBe(detail);
    expect(send.mock.calls.map(([req]) => req.url)).toEqual([
      '/ra/v1/employee-certs/legacy/123/certificate',
      '/ra/v1/employee-certs/123/certificate'
    ]);
  });
});
