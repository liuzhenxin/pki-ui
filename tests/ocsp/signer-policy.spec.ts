import { describe, expect, it } from 'vitest';
import { signerPolicyLabel } from '../../src/utils/ocspSignerPolicy';

describe('signer policy decisions', () => {
  it('keeps absent and null diagnostics unvalidated, even with a stale reason', () => {
    expect(signerPolicyLabel()).toBe('未提供校验结果');
    expect(signerPolicyLabel(null, 'EXPIRED')).toBe('未提供校验结果');
  });
  it('shows an explicit pass or rejection without weakening the verdict', () => {
    expect(signerPolicyLabel(true)).toBe('通过');
    expect(signerPolicyLabel(false, 'EXPIRED')).toBe('EXPIRED');
    expect(signerPolicyLabel(false)).toBe('未通过');
  });
});
