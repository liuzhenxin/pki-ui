import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from '@/utils/request';
import { getAdminUserAuthRole, updateAdminUserAuthority } from '@/api/ra/adminUser';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));
vi.mock('@/utils/ruoyi', () => ({ parseStrEmpty: (value: unknown) => value }));

const send = vi.mocked(request);

describe('RA business user authorization', () => {
  beforeEach(() => send.mockReset());

  it('offers only server-supported roles when selecting all and preselects the assigned role', async () => {
    send.mockResolvedValueOnce({ data: { id: '117471603637354498', username: 'operator', roleIds: [503] } });
    send.mockResolvedValueOnce({ data: [503, 504, 505] });

    const { data } = await getAdminUserAuthRole('117471603637354498');

    expect(data.roles.map((role: { roleId: string }) => role.roleId)).toEqual(['503', '504', '505']);
    expect(data.roles.filter((role: { flag: boolean }) => role.flag).map((role: { roleId: string }) => role.roleId)).toEqual(['503']);
  });

  it('offers 507 only when the server includes it in the current administrator’s assignable roles', async () => {
    send.mockResolvedValueOnce({ data: { id: '117471603637354498', username: 'manager', roleIds: [507] } });
    send.mockResolvedValueOnce({ data: [503, 504, 505, 507] });
    const { data } = await getAdminUserAuthRole('117471603637354498');
    expect(data.roles.find((role: { roleId: string }) => role.roleId === '507')?.flag).toBe(true);
  });

  it('saves the selected role and a single mail profile in one request', async () => {
    send.mockResolvedValue({ code: 'OK' });

    await updateAdminUserAuthority('117471603637354498', ['503'], [{ rootId: '2', profileIds: ['9'] }]);

    expect(send).toHaveBeenCalledExactlyOnceWith({
      url: '/ra/v1/admin-users/authority-and-scope',
      method: 'put',
      data: {
        co: { id: '117471603637354498', roleIds: ['503'] },
        roots: [{ rootId: '2', profileIds: ['9'] }]
      }
    });
  });
});
