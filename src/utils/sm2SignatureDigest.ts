import { X509 } from 'jsrsasign';
import smCrypto from 'sm-crypto';

const { sm3 } = smCrypto;

const SM2_A = 'fffffffeffffffffffffffffffffffffffffffff00000000fffffffffffffffc';
const SM2_B = '28e9fa9e9d9f5e344d5a9e4bcf6509a7f39789f515ab8f92ddbcbd414d940e93';
const SM2_GX = '32c4ae2c1f1981195f9904466a39c9948fe30bbff2660be1715a4589334c74c7';
const SM2_GY = 'bc3736a2f4f6779c59bdcee36b692153d0a9877cc62a474002df32e52139f0a0';

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Array.from(binary, (character) => character.charCodeAt(0));
}

function hexToBytes(value: string) {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 2) bytes.push(Number.parseInt(value.slice(index, index + 2), 16));
  return bytes;
}

function bytesToBase64(value: number[]) {
  return btoa(String.fromCharCode(...value));
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Array.from(binary, (character) => character.charCodeAt(0));
}

function derInteger(value: number[]) {
  let offset = 0;
  while (offset < value.length - 1 && value[offset] === 0) offset += 1;
  const normalized = value.slice(offset);
  if ((normalized[0] & 0x80) !== 0) normalized.unshift(0);
  return [0x02, normalized.length, ...normalized];
}

function certificatePem(value: string) {
  const normalized = value
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${normalized.match(/.{1,64}/g)?.join('\n') || normalized}\n-----END CERTIFICATE-----`;
}

function sm2PublicKeyHex(certificate: string) {
  const publicKeyInfo = (X509 as any).getPublicKeyInfoPropOfCertPEM(certificatePem(certificate));
  const point = String(publicKeyInfo?.keyhex || '').toLowerCase();
  if (!/^04[0-9a-f]{128}$/.test(point)) throw new Error('管理员证书公钥不是标准 SM2 未压缩公钥');
  return point.slice(2);
}

/**
 * 计算 SKF_ECCSignData 所需的 SM2 消息摘要 e = SM3(ZA || M)。
 * SKF 的 SignData 接口接收摘要而非任意长度原文。
 */
export function calculateSm2SignatureDigest(certificate: string, signDataBase64Url: string, userId: string) {
  return calculateSm2SignatureDigestFromPublicKey(sm2PublicKeyHex(certificate), base64UrlToBytes(signDataBase64Url), userId);
}

export function calculateSm2SignatureDigestFromPublicKey(publicKey: string, message: number[], userId: string) {
  const normalizedPublicKey = publicKey.replace(/^04/, '').toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(normalizedPublicKey)) throw new Error('SM2 公钥格式无效');
  const userIdBytes = Array.from(new TextEncoder().encode(userId));
  const entl = userIdBytes.length * 8;
  if (entl > 0xffff) throw new Error('SM2 用户标识过长');

  const zaInput = [
    (entl >>> 8) & 0xff,
    entl & 0xff,
    ...userIdBytes,
    ...hexToBytes(SM2_A),
    ...hexToBytes(SM2_B),
    ...hexToBytes(SM2_GX),
    ...hexToBytes(SM2_GY),
    ...hexToBytes(normalizedPublicKey)
  ];
  const za = hexToBytes(sm3(zaInput));
  return bytesToBase64(hexToBytes(sm3([...za, ...message])));
}

/**
 * SKF SignData 返回 ECCSIGNATUREBLOB 的 r || s（各 32 字节），JCA SM3withSM2
 * 验签接口接收 ASN.1 DER SEQUENCE。若 SKF 实现已经返回 DER，则保持原值。
 */
export function normalizeSm2SignatureForApi(signatureBase64: string) {
  const signature = base64ToBytes(signatureBase64);
  if (signature[0] === 0x30 && signature.length >= 8) return bytesToBase64(signature);
  if (signature.length !== 64) throw new Error('USB Key 返回的 SM2 签名格式无效');

  const r = derInteger(signature.slice(0, 32));
  const s = derInteger(signature.slice(32));
  const body = [...r, ...s];
  return bytesToBase64([0x30, body.length, ...body]);
}
