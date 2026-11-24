import forge from 'node-forge';
import { KJUR } from 'jsrsasign';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';
import { readIssuedCertificateValidity } from '@/utils/raIssuedCertificateValidity';
import X509Cert from '@/components/X509Cert/index.vue';

it('renders the actual serial number, validity and RSA bit length in the readable certificate view', async () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '70db28';
  cert.validity.notBefore = new Date('2018-11-11T02:11:22Z');
  cert.validity.notAfter = new Date('2042-10-28T02:33:47Z');
  cert.setIssuer([{ name: 'commonName', value: 'Test CA' }]);
  cert.setSubject([{ name: 'commonName', value: 'Test Site' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const pem = forge.pki.certificateToPem(cert);
  expect(readIssuedCertificateValidity(pem)).toEqual({
    notBefore: new Date('2018-11-11T02:11:22Z'),
    notAfter: new Date('2042-10-28T02:33:47Z')
  });
  expect(readIssuedCertificateValidity(undefined)).toEqual({});
  const view = await renderToString(createSSRApp({
    render: () => h(X509Cert, { certPem: pem })
  }));
  expect(view).toContain('Certificate:');
  expect(view).toContain('70:db:28');
  expect(view).toContain('Signature Algorithm: SHA256withRSA');
  expect(view).toContain('Issuer: CN = Test CA');
  expect(view).toContain('Subject: CN = Test Site');
  expect(view).toContain('Nov 11 02:11:22 2018 GMT');
  expect(view).toContain('Oct 28 02:33:47 2042 GMT');
  expect(view).toContain('Public Key Algorithm: rsaEncryption');
  expect(view).toContain('Public-Key: (2048 bit)');
  expect(KJUR.crypto.ECDSA.getName('2b81040023')).toBe('secp521r1');
  expect(KJUR.crypto.ECDSA.getName('secp521r1')).toBe('secp521r1');
  expect(KJUR.crypto.ECDSA.getName('2a811ccf5501822d')).toBe('sm2p256v1');
});
