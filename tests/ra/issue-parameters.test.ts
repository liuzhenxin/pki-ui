import forge from 'node-forge';
import { describe, expect, it } from 'vitest';
import { buildIssueSubjectItems, formatIssueSubject, readIssueCsrSubject } from '@/utils/raIssueSubject';
import { defaultIssueDuration, resolveIssueValidity } from '@/utils/raIssueValidity';

const now = new Date('2028-01-01T00:00:00Z');

describe('RA issuance validity', () => {
  it('defaults to the shorter certificate profile limit and preserves minute/hour units', () => {
    expect(defaultIssueDuration(now, ['5y', '1h'])).toEqual({ value: 1, unit: 'hour' });
    expect(defaultIssueDuration(now, ['30m'])).toEqual({ value: 30, unit: 'minute' });
    expect(defaultIssueDuration(now, ['5y'], '2028-01-01T01:30:15Z')).toEqual({ value: 90, unit: 'minute' });
  });

  it('keeps CA defaults, and permits a future start even if no duration is entered', () => {
    expect(resolveIssueValidity(null, undefined, 'day', ['5y'], now)).toEqual({});
    expect(resolveIssueValidity(new Date('2028-01-02T00:00:00Z'), undefined, 'day', ['5y'], now)).toEqual({
      notBefore: '20280102000000'
    });
    expect(() => resolveIssueValidity(new Date('2027-12-31T23:59:59Z'), undefined, 'day', ['5y'], now)).toThrow('不能早于当前时间');
    expect(() => resolveIssueValidity(null, 1, 'day', ['5y'], now)).toThrow('请选择生效时间');
  });

  it('clamps end-of-month and leap-day dates on calendar month and year input', () => {
    const atJanuaryEnd = new Date(2028, 0, 31, 10);
    const atLeapDay = new Date(2028, 1, 29, 10);
    const month = resolveIssueValidity(atJanuaryEnd, 1, 'month', ['31d'], now);
    const year = resolveIssueValidity(atLeapDay, 1, 'year', ['1y'], now);
    expect(month.expiry).toEqual(atLeapDay);
    expect(year.expiry).toEqual(new Date(2029, 1, 28, 10));
  });

  it('respects both templates and treats the CA m suffix as minutes', () => {
    const start = new Date('2028-02-01T12:00:00Z');
    expect(resolveIssueValidity(start, 1, 'day', ['5y', '1d'], now).notAfter).toBe('20280202120000');
    expect(() => resolveIssueValidity(start, 2, 'day', ['5y', '1d'], now)).toThrow('有效期不能超过模板允许的时间');
    expect(() => resolveIssueValidity(start, 1, 'day', ['30m'], now)).toThrow('有效期不能超过模板允许的时间');
    expect(() => resolveIssueValidity(start, 1.5, 'day', ['5y'], now)).toThrow('正整数');
    expect(() => resolveIssueValidity(start, 1, 'day', ['5y', undefined], now)).toThrow('重新同步');
  });
});

describe('RA issuance subject', () => {
  it('reads the subject from both PEM and pasted Base64 CSR data', () => {
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const request = forge.pki.createCertificationRequest();
    request.publicKey = keys.publicKey;
    request.setSubject([{ shortName: 'CN', value: 'User, Test' }, { shortName: 'OU', value: 'Development' }]);
    request.sign(keys.privateKey, forge.md.sha256.create());
    const pem = forge.pki.certificationRequestToPem(request);
    const subject = 'CN=User\\, Test,OU=Development';
    expect(readIssueCsrSubject(pem)).toBe(subject);
    expect(readIssueCsrSubject(pem.replace(/-----[^-]+-----|\s/g, ''))).toBe(subject);
    expect(() => readIssueCsrSubject('invalid CSR')).toThrow();
  });

  it('renders template fields when the approved application has no stored subject', () => {
    expect(buildIssueSubjectItems([{ type: { oid: '2.5.4.5' }, minOccurs: 0 }], null)).toMatchObject([
      { type: 'serialNumber', value: '', minOccurs: 0 }
    ]);
  });

  it.each(['serialNumber', 'SN', '2.5.4.5', { oid: '2.5.4.5' }])('renders the optional TLS serial number for %j', (type) => {
    const items = buildIssueSubjectItems(
      {
        rdns: [
          { type, minOccurs: 0 },
          { type: 'commonName', regex: ':FQDN' }
        ]
      },
      'CN=example.com'
    );
    expect(items).toMatchObject([
      { type: 'commonName', value: 'example.com', minOccurs: 1, regex: ':FQDN' },
      { type: 'serialNumber', value: '', minOccurs: 0 }
    ]);
    items[1].value = 'Asset, 012';
    expect(formatIssueSubject(items)).toBe('CN=example.com,serialNumber=Asset\\, 012');
  });

  it('prefills escaped values, distinguishes surname from the serial number, and keeps the template limits', () => {
    const items = buildIssueSubjectItems(
      [{ type: { oid: '2.5.4.5', description: 'SN' } }, { type: 'surname', minOccurs: 0 }, { type: 'OU', minOccurs: 1, maxOccurs: 2 }],
      'serialNumber=Ops\\, East,surname=Liu,OU=A,OU=B,OU=C,O=not included'
    );
    expect(formatIssueSubject(items)).toBe('serialNumber=Ops\\, East,surname=Liu,OU=A,OU=B');
    expect(items.filter((item) => item.type === 'organizationalUnit').map((item) => item.minOccurs)).toEqual([1, 0]);
  });
});
