/** RSA KMC requests carry an explicit size; wrapping CSR keys have their own size. */
export function rsaKmcKeySizes(profileConf?: string): number[] {
  let profile: any;
  try {
    profile = JSON.parse(profileConf || '{}');
  } catch {
    return [2048, 4096];
  }
  if (!Array.isArray(profile?.keyAlgorithms) || !profile.keyAlgorithms.length) return [2048, 4096];
  const sizes = new Set<number>();
  for (const item of profile.keyAlgorithms) {
    if (typeof item === 'string') {
      const match = item.toUpperCase().match(/^RSA[-_ ]?(\d+)$/);
      if (match) sizes.add(Number(match[1]));
      else if (item.toUpperCase() === 'RSA') [2048, 4096].forEach((size) => sizes.add(size));
      continue;
    }
    const rsa = item?.parameters?.rsa;
    const modulus = rsa?.modulus || rsa?.modulusLengths;
    const description = item?.description || item?.algorithms?.[0]?.description || item?.name || item?.type || '';
    const match = String(description)
      .toUpperCase()
      .match(/^RSA[-_ ]?(\d+)$/);
    if (Array.isArray(modulus)) {
      modulus.forEach((size: number) => sizes.add(Number(size)));
    } else if (match) {
      sizes.add(Number(match[1]));
    } else if (JSON.stringify(item).includes('1.2.840.113549.1.1.1') || /^RSA$/i.test(description)) {
      [2048, 4096].forEach((size) => sizes.add(size));
    }
  }
  return [2048, 4096].filter((size) => sizes.has(size));
}

export function rsaKmcKeyRequest(profileConf: string | undefined, keySize: number) {
  if (!rsaKmcKeySizes(profileConf).includes(keySize)) throw new Error('请选择证书模板允许的 RSA 密钥长度（2048 或 4096）');
  return { keyAlgorithm: 'RSA' as const, keySize };
}
