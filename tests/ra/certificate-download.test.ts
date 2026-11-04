import { describe, expect, it } from 'vitest';
import { certificateDownloadBlob } from '../../src/utils/raCertificateDownload';

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
