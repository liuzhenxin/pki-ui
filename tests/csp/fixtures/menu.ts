// Synthetic menu keys only; production menu ownership is frozen by plan 08-04.
export const navigation = [
  ['运行总览', 'overview'],
  ['密码能力', 'capabilities'],
  ['密码能力', 'capabilities/notices'],
  ['应用接入', 'access/apps'],
  ['应用接入', 'access/grants'],
  ['应用接入', 'access/identities'],
  ['物理密钥', 'keys'],
  ['物理密钥', 'keys/operations'],
  ['资源与路由', 'resources/providers'],
  ['资源与路由', 'resources/agents'],
  ['资源与路由', 'resources/devices'],
  ['资源与路由', 'resources/pools'],
  ['资源与路由', 'routing/policies'],
  ['资源与路由', 'routing/quotas'],
  ['审批中心', 'approvals/pending'],
  ['审批中心', 'approvals/mine'],
  ['审批中心', 'approvals/history'],
  ['对账中心', 'reconciliation/result-unknown'],
  ['对账中心', 'reconciliation/drift'],
  ['对账中心', 'reconciliation/history'],
  ['审计与证据', 'audit/operations'],
  ['审计与证据', 'audit/changes'],
  ['审计与证据', 'evidence'],
  ['系统设置', 'settings/observability'],
  ['系统设置', 'settings/evidence'],
  ['系统设置', 'settings/runtime-safety']
].map(([group, path]) => ({
  group,
  path: `/csp/${path}`,
  component: `csp/${path}${/^(approvals|reconciliation|audit|settings)\//.test(path) || path === 'capabilities/notices' ? '' : '/index'}`,
  hidden: false
}));

export const hiddenDetails = [
  'capabilities/:capabilityCode',
  'access/apps/:appId',
  'keys/:cspKeyId',
  'keys/operations/:operationId',
  'resources/providers/:providerId',
  'resources/agents/:agentId',
  'resources/devices/:deviceId',
  'resources/pools/:poolId',
  'routing/policies/:policyId',
  'approvals/:approvalId',
  'reconciliation/cases/:caseId',
  'audit/events/:eventId',
  'evidence/:exportId'
].map((path) => ({ path: `/csp/${path}`, hidden: true }));
