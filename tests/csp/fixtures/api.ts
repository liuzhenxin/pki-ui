export const scenarios = {
  success: { status: 200, state: 'HEALTHY' },
  accepted: { status: 202, state: 'PENDING' },
  forbidden: { status: 403, state: 'DENIED' },
  conflict: { status: 409, state: 'CONFLICT' },
  precondition: { status: 412, state: 'VERSION_MISMATCH' },
  limited: { status: 429, state: 'RATE_LIMITED' },
  unavailable: { status: 503, state: 'UNAVAILABLE' },
  stale: { status: 200, state: 'STALE' },
  partial: { status: 200, state: 'PARTIAL' },
  failClosed: { status: 503, state: 'FAIL_CLOSED' },
  unknown: { status: 202, state: 'RESULT_UNKNOWN' },
  approval0: { status: 200, state: 'PENDING', approved: 0, required: 2 },
  approval1: { status: 200, state: 'PENDING', approved: 1, required: 2 },
  approval2: { status: 200, state: 'APPROVED', approved: 2, required: 2 }
} as const;
export const requirementScenarios = {
  'IAM-05': ['approval0', 'approval1', 'approval2', 'forbidden'],
  'RES-01': ['success', 'unavailable'],
  'RES-06': ['failClosed', 'partial'],
  'OPS-03': ['success'],
  'OPS-04': ['conflict', 'precondition'],
  'OPS-05': ['stale', 'limited'],
  'OPS-06': ['unknown'],
  'OPS-07': ['accepted']
} as const;
