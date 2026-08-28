export const unwrapOcspData = <T = any>(res: any): T => {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
};

const SENSITIVE_CONF = /"\s*(password|pin|privateKey|private_key|keystorePassword|hsmPin)\s*"/i;

export const assertSafeSignerConf = (raw: string): string => {
  const text = (raw || '').trim();
  if (!text) {
    throw new Error('请输入签名配置');
  }
  JSON.parse(text);
  if (SENSITIVE_CONF.test(text)) {
    throw new Error('signer_conf 不得包含密码、PIN 或私钥字段');
  }
  return text;
};

export const assertSafeSignerCert = (pem: string): string => {
  const text = (pem || '').trim();
  if (!text) {
    throw new Error('请粘贴 OCSP 签名证书 PEM');
  }
  if (text.includes('PRIVATE KEY')) {
    throw new Error('签名证书字段不得包含私钥');
  }
  return text;
};
