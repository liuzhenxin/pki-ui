import { constants, createHash, generateKeyPairSync, privateEncrypt, verify, webcrypto } from 'node:crypto';
import { KJUR } from 'jsrsasign';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pemBody, signArchivePayload, wrappingFingerprint } from '@/utils/raArchiveSkf';

describe('RSA proof for RA archive recovery', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it('generates the digest information expected by the registered RSA certificate verifier', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const domain = 'KMC-HISTORICAL-RA-SKF-CLAIM-V1';
    const payload = { wrappingSpkiSha256: 'a'.repeat(64), recoveryId: 'test-task', claimId: 'test-claim', issuedAt: '2026-11-22T12:00:00Z' };
    const proof = await signArchivePayload(domain, payload, async (input) =>
      privateEncrypt({ key: privateKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(input, 'base64')).toString('base64')
    );
    const canonical = JSON.stringify({
      claimId: payload.claimId,
      issuedAt: payload.issuedAt,
      recoveryId: payload.recoveryId,
      wrappingSpkiSha256: payload.wrappingSpkiSha256
    });
    expect(verify('sha256', Buffer.from(`${domain}\n${canonical}`), publicKey, Buffer.from(proof.signatureBase64, 'base64'))).toBe(true);
    expect(
      verify(
        'sha256',
        Buffer.from(`${domain}\n${canonical.replace('test-task', 'other-task')}`),
        publicKey,
        Buffer.from(proof.signatureBase64, 'base64')
      )
    ).toBe(false);
  });

  it('hashes the exact DER SubjectPublicKeyInfo found inside the existing SKF CSR', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const csr = KJUR.asn1.csr.CSRUtil.newCSRPEM({
      subject: { str: '/CN=SKF test' },
      sbjpubkey: publicKey.export({ format: 'pem', type: 'spki' }),
      sigalg: 'SHA256withRSA',
      sbjprvkey: privateKey.export({ format: 'pem', type: 'pkcs8' })
    });
    expect(await wrappingFingerprint(pemBody(csr))).toBe(
      createHash('sha256')
        .update(publicKey.export({ format: 'der', type: 'spki' }))
        .digest('hex')
    );
  });
});
