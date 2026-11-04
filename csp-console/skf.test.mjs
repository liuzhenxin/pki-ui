import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSkfSignature } from './skf.ts';

test('raw SKF signature starting 0x30 is converted rather than mistaken for DER', () => {
  const raw = Buffer.alloc(64, 1);
  raw[0] = 0x30;
  const der = Buffer.from(normalizeSkfSignature(raw.toString('base64')), 'base64');
  assert.equal(der.length, 70);
  assert.equal(der[2], 2);
  assert.equal(der[4], 0x30);
  assert.equal(normalizeSkfSignature(der.toString('base64')), der.toString('base64'));
});
test('raw high-bit integers receive DER sign padding', () => {
  const der = Buffer.from(normalizeSkfSignature(Buffer.alloc(64, 0x80).toString('base64')), 'base64');
  assert.equal(der.length, 72);
  assert.equal(der[3], 33);
  assert.equal(der[4], 0);
});
test('malformed signature rejected locally', () => {
  assert.throws(() => normalizeSkfSignature('AAAA'));
});
