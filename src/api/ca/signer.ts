import request from '@/utils/request';
import { Result } from '@/api/types';
import { ElMessage } from 'element-plus';

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
    keyIndex: item.keyIndex || conf.keyIndex || 1,
    keySize: item.keySize || conf.keySize || conf.keyLength,
    publicKey: item.publicKey || conf.publicKey,
    keyPairImported: conf.keyPairImported === true,
    certConfigured: item.certConfigured ?? Boolean(item.cert)
  };
};

const normalizePageQuery = (query: any = {}) => ({
  ...query,
  type: query.type || query.signerType || undefined
});

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

const toSignerCmd = (data: any = {}, privateKey?: string) => ({
  co: {
    id: data.id,
    name: data.name,
    type: data.signerType === 'KEY_PAIR' ? 'KEY_PAIR' : data.type || data.signerType,
    category: data.category || 'ISSUER',
    cert: data.cert,
    alias: data.alias,
    password: data.signerType === 'KEY_PAIR' ? data.keyPairPassword : data.password,
    privateKey,
    privateKeyPassword: privateKey === undefined ? undefined : data.privateKeyPassword,
    conf: JSON.stringify({
      ...parseConf(data.conf),
      algo: data.algo,
      keyIndex: data.keyIndex,
      keySize: data.algo === 'RSA' && (data.type || data.signerType) !== 'SDF' ? data.keySize : undefined
    })
  }
});

const sensitiveSignerRequest = { sensitive: true, repeatSubmit: false };

const readPrivateKey = async (data: any) => {
  if (data.signerType !== 'KEY_PAIR') {
    return undefined;
  }
  try {
    return await (data.privateKeyFile as File).text();
  } catch {
    ElMessage.error('无法读取私钥 PEM 文件，请重新选择');
    throw new Error('无法读取私钥 PEM 文件');
  }
};

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
    data: normalizePageQuery(query)
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
export async function saveSigner(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/signers',
    method: 'post',
    headers: sensitiveSignerRequest,
    data: toSignerCmd(data, await readPrivateKey(data))
  }) as any;
}

// 修改签名者
export function modifySigner(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/signers',
    method: 'put',
    headers: sensitiveSignerRequest,
    data: data.keyPairImported ? { co: { id: data.id, name: data.name, category: data.category } } : toSignerCmd(data)
  }) as any;
}

// 测试签名者
export async function testSigner(data: any): Promise<Result<any>> {
  const payload = data?.id ? { id: data.id } : { co: toSignerCmd(data, await readPrivateKey(data)).co };
  return request({
    url: '/ca/v1/signers/test',
    method: 'post',
    headers: sensitiveSignerRequest,
    data: payload
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
