import type { ApplicationAuthorizationContext } from '@/api/system/applicationAuthorization';

export const allowedCreateDepartments = (context: ApplicationAuthorizationContext, roleIds: string[]) => {
  if (
    context.mode !== 'ENFORCE' ||
    !context.actions.includes('CREATE_USER') ||
    roleIds.length === 0 ||
    (!context.multiRoleEnabled && roleIds.length !== 1) ||
    new Set(roleIds).size !== roleIds.length
  )
    return [];
  const departments = [...new Set(context.createCandidates.map((item) => item.departmentId))];
  return departments.filter((departmentId) =>
    roleIds.every((roleId) => context.createCandidates.some((item) => item.roleId === roleId && item.departmentId === departmentId))
  );
};

export const canSubmitUserAction = (
  context: ApplicationAuthorizationContext | undefined,
  action: string,
  roleIds: string[] = [],
  departmentId?: string
) => {
  if (!context || context.mode !== 'ENFORCE' || !context.actions.includes(action)) return false;
  if (action === 'CREATE_USER') return allowedCreateDepartments(context, roleIds).includes(departmentId ?? '');
  if (action === 'ASSIGN_ROLES')
    return (
      context.roleChangeEnabled &&
      roleIds.length > 0 &&
      (context.multiRoleEnabled || roleIds.length === 1) &&
      new Set(roleIds).size === roleIds.length &&
      roleIds.every((id) => context.assignableRoleIds.includes(id))
    );
  return true;
};
