import { describe, it, expect, vi, beforeEach } from 'vitest';
import { allowedCreateDepartments, canSubmitUserAction } from '../../src/utils/applicationAuthorization';
import {
  getApplicationAuthorizationContext,
  submitUserAction,
  submitRoleAction,
  type ApplicationAuthorizationContext
} from '../../src/api/system/applicationAuthorization';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));
const context: ApplicationAuthorizationContext = {
  mode: 'ENFORCE',
  policyVersion: '1',
  authzEpoch: '9007199254740993',
  multiRoleEnabled: false,
  customRoleEnabled: false,
  roleChangeEnabled: false,
  actions: ['CREATE_USER', 'UPDATE_PROFILE', 'SET_STATUS', 'RESET_PASSWORD', 'DELETE_USER', 'ASSIGN_ROLES'],
  createCandidates: [
    { roleId: '2001', departmentId: '1001' },
    { roleId: '2002', departmentId: '1002' }
  ],
  assignableRoleIds: ['2001']
};
beforeEach(() => {
  mocks.request.mockReset();
});
describe('current application UI contract', () => {
  it('missing capabilities fail closed', () => {
    expect(canSubmitUserAction(undefined, 'CREATE_USER')).toBe(false);
  });
  it('legacy hints cannot authorize writes', () => {
    expect(canSubmitUserAction({ ...context, mode: 'LEGACY' }, 'UPDATE_PROFILE')).toBe(false);
  });
  it('single role capability rejects multiple selections', () => {
    expect(allowedCreateDepartments(context, ['2001', '2002'])).toEqual([]);
  });
  it('departments are intersection of allowed pairs', () => {
    expect(allowedCreateDepartments({ ...context, multiRoleEnabled: true }, ['2001', '2002'])).toEqual([]);
  });
  it('duplicate or unknown roles cannot be submitted', () => {
    expect(allowedCreateDepartments(context, ['2001', '2001'])).toEqual([]);
    expect(allowedCreateDepartments(context, ['9999'])).toEqual([]);
  });
  it('role change requires declared capability', () => {
    expect(canSubmitUserAction(context, 'ASSIGN_ROLES', ['2001'])).toBe(false);
  });
  it('role change stays within candidate IDs', () => {
    expect(canSubmitUserAction({ ...context, roleChangeEnabled: true }, 'ASSIGN_ROLES', ['9999'])).toBe(false);
  });
  it('profile submit cannot send hidden role/status/security fields', async () => {
    await submitUserAction('UPDATE_PROFILE', {
      id: '7',
      mobile: 'test',
      roleIds: ['1'],
      status: 1,
      superAdmin: 1,
      tenantId: '999',
      password: 'sensitive'
    });
    expect(mocks.request.mock.calls[0][0].data).toEqual({ co: { id: '7', mobile: 'test' } });
  });
  it('status and roles have independent atomic requests', async () => {
    await submitUserAction('SET_STATUS', { id: '7', status: 1, roleIds: ['1'] });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[0][0]).toMatchObject({ url: '/admin/v1/users/status', data: { co: { id: '7', status: 1 } } });
  });
  it('creation has no status/protection/tenant payload', async () => {
    await submitUserAction('CREATE_USER', {
      username: 'fixture',
      password: 'fixture',
      deptId: '1001',
      roleIds: ['2001'],
      status: 0,
      tenantId: '999',
      origin: 'BUILTIN'
    });
    expect(mocks.request.mock.calls[0][0].data.co).toEqual({ username: 'fixture', password: 'fixture', deptId: '1001', roleIds: ['2001'] });
  });
  it('unimplemented actions never return fake success', () => {
    expect(() => submitUserAction('IMPORT_USERS', {})).toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('malformed remote context is not replaced with fixed roles', async () => {
    mocks.request.mockResolvedValue({ data: {} });
    await expect(getApplicationAuthorizationContext()).rejects.toThrow();
  });
  it('HTTP denial propagates for refresh rather than partial save', async () => {
    mocks.request.mockImplementation(() => Promise.reject({ response: { status: 403 } }));
    let failure: unknown;
    try {
      await submitUserAction('ASSIGN_ROLES', { id: '7', roleIds: ['2001'] });
    } catch (error) {
      failure = error;
    }
    expect(failure).toEqual({ response: { status: 403 } });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});

describe('role and capability boundaries', () => {
  it('role metadata sends no menu, scope, publication or tenant fields', async () => {
    await submitRoleAction('UPDATE_ROLE_METADATA', {
      id: '7',
      name: 'Role',
      sort: 1,
      menuIds: ['1'],
      dataScope: 'all',
      tenantId: '9',
      publicationState: 'ACTIVE'
    });
    expect(mocks.request.mock.calls[0][0].data).toEqual({ co: { id: '7', name: 'Role', sort: 1 } });
  });
  it('role creation cannot choose an ID or active state', async () => {
    await submitRoleAction('CREATE_ROLE', { id: '7', name: 'Role', sort: 1, publicationState: 'ACTIVE' });
    expect(mocks.request.mock.calls[0][0].data).toEqual({ co: { name: 'Role', sort: 1 } });
  });
  it('role import/export have no write route', () => {
    expect(() => submitRoleAction('IMPORT_ROLES', {})).toThrow();
    expect(() => submitRoleAction('EXPORT_ROLES', {})).toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it.each([{ multiRoleEnabled: 'false' }, { authzEpoch: 9007199254740993 }, { createCandidates: [{ roleId: 7, departmentId: '1' }] }])(
    'malformed capabilities fail closed: %j',
    async (invalid) => {
      mocks.request.mockResolvedValue({ data: { ...context, ...invalid } });
      await expect(getApplicationAuthorizationContext()).rejects.toThrow();
    }
  );
});

describe('certificate binding payload', () => {
  it('sends one multipart binding with target and public file only', async () => {
    const file = new Blob(['fixture-public-certificate'], { type: 'application/x-pem-file' });
    await submitUserAction('BIND_CERTIFICATE', { id: '7', file, roleIds: ['9'], tenantId: '999' });
    const request = mocks.request.mock.calls[0][0];
    expect(request.url).toBe('/admin/v1/users/cert');
    expect([...request.data.keys()]).toEqual(['id', 'file']);
    expect(request.data.get('id')).toBe('7');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('invalid file or target never sends a request', () => {
    expect(() => submitUserAction('BIND_CERTIFICATE', { id: '7', file: 'private-input' })).toThrow();
    expect(() => submitUserAction('BIND_CERTIFICATE', { id: '0', file: new Blob(['public']) })).toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
