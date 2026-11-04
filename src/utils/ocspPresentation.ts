import { X509 } from 'jsrsasign';

export const responderStatusLabel = (status?: string) => (status === 'ACTIVE' ? '已启用' : status === 'INACTIVE' ? '已停用' : status || '未提供');
const signerLabels: Record<string, string> = { SOFTWARE: '软件签名', HSM: '硬件签名', SDF: 'SDF 硬件签名' };
export const signerTypeLabel = (type?: string) => signerLabels[type || ''] || type || '未提供';

export const parseCertificateTime = (value: string): Date | null => {
  if (!/^(?:\d{12}|\d{14})Z$/.test(value)) return null;
  const short = value.length === 13;
  const year = short ? Number(value.slice(0, 2)) + (Number(value.slice(0, 2)) >= 50 ? 1900 : 2000) : Number(value.slice(0, 4));
  const rest = value.slice(short ? 2 : 4, -1);
  const [month, day, hour, minute, second] = rest.match(/\d{2}/g)!.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59)
    return null;
  return date;
};

/** Validity dates are presentation metadata, not a trust/signature verdict. */
export const summarizeOcspCertificate = (pem?: string, now = new Date()) => {
  if (!pem?.trim()) return { state: '未配置证书', subject: '-', issuer: '-', serial: '-', algorithm: '-', validity: '-' };
  try {
    const cert = new X509();
    cert.readCertPEM(pem);
    const before = parseCertificateTime(cert.getNotBefore());
    const after = parseCertificateTime(cert.getNotAfter());
    const state = !before || !after ? '有效期无法解析' : now < before ? '尚未生效' : now > after ? '已过期' : '有效期内';
    return {
      state,
      subject: cert.getSubjectString(),
      issuer: cert.getIssuerString(),
      serial: cert.getSerialNumberHex().toUpperCase(),
      algorithm: cert.getSignatureAlgorithmName(),
      validity: before && after ? `${before.toISOString().slice(0, 10)} 至 ${after.toISOString().slice(0, 10)}（UTC）` : '-'
    };
  } catch {
    return { state: '证书无法解析', subject: '-', issuer: '-', serial: '-', algorithm: '-', validity: '-' };
  }
};
