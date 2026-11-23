import { expect, test } from '@playwright/test';
import { formatCertificateSubject, formatCertificateSubjectColumn } from '../src/utils/raCertificateSubject';

test('shows the actual email in both the certificate list and detail', () => {
  const subject = 'CN=Example,1.2.840.113549.1.9.1=#161879752e7a68616e672e4d532d37406661772d76772e636f6d,OU=Email,DC=faw-vw,DC=in';
  const display = 'CN=Example,E=yu.zhang.MS-7@faw-vw.com,OU=Email,DC=faw-vw,DC=in';
  expect(formatCertificateSubject(subject)).toBe(display);
  expect(formatCertificateSubjectColumn({ subject }, {}, subject)).toBe(display);
  expect(formatCertificateSubject(undefined)).toBe('-');
});

test('normalizes plain email fields without modifying escaped or quoted DN values', () => {
  const prefix = 'CN=Last\\, First,OU="contains,1.2.840.113549.1.9.1=not-an-attribute",';
  expect(formatCertificateSubject(prefix + 'emailAddress=user@example.test+OID.1.2.840.113549.1.9.1=second@example.test,1.2.3=#160161')).toBe(
    prefix + 'E=user@example.test+E=second@example.test,1.2.3=#160161'
  );
});

test('keeps malformed or unsupported encodings intact', () => {
  for (const value of ['#160274', '#1601ff', '#040161', '#160100', '#0c01ff', '#not-hex']) {
    const subject = 'CN=Example,1.2.840.113549.1.9.1=' + value;
    expect(formatCertificateSubject(subject)).toBe(subject);
  }
});
