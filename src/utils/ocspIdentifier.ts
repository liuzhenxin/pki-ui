export const normalizeOcspCaId = (value: string | number): string => {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('CA ID 超出安全整数范围，请输入完整数字文本');
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text) || BigInt(text) > 9223372036854775807n) throw new Error('CA ID 必须为有效的正整数');
  return text;
};

export const normalizeOptionalOcspId = (value?: string | number | null): string | undefined => {
  if (value == null || (typeof value === 'string' && !value.trim())) return undefined;
  return normalizeOcspCaId(value);
};
