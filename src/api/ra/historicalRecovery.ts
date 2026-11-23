import request from '@/utils/request';
import type { HistoricalRecoveryRequest, HistoricalRecoveryTask, RecoveryConfirmation, SignedDevicePayload } from '@/api/ca/historicalRecovery';
import type { Result } from '@/api/types';

const headers = { sensitive: true, repeatSubmit: false, hideErrorNotify: true };

function recoveryPath(certId: string) {
  return `/ra/v1/certs/${encodeURIComponent(certId)}/historical-recoveries`;
}

export function isRaArchiveRecoveryAvailable(certId: string) {
  return request<unknown, Result<boolean>>({ url: `${recoveryPath(certId)}/archive-availability`, method: 'get', headers });
}

export function submitRaHistoricalRecovery(certId: string, data: HistoricalRecoveryRequest) {
  return request<unknown, Result<HistoricalRecoveryTask>>({ url: recoveryPath(certId), method: 'post', headers, data });
}

export function getRaHistoricalRecovery(certId: string, recoveryId: string) {
  return request<unknown, Result<HistoricalRecoveryTask>>({
    url: `${recoveryPath(certId)}/${encodeURIComponent(recoveryId)}`,
    method: 'get',
    headers
  });
}

export function confirmRaHistoricalRecovery(certId: string, data: RecoveryConfirmation) {
  return request<unknown, Result<HistoricalRecoveryTask>>({
    url: `${recoveryPath(certId)}/${encodeURIComponent(data.recoveryId)}/confirm-delivery`,
    method: 'post',
    headers,
    data
  });
}

export interface RaSkfDelivery {
  recoveryId: string;
  applicationNo: string;
  originalCertificateDerBase64: string;
  envelopeFormat: 'SKF-RSA-IMPORT-ENVELOPE-V1';
  symmetricMode: 'ECB';
  encryptedPrivateKey: string;
  wrapKey: string;
}

export interface RaSkfClaim {
  recoveryId: string;
  proof: SignedDevicePayload<{ recoveryId: string; claimId: string; issuedAt: string; wrappingSpkiSha256: string }>;
}

export function claimRaSkfDelivery(certId: string, data: RaSkfClaim) {
  return request<unknown, Result<RaSkfDelivery>>({
    url: `${recoveryPath(certId)}/${encodeURIComponent(data.recoveryId)}/ra-skf-delivery`,
    method: 'post',
    headers,
    data
  });
}
