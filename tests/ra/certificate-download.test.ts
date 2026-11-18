import { describe, expect, it } from 'vitest';
import forge from 'node-forge';
import { certificateDownloadBlob, issuedCertificateBlob } from '../../src/utils/raCertificateDownload';

describe('certificate download validation', () => {
  it.each(['application/json', 'application/octet-stream', ''])('rejects Forbidden JSON with MIME %s', async (type) => {
    const blob = new Blob([' {"code":"Forbidden","data":null}'], { type });
    await expect(certificateDownloadBlob(blob, 'application/x-pem-file')).rejects.toThrow();
  });
  it('preserves a PEM file', async () => {
    const blob = new Blob(['-----BEGIN CERTIFICATE-----\npublic\n-----END CERTIFICATE-----']);
    expect(await certificateDownloadBlob(blob, 'application/x-pem-file')).toBe(blob);
  });
  it('preserves binary CER/P7B/PKCS12 responses', async () => {
    const buffer = new Uint8Array([0x30, 0x82, 0x01, 0x02, 0xff]).buffer;
    const blob = await certificateDownloadBlob({ data: buffer }, 'application/pkix-cert');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(buffer));
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

  it('exports CER as DER', async () => {
    const blob = await issuedCertificateBlob(leaf, 'cer');
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.binary.raw.encode(new Uint8Array(await blob.arrayBuffer()))));
    expect(cert.serialNumber).toBe('01');
  });

  it.each([[issuer + leaf, ['01', '02']], [null, ['01']]] as const)('exports P7B from returned certificates', async (chain, serials) => {
    const blob = await issuedCertificateBlob(leaf, 'p7b', chain);
    const result = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.binary.raw.encode(new Uint8Array(await blob.arrayBuffer()))));
    expect(result.certificates.map((cert: forge.pki.Certificate) => cert.serialNumber).sort()).toEqual(serials);
  });
});
