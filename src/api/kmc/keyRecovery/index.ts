import request from '@/utils/request';

export interface KeyRecoveryApproveParams {
  judgeId: string | number;
  operator: string;
  operatorIp: string;
  operatorUkeySn: string;
  reason?: string;
}

export const submitKeyRecovery = (archiveKeyId: string | number) => {
  return request({
    url: '/kmc/v1/key-recovery/submit',
    method: 'post',
    params: { archiveKeyId }
  });
};

export const approveKeyRecovery = (params: KeyRecoveryApproveParams) => {
  return request({
    url: '/kmc/v1/key-recovery/approve',
    method: 'post',
    params
  });
};

export const rejectKeyRecovery = (params: KeyRecoveryApproveParams) => {
  return request({
    url: '/kmc/v1/key-recovery/reject',
    method: 'post',
    params
  });
};

export const cancelKeyRecovery = (judgeId: string | number) => {
  return request({
    url: `/kmc/v1/key-recovery/cancel/${judgeId}`,
    method: 'delete'
  });
};

export const recoverArchiveKey = (archiveKeyId: string | number, judgeId: string | number) => {
  return request({
    url: '/kmc/v1/key-recovery/recover',
    method: 'post',
    params: { archiveKeyId, judgeId }
  });
};

export const getKeyRecoveryStatus = (judgeId: string | number) => {
  return request({
    url: `/kmc/v1/key-recovery/status/${judgeId}`,
    method: 'get'
  });
};

