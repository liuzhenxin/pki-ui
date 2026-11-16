import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { addAuditorUser, deleteAuditorUsers, getAuditorUser, listAuditorUsers, updateAuditorUser } from '@/api/ra/auditorUser';
import request from '@/utils/request';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));

it('uses the scoped auditor account endpoints for each management operation', async () => {
  const id = '117471603637354498';
  const query = { pageNum: 1, pageSize: 10, username: 'auditor' };
  const form = { username: 'auditor', deptId: '10', password: 'test-password', status: 0, roleIds: ['506'], postIds: [] };
  const change = { ...form, id, username: 'updated-auditor', password: '' };
  const url = '/ra/v1/auditor-users';

  await listAuditorUsers(query);
  await addAuditorUser(form);
  await getAuditorUser(id);
  await updateAuditorUser(change);
  await deleteAuditorUsers(id);

  expect(vi.mocked(request).mock.calls.map(([options]) => options)).toEqual([
    { url: url + '/page', method: 'post', data: query },
    { url, method: 'post', data: { co: form } },
    { url: url + '/' + id, method: 'get' },
    { url, method: 'put', data: { co: change } },
    { url, method: 'delete', data: [id] }
  ]);
});

it('connects the audit manager view to the scoped API', () => {
  const view = readFileSync(new URL('../../src/views/ra/audit/index.vue', import.meta.url), 'utf8');

  expect(view).toContain("from '@/api/ra/auditorUser'");
  expect(view).not.toContain("from '@/api/ra/user'");
});
