import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadArchiveCertificate, getArchiveCert } from '@/api/ca/archiveCert';
import { downloadCertificate, downloadCertificateChain, getCert } from '@/api/ca/cert';
import { downloadRootCa, getRootCa } from '@/api/ca/root';
import request from '@/utils/request';

vi.mock('@/utils/request', () => ({ default: vi.fn() }));

describe('根 CA 详情和下载', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用可独立审计的详情和下载入口', async () => {
    await getRootCa('9007199254740993');
    await downloadRootCa('9007199254740993');

    expect(request).toHaveBeenNthCalledWith(1, { url: '/ca/v1/roots/9007199254740993', method: 'get' });
    expect(request).toHaveBeenNthCalledWith(2, { url: '/ca/v1/roots/9007199254740993/download', method: 'get' });
  });
});

describe('终端和归档证书的详情与下载', () => {
  beforeEach(() => vi.clearAllMocks());

  it('终端证书分别请求详情、单证书和两种证书链格式', async () => {
    const id = '9007199254740993';
    await getCert(id);
    await downloadCertificate(id);
    await downloadCertificateChain(id, 'pem');
    await downloadCertificateChain(id, 'p7b');

    expect(request).toHaveBeenNthCalledWith(1, { url: `/ca/v1/certs/${id}`, method: 'get' });
    expect(request).toHaveBeenNthCalledWith(2, { url: `/ca/v1/certs/${id}/download`, method: 'get' });
    expect(request).toHaveBeenNthCalledWith(3, { url: `/ca/v1/certs/${id}/pem`, method: 'get', responseType: 'blob' });
    expect(request).toHaveBeenNthCalledWith(4, { url: `/ca/v1/certs/${id}/p7b`, method: 'get', responseType: 'blob' });
  });

  it('归档证书分别请求详情和单证书下载', async () => {
    const id = '9007199254740993';
    await getArchiveCert(id);
    await downloadArchiveCertificate(id);

    expect(request).toHaveBeenNthCalledWith(1, { url: `/ca/v1/archive-certs/${id}`, method: 'get' });
    expect(request).toHaveBeenNthCalledWith(2, { url: `/ca/v1/archive-certs/${id}/download`, method: 'get' });
  });
});
