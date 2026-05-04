export interface KmcCaVO {
  id: string | number;
  name: string;
  type?: string;
  status?: string;
  communicationCertPem?: string;
  certSubject?: string;
  certIssuer?: string;
  certSerialNumber?: string;
  certNotBefore?: string;
  certNotAfter?: string;
  certFingerprintSha256?: string;
  description?: string;
}

export interface KmcCaForm {
  id?: string | number;
  name: string;
  type?: string;
  status?: string;
  communicationCertPem?: string;
  certSubject?: string;
  certIssuer?: string;
  certSerialNumber?: string;
  certNotBefore?: string;
  certNotAfter?: string;
  certFingerprintSha256?: string;
  description?: string;
}

export interface KmcCaQuery extends PageQuery {
  name?: string;
  type?: string;
  status?: string;
}

export interface KmcCaIdentityVerifyForm {
  caId?: string | number;
  challenge: string;
  signatureBase64: string;
  algorithm?: string;
}

export interface KmcCaIdentityVerifyResult {
  caId: string | number;
  verified: boolean;
  algorithm?: string;
  certSubject?: string;
  certSerialNumber?: string;
  certFingerprintSha256?: string;
  message?: string;
}
