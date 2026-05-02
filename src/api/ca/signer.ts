import request from '@/utils/request';
import { Result } from '@/api/types';

const parseConf = (conf: any) => {
  if (!conf || typeof conf !== 'string') {
    return {};
  }
  try {
    return JSON.parse(conf);
  } catch {
    return {};
  }
};

const normalizeSigner = (item: any = {}) => {
  const conf = parseConf(item.conf);
  return {
    ...item,
    algo: item.algo || conf.algo || 'SM2',
    signerType: item.signerType || item.type || 'PKCS12',
    keyIndex: item.keyIndex || conf.keyIndex || 1
  };
};

const normalizeResultList = (res: any) => ({
  ...res,
  data: Array.isArray(res.data) ? res.data.map(normalizeSigner) : []
});

const normalizeResultPage = (res: any) => ({
  ...res,
  data: {
    ...res.data,
    records: Array.isArray(res.data?.records) ? res.data.records.map(normalizeSigner) : []
  }
});

const toSignerCmd = (data: any = {}) => ({
  co: {
    id: data.id,
    name: data.name,
    type: data.type || data.signerType,
    category: data.category || 'ISSUER',
    cert: data.cert,
    alias: data.alias,
    password: data.password,
    conf: data.conf || JSON.stringify({
      algo: data.algo,
      keyIndex: data.keyIndex
    })
  }
});

// 查询签名者列表
export function listSigner(data?: any): Promise<Result<any[]>> {
  return request({
    url: '/ca/v1/signers/list',
    method: 'post',
    data: data || {}
  }).then(normalizeResultList) as any;
}

// 分页查询签名者列表
export function pageSigner(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/signers/page',
    method: 'post',
    data: query
  }).then(normalizeResultPage) as any;
}

// 查询签名者详情
export function getSigner(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/signers/${id}`,
    method: 'get'
  }).then((res: any) => ({
    ...res,
    data: normalizeSigner(res.data)
  })) as any;
}

// 保存签名者
export function saveSigner(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/signers',
    method: 'post',
    data: toSignerCmd(data)
  }) as any;
}

// 修改签名者
export function modifySigner(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/signers',
    method: 'put',
    data: toSignerCmd(data)
  }) as any;
}

// 删除签名者
export function removeSigner(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/v1/signers',
    method: 'delete',
    data: ids
  }) as any;
}
