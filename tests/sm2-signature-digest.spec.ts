import { expect, test } from '@playwright/test';
import { calculateSm2SignatureDigestFromPublicKey } from '../src/utils/sm2SignatureDigest';

test('calculates the GM/T SM2 signature digest before calling SKF_ECCSignData', () => {
  const publicKey =
    '09f9df311e5421a150dd7d161e4bc5c672179fad1833fc076bb08ff356f35020' + 'ccea490ce26775a52dc6ea718cc1aa600aed05fbf35e084a6632f6072da9ad13';
  const digest = calculateSm2SignatureDigestFromPublicKey(publicKey, Array.from(new TextEncoder().encode('message digest')), '1234567812345678');

  expect(Buffer.from(digest, 'base64').toString('hex')).toBe('f0b43e94ba45accaace692ed534382eb17e6ab5a19ce7b31f4486fdfc0d28640');
});
