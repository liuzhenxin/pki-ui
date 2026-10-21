/** Validate binary certificate exports before creating a downloadable file. */
export async function certificateDownloadBlob(response: unknown, mimeType: string): Promise<Blob> {
  const candidate = response as { data?: unknown } | null;
  const value = candidate?.data instanceof Blob || candidate?.data instanceof ArrayBuffer ? candidate.data : response;
  if (!(value instanceof Blob) && !(value instanceof ArrayBuffer)) {
    throw new Error('证书下载返回了无效数据');
  }
  const blob = value instanceof Blob ? value : new Blob([value], { type: mimeType });
  if (!blob.size) throw new Error('证书下载返回了空文件');
  const prefix = (await blob.slice(0, 512).text()).replace(/^\uFEFF/, '').trimStart();
  if (blob.type.toLowerCase().includes('json') || prefix.startsWith('{') || prefix.startsWith('[')) {
    throw new Error('证书下载失败：服务器返回了错误响应');
  }
  return blob;
}
