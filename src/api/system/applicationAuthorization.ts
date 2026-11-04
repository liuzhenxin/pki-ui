import request from '@/utils/request';

export interface ApplicationAuthorizationContext {
  mode: 'LEGACY' | 'SHADOW' | 'ENFORCE';
  policyVersion: string;
  authzEpoch: string;
  multiRoleEnabled: boolean;
  customRoleEnabled: boolean;
  roleChangeEnabled: boolean;
  actions: string[];
  createCandidates: { roleId: string; departmentId: string }[];
  assignableRoleIds: string[];
}

const checkedContext = (value: unknown): ApplicationAuthorizationContext => {
  const context = value as ApplicationAuthorizationContext;
  const id = (value: unknown) => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
  const revision = (value: unknown) => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
  if (
    !context ||
    !['LEGACY', 'SHADOW', 'ENFORCE'].includes(context.mode) ||
    !revision(context.policyVersion) ||
    !revision(context.authzEpoch) ||
    typeof context.multiRoleEnabled !== 'boolean' ||
    typeof context.customRoleEnabled !== 'boolean' ||
    typeof context.roleChangeEnabled !== 'boolean' ||
    !Array.isArray(context.actions) ||
    !context.actions.every((action) => typeof action === 'string') ||
    !Array.isArray(context.createCandidates) ||
    !context.createCandidates.every((pair) => pair && id(pair.roleId) && id(pair.departmentId)) ||
    !Array.isArray(context.assignableRoleIds) ||
    !context.assignableRoleIds.every(id)
  ) {
    throw new Error('无法读取当前应用的管理权限');
  }
  return context;
};

export const getApplicationAuthorizationContext = async (userId?: string) => {
  const response = await request({ url: '/admin/v1/application-authorization/ui-context', method: 'get', params: { userId } });
  return checkedContext(response.data);
};

export const listAssignableRoles = async () => {
  const response = await request({ url: '/admin/v1/roles/list', method: 'post', data: {} });
  return (response.data ?? []) as { id: string; name: string }[];
};

// 白名单在发送边界落实；不把详情CO、页面状态或权限版本回传为写入依据。
export const submitUserAction = (action: string, form: Record<string, unknown>) => {
  const routes: Record<string, { method: 'post' | 'put' | 'delete'; path: string; fields: string[] }> = {
    CREATE_USER: { method: 'post', path: '', fields: ['username', 'password', 'mobile', 'mail', 'deptId', 'roleIds'] },
    UPDATE_PROFILE: { method: 'put', path: '', fields: ['id', 'mobile', 'mail'] },
    SET_STATUS: { method: 'put', path: '/status', fields: ['id', 'status'] },
    RESET_PASSWORD: { method: 'put', path: '/reset-pwd', fields: ['id', 'password'] },
    ASSIGN_ROLES: { method: 'put', path: '/authority', fields: ['id', 'roleIds'] }
  };
  if (action === 'BIND_CERTIFICATE') {
    if (!(form.file instanceof Blob) || typeof form.id !== 'string' || !/^[1-9][0-9]*$/.test(form.id)) throw new Error('请选择有效证书与目标');
    const data = new FormData();
    data.append('id', form.id);
    data.append('file', form.file);
    return request({ url: '/admin/v1/users/cert', method: 'post', data });
  }
  if (action === 'DELETE_USER') {
    return request({ url: '/admin/v1/users', method: 'delete', data: [form.id] });
  }
  if (action === 'UNLOCK_LOGIN') {
    return request({ url: `/admin/v1/users/${encodeURIComponent(String(form.id))}/login-lock`, method: 'put', data: { locked: false } });
  }
  const route = routes[action];
  if (!route) throw new Error('该管理操作尚未启用');
  const co = Object.fromEntries(route.fields.filter((key) => form[key] !== undefined).map((key) => [key, form[key]]));
  return request({
    url: '/admin/v1/users' + route.path,
    method: route.method,
    data: { co },
    headers: action === 'RESET_PASSWORD' || action === 'CREATE_USER' ? { isEncrypt: true, repeatSubmit: false } : {}
  });
};

export const getApplicationRoleContext = async (roleId: string) => {
  const response = await request({ url: '/admin/v1/application-authorization/role-ui-context', method: 'get', params: { roleId } });
  const context = checkedContext(response.data);
  if (context.mode !== 'ENFORCE') throw new Error('授权模式已变化，请重新打开页面');
  return context;
};

export const submitRoleAction = (action: string, form: Record<string, unknown>) => {
  if (action === 'DELETE_ROLE') return request({ url: '/admin/v1/roles', method: 'delete', data: [form.id] });
  if (action !== 'CREATE_ROLE' && action !== 'UPDATE_ROLE_METADATA') throw new Error('该角色操作尚未启用');
  const fields = action === 'CREATE_ROLE' ? ['name', 'sort'] : ['id', 'name', 'sort'];
  const co = Object.fromEntries(fields.filter((key) => form[key] !== undefined).map((key) => [key, form[key]]));
  return request({ url: '/admin/v1/roles', method: action === 'CREATE_ROLE' ? 'post' : 'put', data: { co } });
};
