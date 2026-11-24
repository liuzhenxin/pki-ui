import { X509 } from 'jsrsasign';

function parseCertificateTime(value: string): Date | undefined {
  const time = /^(?:(\d{4})|(\d{2}))(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!time) return undefined;
  const [, fullYear, shortYear, month, day, hour, minute, second] = time;
  const year = fullYear || (Number(shortYear) < 50 ? `20${shortYear}` : `19${shortYear}`);
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function readIssuedCertificateValidity(pem?: string): { notBefore?: Date; notAfter?: Date } {
  if (!pem) return {};
  try {
    const cert = new X509() as unknown as {
      readCertPEM(value: string): void;
      getNotBefore(): string;
      getNotAfter(): string;
    };
    cert.readCertPEM(pem);
    return { notBefore: parseCertificateTime(cert.getNotBefore()), notAfter: parseCertificateTime(cert.getNotAfter()) };
  } catch {
    return {};
  }
}
