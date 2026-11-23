import { ASN1HEX, b64tohex, hextob64, RSAKey, X509 } from 'jsrsasign';
import type { SignedDevicePayload } from '@/api/ca/historicalRecovery';

export interface SkfSigningCertificate {
  key: string;
  value: string;
  cert: string;
}

export function pemBody(pem: string) {
  return pem.replace(/-----BEGIN[^-]+-----|-----END[^-]+-----|\s+/g, '');
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function certificateFingerprint(certificate: string) {
  return sha256(Uint8Array.from(atob(pemBody(certificate)), (c) => c.charCodeAt(0)));
}

export async function wrappingFingerprint(csrBase64: string) {
  // PKCS#10 CertificationRequestInfo: version, subject, SubjectPublicKeyInfo, attributes.
  const spki = ASN1HEX.getTLVbyList(b64tohex(csrBase64), 0, [0, 2], '30');
  if (!spki) throw new Error('无法读取 USB Key 封装 CSR 公钥');
  return certificateFingerprint(hextob64(spki));
}

export function isRsaSigningCertificate(certificate: SkfSigningCertificate) {
  try {
    const x509 = new X509();
    x509.readCertHex(b64tohex(pemBody(certificate.cert)));
    const key = x509.getPublicKey();
    return key instanceof RSAKey && key.n.bitLength() >= 2048;
  } catch {
    return false;
  }
}

export function utcNow() {
  return new Date().toISOString().replace(/\.000Z$/, 'Z');
}

export async function signArchivePayload<T extends Record<string, string>>(
  domain: string,
  payload: T,
  sign: (base64: string) => Promise<string>
): Promise<SignedDevicePayload<T>> {
  const ordered = Object.fromEntries(
    Object.keys(payload)
      .sort()
      .map((key) => [key, payload[key]])
  );
  const hash = await sha256(new TextEncoder().encode(`${domain}\n${JSON.stringify(ordered)}`));
  // SKF_RSASignData takes the DER DigestInfo for SHA256withRSA.
  const signatureBase64 = await sign(hextob64(`3031300d060960864801650304020105000420${hash}`));
  if (typeof signatureBase64 !== 'string' || !signatureBase64) throw new Error('USB Key 未返回领取签名');
  return { payload, signatureBase64 };
}
