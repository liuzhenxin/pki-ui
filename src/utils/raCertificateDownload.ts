/** Validate binary certificate exports before creating a downloadable file. */
export async function certificateDownloadBlob(response: unknown, mimeType: string, businessErrorPrefix?: string): Promise<Blob> {
  const candidate = response as { data?: unknown } | null;
  const value = candidate?.data instanceof Blob || candidate?.data instanceof ArrayBuffer ? candidate.data : response;
  if (!(value instanceof Blob) && !(value instanceof ArrayBuffer)) {
    throw new Error('证书下载返回了无效数据');
  }
  const blob = value instanceof Blob ? value : new Blob([value], { type: mimeType });
  if (!blob.size) throw new Error('证书下载返回了空文件');
  const prefix = (await blob.slice(0, 512).text()).replace(/^\uFEFF/, '').trimStart();
  if (blob.type.toLowerCase().includes('json') || prefix.startsWith('{') || prefix.startsWith('[')) {
    const result = businessErrorPrefix && blob.size < 64 * 1024 ? await blob.text().then(JSON.parse).catch(() => null) : null;
    if (businessErrorPrefix && typeof result?.code === 'string' && result.code.startsWith(businessErrorPrefix) && typeof result.msg === 'string') {
      throw new Error(result.msg);
    }
    throw new Error('证书下载失败：服务器返回了错误响应');
  }
  return blob;
}

export async function employeeCertificateDownload(response: unknown, baseName: string, format: string) {
  const blob = await certificateDownloadBlob(response, 'application/octet-stream', 'RA_EMPLOYEE_CERT_');
  const prefix = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const zipped = prefix[0] === 80 && prefix[1] === 75 && prefix[2] === 3 && prefix[3] === 4;
  if (!zipped && format === 'all') throw new Error('服务器未返回有效的 ZIP 文件');
  const disposition = (response as { headers?: Record<string, string> } | null)?.headers?.['content-disposition'] ?? '';
  const encoded = /(?:^|;)\s*filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  let filename = /(?:^|;)\s*filename="([^"]+)"/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded.trim());
    } catch {
      // A malformed filename header falls back to the plain filename.
    }
  }
  const extension = zipped ? 'zip' : format;
  const usableName = filename && filename.toLowerCase().endsWith('.' + extension) && !/[\x00-\x1f\x7f/\\]/.test(filename);
  return { blob, filename: !zipped && usableName ? filename : `${baseName}.${extension}` };
}

export function recoveredPkcs12(result: { fileBase64?: string; fileName?: string }, serial: string) {
  if (!result?.fileBase64) throw new Error('CA 未返回 P12 文件');
  const bytes = Uint8Array.from(atob(result.fileBase64), character => character.charCodeAt(0));
  return { blob: new Blob([bytes], { type: 'application/x-pkcs12' }), filename: result.fileName || `${serial}.p12` };
}

export type IssuedCertificateFormat = 'pem' | 'cer' | 'der' | 'crt' | 'p7b';

const certificateBlocks = (pem: string) => [...pem.matchAll(/-----BEGIN CERTIFICATE-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END CERTIFICATE-----/g)]
  .map(([, base64]) => base64.replace(/\s/g, ''));

const base64Bytes = (base64: string) => Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));

const certificatePem = (base64: string) =>
  `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----\n`;

export async function issuedCertificateBlob(pem: string, format: IssuedCertificateFormat, chain?: string | null): Promise<Blob> {
  const [leaf] = certificateBlocks(pem);
  if (!leaf) throw new Error('签发结果未返回有效的证书内容');
  const der = base64Bytes(leaf);
  if (format === 'cer' || format === 'der') return new Blob([der], { type: 'application/pkix-cert' });
  if (format !== 'p7b') return new Blob([certificatePem(leaf)], { type: 'application/x-pem-file' });

  const certs = [...new Set([leaf, ...certificateBlocks(chain || '')])].map(certificatePem);
  const { KJUR, hextob64 } = await import('jsrsasign');
  // A certificate-only PKCS#7 has no content, digest algorithms or signers.
  const signedData = new KJUR.asn1.cms.SignedData({ fixed: true, version: 1, hashalgs: [], econtent: { type: 'data' }, certs, sinfos: [] });
  return new Blob([base64Bytes(hextob64(signedData.getContentInfoEncodedHex()))], { type: 'application/x-pkcs7-certificates' });
}
