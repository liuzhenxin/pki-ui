import request from '@/utils/request';
import type { Result } from '@/api/types';

export const historicalRecoveryPermission = 'ca:cert:historical-recover';

export interface SignedDevicePayload<T = Record<string, string>> {
  payload: T;
  signatureBase64: string;
}

export interface RecoveryDeviceBinding {
  bindingId: string;
  issuedAt: string;
  clientCertSha256: string;
  deviceId: string;
  recipientId: string;
  ticketNo: string;
  wrappingSpkiSha256: string;
}

export interface RecoveryDeviceFile {
  wrappingCsrBase64: string;
  deviceBinding: SignedDevicePayload<RecoveryDeviceBinding>;
}

export interface ArchiveRecoveryRequest extends RecoveryDeviceFile {
  clientRequestNo: string;
  certificateRef: { source: 'ARCHIVE'; id: string };
  ticketNo: string;
  reason: string;
  authorizationRef: string;
  mode: 'DEVICE_DELIVERY';
  recipientId: string;
  deviceId: string;
}

export interface RecoveryConfirmation {
  recoveryId: string;
  deliveryReceipt: SignedDevicePayload;
}

export interface HistoricalRecoveryTask {
  recoveryId: string;
  applicationNo: string;
  status: 'QUEUED' | 'EXECUTING' | 'PENDING_CONFIRMATION' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  updatedAt: string;
  expiresAt: string;
  confirmBy?: string;
  reasonCode?: string;
  receiptSha256?: string;
  deviceStateUncertain?: boolean;
}

const path = '/ca/v1/cert-historical-recoveries';
const headers = { sensitive: true, repeatSubmit: false, hideErrorNotify: true };

export function submitArchiveRecovery(data: ArchiveRecoveryRequest) {
  return request<unknown, Result<HistoricalRecoveryTask>>({ url: path, method: 'post', headers, data });
}

export function getHistoricalRecovery(recoveryId: string) {
  return request<unknown, Result<HistoricalRecoveryTask>>({ url: `${path}/${encodeURIComponent(recoveryId)}`, method: 'get', headers });
}

export function confirmHistoricalRecovery(data: RecoveryConfirmation) {
  return request<unknown, Result<HistoricalRecoveryTask>>({
    url: `${path}/${encodeURIComponent(data.recoveryId)}/confirm-delivery`,
    method: 'post',
    headers,
    data
  });
}
