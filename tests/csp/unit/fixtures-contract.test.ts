import { expect, test } from 'vitest';
import { principals, roles } from '../fixtures/principals';
import { profile } from '../fixtures/auth';
import { navigation, hiddenDetails } from '../fixtures/menu';
import { requirementScenarios, scenarios } from '../fixtures/api';

test('@fixtures-contract distinct principals and complete mock contract', () => {
  expect(new Set([principals.initiator.principalId, principals.approverA.principalId, principals.approverB.principalId]).size).toBe(3);
  expect(principals.conflicting.eligibleActions).toEqual([]);
  expect(Object.keys(roles)).toEqual(['administrator', 'operator', 'keyOperator', 'auditor']);
  expect(navigation.map((entry) => entry.path)).toEqual(
    [
      'overview',
      'capabilities',
      'capabilities/notices',
      'access/apps',
      'access/grants',
      'access/identities',
      'keys',
      'keys/operations',
      'resources/providers',
      'resources/agents',
      'resources/devices',
      'resources/pools',
      'routing/policies',
      'routing/quotas',
      'approvals/pending',
      'approvals/mine',
      'approvals/history',
      'reconciliation/result-unknown',
      'reconciliation/drift',
      'reconciliation/history',
      'audit/operations',
      'audit/changes',
      'evidence',
      'settings/observability',
      'settings/evidence',
      'settings/runtime-safety'
    ].map((path) => `/csp/${path}`)
  );
  expect(new Set(navigation.map((entry) => entry.component)).size).toBe(26);
  expect(hiddenDetails).toHaveLength(13);
  expect(hiddenDetails.every((entry) => entry.hidden && !navigation.some((menu) => menu.path === entry.path))).toBe(true);
  expect(navigation.every((entry) => !entry.hidden && !entry.path.includes(':'))).toBe(true);
  expect(Object.keys(requirementScenarios)).toEqual(['IAM-05', 'RES-01', 'RES-06', 'OPS-03', 'OPS-04', 'OPS-05', 'OPS-06', 'OPS-07']);
  for (const names of Object.values(requirementScenarios)) for (const name of names) expect(scenarios[name]).toBeDefined();
  expect(Object.keys(scenarios)).toEqual([
    'success',
    'accepted',
    'forbidden',
    'conflict',
    'precondition',
    'limited',
    'unavailable',
    'stale',
    'partial',
    'failClosed',
    'unknown',
    'approval0',
    'approval1',
    'approval2'
  ]);
  const data = JSON.stringify({ principals, roles, profile, navigation, hiddenDetails, scenarios, requirementScenarios });
  expect(data).not.toMatch(
    /password|passphrase|PIN|Bearer|JWT|accessToken|refreshToken|reauthProof|privateKey|keyMaterial|"slot"|"handle"|physicalIndex|providerKeyRef|https?:\/\//i
  );
});
