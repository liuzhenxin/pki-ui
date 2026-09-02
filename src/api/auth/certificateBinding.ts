import request from '@/utils/request';

export interface CertificateBinding {
  bound: boolean;
  id?: string | number;
  status?: string;
  subjectDn?: string;
  issuerDn?: string;
  serialNumber?: string;
  fingerprintSha256?: string;
  signatureAlgorithm?: string;
  publicKeyAlgorithm?: string;
  notBefore?: string;
  notAfter?: string;
  bindTime?: string;
  updateTime?: string;
}

export interface CertificateBindingCandidate {
  candidateId: string;
  challengeId: string;
  signData: string;
  signatureAlgorithm: string;
  signatureFormat: string;
  sm2UserId: string;
  expiresIn: number;
  subjectDn: string;
  issuerDn: string;
  serialNumber: string;
  fingerprintSha256: string;
  publicKeyAlgorithm: string;
  notBefore: string;
  notAfter: string;
}

export const getCurrentCertificateBinding = () => {
  return request<CertificateBinding>({
    url: '/auth/v1/certificate-bindings/me',
    method: 'get'
  });
};

export const createCertificateBindingCandidate = (file: File) => {
  const data = new FormData();
  data.append('file', file);
  return request<CertificateBindingCandidate>({
    url: '/auth/v1/certificate-bindings/me/candidates',
    method: 'post',
    data
  });
};

export const verifyCertificateBindingCandidate = (data: { candidateId: string; challengeId: string; signature: string; password: string }) => {
  return request<CertificateBinding>({
    url: '/auth/v1/certificate-bindings/me/verifications',
    method: 'post',
    headers: {
      isEncrypt: 'true',
      repeatSubmit: false
    },
    data
  });
};
