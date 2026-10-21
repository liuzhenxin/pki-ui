import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeKmcEnvironment } from '../../src/utils/kmcEnvironment';
import { listUser, updateUserProfile } from '../../src/api/system/user';
import { submitKeyRecovery } from '../../src/api/kmc/keyRecovery';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));
vi.mock('@/utils/ruoyi', () => ({ parseStrEmpty: (value: unknown) => String(value ?? '') }));
beforeEach(() => mocks.request.mockReset());
describe('release runtime contracts', () => {
  it('reads boolean readiness statuses and preserves explicit failure', () => {
    const rows = normalizeKmcEnvironment([
      { name: 'device', status: true },
      { name: 'database', ok: false, status: 'success' }
    ]);
    expect(rows.map((row) => row.ok)).toEqual([true, false]);
  });
  it('accepts object readiness results and rejects truthy unrecognized statuses', () => {
    expect(normalizeKmcEnvironment({ device: true, db: { status: 'success' }, unknown: { ok: 'true' } }).map((row) => row.ok)).toEqual([
      true,
      true,
      false
    ]);
  });
  it('treats empty or malformed environment input as no evidence', () => {
    expect(normalizeKmcEnvironment(null)).toEqual([]);
    expect(normalizeKmcEnvironment('success')).toEqual([]);
  });
  it('preserves user pagination envelope and canonical search fields', async () => {
    const response = { code: 'OK', data: { records: [{ id: 9, username: 'test' }], total: 1 } };
    mocks.request.mockResolvedValue(response);
    expect(await listUser({ pageNum: 1, pageSize: 10, username: 'test', mobile: '123' })).toBe(response);
    expect(mocks.request.mock.calls[0][0].data).toEqual({ params: {}, pageNum: 1, pageSize: 10, username: 'test', mobile: '123' });
  });
  it('maps editable legacy profile contact fields to the platform command', () => {
    updateUserProfile({ mobile: 'old', mail: 'old@example.test', phonenumber: 'new', email: 'new@example.test' });
    expect(mocks.request.mock.calls[0][0].data).toEqual({ co: { mobile: 'new', mail: 'new@example.test' } });
  });
  it('submits archive recovery using the current target contract', () => {
    submitKeyRecovery({ targetType: 'ARCHIVE_KEY', targetId: 'archive-1' });
    expect(mocks.request.mock.calls[0][0]).toMatchObject({
      url: '/kmc/v1/key-recovery/submit',
      method: 'post',
      data: { targetType: 'ARCHIVE_KEY', targetId: 'archive-1' }
    });
  });
});
