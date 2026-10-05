import { principals, roles } from './principals';

export const profile = {
  code: 'OK',
  msg: 'ok',
  evidenceKind: 'mock',
  data: { id: principals.initiator.principalId, username: '合成运维主体', permissions: roles.operator, extValues: { tenantId: '10' } }
};
