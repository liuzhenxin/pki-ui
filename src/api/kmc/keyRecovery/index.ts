import request from '@/utils/request';

export type KeyRecoveryTargetType = 'USED_KEY' | 'ARCHIVE_KEY';
export type KeyRecoveryMediaType = 'FILE' | 'USB_KEY';

export interface KeyRecoverySubmitPayload {
  targetType: KeyRecoveryTargetType;
  targetId: string | number;
  operator?: string;
  operatorIp?: string;
  operatorUkeySn?: string;
  reason?: string;
  recoveryScene?: string;
  caseNo?: string;
  applicantOrg?: string;
  contact?: string;
  authorizationMaterial?: string;
  requiredApprovers?: number;
  expiresAt?: string;
  approvers?: KeyRecoveryApproverPayload[];
}

export interface KeyRecoveryApproverPayload {
  approverId: string | number;
  approverName: string;
  credentialNo?: string;
}

export interface KeyRecoveryExecutePayload {
  judgeId: string | number;
  targetType: KeyRecoveryTargetType;
  targetId: string | number;
  mediaType: KeyRecoveryMediaType;
  operator?: string;
  operatorIp?: string;
  operatorUkeySn?: string;
  filePassword?: string;
  skfEndpoint?: string;
  providerAlias?: string;
  deviceName?: string;
  appName?: string;
  containerName?: string;
  pin?: string;
  usbEncryptedKeyPairBase64?: string;
  usbWrapKeyBase64?: string;
  usbSm4Mode?: string;
  certificate?: string;
}

export interface KeyRecoveryApproveParams {
  judgeId: string | number;
  approverId: string | number;
  approverName?: string;
  approverIp?: string;
  approverUkeySn?: string;
  comment?: string;
  caseChecked?: boolean;
  legalBasisConfirmed?: boolean;
  auditAware?: boolean;
}

export interface KeyRecoveryDetail {
  judgeId: string | number;
  targetType: KeyRecoveryTargetType;
  targetId: string | number;
  keyType?: string;
  keyBits?: number;
  serialNumber?: string;
  subject?: string;
  recoveryStatus?: string;
  reason?: string;
  recoveryScene?: string;
  caseNo?: string;
  applicantOrg?: string;
  applicant?: string;
  contact?: string;
  authorizationMaterial?: string;
  requiredApprovers?: number;
  totalApprovers?: number;
  approvedCount?: number;
  rejectedCount?: number;
  pendingCount?: number;
  expiresAt?: string;
  thresholdPassed?: boolean;
  canRecover?: boolean;
  recovered?: boolean;
  result?: any;
  approvers?: KeyRecoveryApproverStatus[];
  audits?: KeyRecoveryAudit[];
}

export interface KeyRecoveryApproverStatus {
  approverId: string | number;
  approverName: string;
  credentialNo?: string;
  status?: string;
  reason?: string;
  comment?: string;
  approverIp?: string;
  approverUkeySn?: string;
  approvalTime?: string;
}

export interface KeyRecoveryAudit {
  time?: string;
  operator?: string;
  role?: string;
  action?: string;
  result?: string;
  remark?: string;
}

export const submitKeyRecovery = (data: KeyRecoverySubmitPayload) => {
  return request({
    url: '/kmc/v1/key-recovery/submit',
    method: 'post',
    data
  });
};

export const approveKeyRecovery = (params: KeyRecoveryApproveParams) => {
  return request({
    url: '/kmc/v1/key-recovery/sign',
    method: 'post',
    data: params
  });
};

export const rejectKeyRecovery = (params: KeyRecoveryApproveParams) => {
  return request({
    url: '/kmc/v1/key-recovery/reject',
    method: 'post',
    data: params
  });
};

export const cancelKeyRecovery = (judgeId: string | number) => {
  return request({
    url: `/kmc/v1/key-recovery/cancel/${judgeId}`,
    method: 'delete'
  });
};

export const recoverKey = (data: KeyRecoveryExecutePayload) => {
  return request({
    url: '/kmc/v1/key-recovery/recover',
    method: 'post',
    data
  });
};

export const recoverArchiveKey = (archiveKeyId: string | number, judgeId: string | number) => {
  return recoverKey({
    judgeId,
    targetType: 'ARCHIVE_KEY',
    targetId: archiveKeyId,
    mediaType: 'FILE'
  });
};

export const getKeyRecoveryStatus = (judgeId: string | number) => {
  return request({
    url: `/kmc/v1/key-recovery/status/${judgeId}`,
    method: 'get'
  });
};

export const getKeyRecoveryDetail = (judgeId: string | number) => {
  return request({
    url: `/kmc/v1/key-recovery/detail/${judgeId}`,
    method: 'get'
  });
};
