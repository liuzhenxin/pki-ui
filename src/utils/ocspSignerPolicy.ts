/** Only an explicit boolean is a completed signer-policy decision. */
export const signerPolicyLabel = (ok?: boolean | null, rejectionCode?: string | null): string =>
  ok === true ? '通过' : ok === false ? rejectionCode || '未通过' : '未提供校验结果';
