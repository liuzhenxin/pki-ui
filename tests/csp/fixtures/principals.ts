export const roles = {
  administrator: ['csp:overview:read', 'csp:resources:read', 'csp:policies:change', 'csp:approvals:review'],
  operator: ['csp:overview:read', 'csp:resources:read', 'csp:resources:recover', 'csp:approvals:review'],
  keyOperator: ['csp:overview:read', 'csp:keys:read', 'csp:keys:generate', 'csp:approvals:review'],
  auditor: ['csp:overview:read', 'csp:audit:read', 'csp:evidence:export']
} as const;

export const principals = {
  initiator: { principalId: 'fixture-initiator', role: 'operator' },
  approverA: { principalId: 'fixture-approver-a', role: 'administrator' },
  approverB: { principalId: 'fixture-approver-b', role: 'operator' },
  conflicting: { principalId: 'fixture-initiator', roles: ['administrator', 'operator'], eligibleActions: [] }
} as const;
