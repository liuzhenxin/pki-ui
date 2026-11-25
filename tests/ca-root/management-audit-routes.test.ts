import { beforeEach, describe, expect, it, vi } from 'vitest';
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
