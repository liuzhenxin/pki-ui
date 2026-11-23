import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, saveUserWithCert } from '@/api/system/user';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));
vi.mock('@/utils/ruoyi', () => ({ parseStrEmpty: (value: unknown) => String(value ?? '') }));

const form = () => ({
  deptId: 301,
  username: 'manager',
  password: 'fixture-password',
  status: 0,
  postIds: [],
  roleIds: ['303']
});
const expected = () => ({ deptId: 301, username: 'manager', password: 'fixture-password', roleIds: ['303'] });

beforeEach(() => mocks.request.mockReset());

describe('legacy user creation matches the Admin creation contract', () => {
  it.each([0, '0', null])('omits client status %j and unsupported postIds from the reported KMC request', async (status) => {
    await addUser({ ...form(), status } as Parameters<typeof addUser>[0]);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith({
      url: '/admin/v1/users',
      method: 'post',
      data: { co: expected() }
    });
  });

  it('keeps allowed optional profile fields and removes account, certificate and audit fields', async () => {
    const profile = { mail: 'fixture@example.test', mobile: '13800000000', userCategory: 'user', avatar: '/avatar.png' };
    const input = {
      ...form(),
      ...profile,
      id: 9,
      superAdmin: 1,
      tenantId: 99,
      certSn: 'client-serial',
      cert: 'client-certificate',
      certPem: 'client-pem',
      createTime: 'client-time'
    };
    const original = structuredClone(input);
    await addUser(input);
    expect(mocks.request.mock.calls[0][0].data).toEqual({ co: { ...expected(), ...profile } });
    expect(input).toEqual(original);
  });

  it.each(['blob', 'string'])('filters the multipart %s command and preserves the certificate file', async (format) => {
    const data = new FormData();
    const json = JSON.stringify({ ...form(), cert: 'client-override', superAdmin: 1 });
    data.append('co', format === 'blob' ? new Blob([json], { type: 'application/json' }) : json);
    data.append('file', new Blob(['fixture-public-certificate']), 'certificate.pem');
    const originalCo = data.get('co');
    const originalFile = data.get('file');

    await saveUserWithCert(data);

    expect(mocks.request).toHaveBeenCalledTimes(1);
    const sent = mocks.request.mock.calls[0][0];
    expect(sent.url).toBe('/admin/v1/users/cert/save');
    expect(sent.method).toBe('post');
    expect([...sent.data.keys()]).toEqual(['co', 'file']);
    const co = sent.data.get('co') as Blob;
    expect(co.type).toBe('application/json');
    expect(JSON.parse(await co.text())).toEqual(expected());
    expect(sent.data.get('file')).toBe(originalFile);
    expect(data.get('co')).toBe(originalCo);
  });

  it.each([null, 'not-json', 'null', '[]'])('does not send a malformed multipart command: %j', async (co) => {
    const data = new FormData();
    if (co !== null) data.append('co', co);
    await expect(saveUserWithCert(data)).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
