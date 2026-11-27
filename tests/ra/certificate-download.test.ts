import { describe, expect, it } from 'vitest';
import forge from 'node-forge';
import { certificateDownloadBlob, employeeCertificateDownload, issuedCertificateBlob, recoveredPkcs12 } from '../../src/utils/raCertificateDownload';

describe('certificate download validation', () => {
  it.each(['application/json', 'application/octet-stream', ''])('rejects Forbidden JSON with MIME %s', async (type) => {
    const blob = new Blob([' {"code":"Forbidden","data":null}'], { type });
    await expect(certificateDownloadBlob(blob, 'application/x-pem-file')).rejects.toThrow();
  });
  it('preserves a PEM file', async () => {
    const blob = new Blob(['-----BEGIN CERTIFICATE-----\npublic\n-----END CERTIFICATE-----']);
    expect(await certificateDownloadBlob(blob, 'application/x-pem-file')).toBe(blob);
  });
  it('shows only recognized employee certificate download errors when requested', async () => {
    const message = '该任务没有已签发的证书可下载';
    const blob = new Blob([JSON.stringify({ code: 'RA_EMPLOYEE_CERT_OPERATION_REJECTED', msg: message })]);
    await expect(certificateDownloadBlob(blob, 'application/zip', 'RA_EMPLOYEE_CERT_')).rejects.toThrow(message);
    await expect(certificateDownloadBlob(blob, 'application/zip')).rejects.toThrow('服务器返回了错误响应');
  });
  it('preserves binary CER/P7B/PKCS12 responses', async () => {
    const buffer = new Uint8Array([0x30, 0x82, 0x01, 0x02, 0xff]).buffer;
    const blob = await certificateDownloadBlob({ data: buffer }, 'application/pkix-cert');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(buffer));
  });
  it.each(['cer', 'pem', 'crt', 'p7b', 'pfx'])('uses the server filename for single %s downloads', async (format) => {
    const blob = new Blob([Uint8Array.of(0x30, 0x82, 0x01, 0x02)]);
    const name = format === 'pfx' ? 'domain_AB_+test!%.pfx' : `domain_AB.${format}`;
    const response = { data: blob, headers: { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } };
    expect(await employeeCertificateDownload(response, 'employee-certs', format)).toEqual({ blob, filename: name });
  });
  it('keeps a ZIP filename when downloading multiple files in one format', async () => {
    const blob = new Blob([Uint8Array.of(80, 75, 3, 4)]);
    expect(await employeeCertificateDownload({ data: blob }, 'employee-certs', 'pfx')).toEqual({ blob, filename: 'employee-certs.zip' });
  });
  it('uses the KMC recovery bytes as a P12 without asking for a private key', async () => {
    const result = recoveredPkcs12({ fileBase64: 'AQID' }, 'AB');
    expect(result.filename).toBe('AB.p12');
    expect(result.blob.type).toBe('application/x-pkcs12');
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(() => recoveredPkcs12({}, 'AB')).toThrow('CA 未返回 P12 文件');
  });
  it('rejects empty and nonbinary responses', async () => {
    await expect(certificateDownloadBlob(new Blob([]), '')).rejects.toThrow();
    await expect(certificateDownloadBlob({ code: 'Forbidden' }, '')).rejects.toThrow();
  });
});

describe('issued result certificate formats', () => {
  const keys = forge.pki.rsa.generateKeyPair(512);
  const createCertificate = (serialNumber: string) => {
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = serialNumber;
    cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
    cert.setIssuer([{ name: 'commonName', value: 'Test CA' }]);
    cert.setSubject([{ name: 'commonName', value: `Test ${serialNumber}` }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    return forge.pki.certificateToPem(cert);
  };
  const leaf = createCertificate('01');
  const issuer = createCertificate('02');

  it.each(['pem', 'crt'] as const)('exports a single PEM certificate as %s', async (format) => {
    const blob = await issuedCertificateBlob(leaf, format, issuer);
    expect(forge.pki.certificateFromPem(await blob.text()).serialNumber).toBe('01');
  });

  it.each(['cer', 'der'] as const)('exports %s as DER', async (format) => {
    const blob = await issuedCertificateBlob(leaf, format);
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.binary.raw.encode(new Uint8Array(await blob.arrayBuffer()))));
    expect(cert.serialNumber).toBe('01');
  });

  it.each([[issuer + leaf, ['01', '02']], [null, ['01']]] as const)('exports P7B from returned certificates', async (chain, serials) => {
    const blob = await issuedCertificateBlob(leaf, 'p7b', chain);
    const result = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.binary.raw.encode(new Uint8Array(await blob.arrayBuffer()))));
    expect(result.certificates.map((cert: forge.pki.Certificate) => cert.serialNumber).sort()).toEqual(serials);
  });
});
