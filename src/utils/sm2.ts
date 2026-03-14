import { sm2 } from 'sm-crypto';

// 默认加密模式 1 - C1C3C2，0 - C1C2C3
const cipherMode = 1;

/**
 * SM2 加密
 * @param text 待加密文本
 * @param publicKey 公钥 (Hex 字符串，不带 04 前缀)
 * @returns 加密后的 Hex 字符串 (带 04 前缀)
 */
export const encrypt = (text: string, publicKey: string): string => {
  if (!text || !publicKey) return '';
  // 如果公钥以 04 开头，去掉它，sm-crypto 默认输入不带 04
  let pk = publicKey;
  if (pk.startsWith('04')) {
    pk = pk.substring(2);
  }

  const encrypted = sm2.doEncrypt(text, pk, cipherMode);
  // sm-crypto 输出的密文通常不带 04，如果需要标准格式可能需要加上
  // 这里保持 sm-crypto 的默认输出，通常是 hex 字符串
  return '04' + encrypted;
};

/**
 * SM2 解密
 * @param text 待解密密文 (Hex 字符串，带或不带 04 前缀)
 * @param privateKey 私钥 (Hex 字符串)
 * @returns 解密后的文本
 */
export const decrypt = (text: string, privateKey: string): string => {
  if (!text || !privateKey) return '';
  let data = text;
  // sm-crypto 解密时，如果密文带 04 前缀，需要去掉
  if (data.startsWith('04')) {
    data = data.substring(2);
  }

  return sm2.doDecrypt(data, privateKey, cipherMode);
};

/**
 * 生成 SM2 密钥对
 * @returns { publicKey, privateKey }
 */
export const generateKeyPair = () => {
  const keypair = sm2.generateKeyPairHex();
  return {
    publicKey: keypair.publicKey, // 128位 hex
    privateKey: keypair.privateKey // 64位 hex
  };
};
