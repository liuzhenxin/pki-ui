const emailAttribute = /^(?:(?:OID\.)?1\.2\.840\.113549\.1\.9\.1|emailAddress|E)$/i;
// Match a complete DN attribute without treating escaped or quoted delimiters as separators.
const dnAttribute = /(^|[,;+])(\s*)([^=,;+]+)=((?:\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|[^,;+"\\])*)/g;

function decodeEmailDer(value: string): string | undefined {
  const hex = value.slice(1);
  if (hex.length < 6 || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) return;

  const bytes = Uint8Array.from(hex.match(/../g)!, (pair) => Number.parseInt(pair, 16));
  const tag = bytes[0];
  if (tag !== 0x16 && tag !== 0x0c && tag !== 0x13) return;

  let offset = 2;
  let length = bytes[1];
  if (length >= 0x80) {
    const lengthBytes = length & 0x7f;
    if (!lengthBytes || lengthBytes > 4 || offset + lengthBytes >= bytes.length) return;
    length = 0;
    for (let i = 0; i < lengthBytes; i++) length = length * 256 + bytes[offset++];
  }
  if (!length || length !== bytes.length - offset) return;
  const payload = bytes.subarray(offset);
  if (tag !== 0x0c && payload.some((byte) => byte > 0x7f)) return;

  try {
    const email = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    if (!/[\x00-\x1f\x7f]/.test(email)) return email.replace(/[,;+"\\]/g, '\\$&');
  } catch {
    // Leave malformed values visible as originally supplied.
  }
}

export function formatCertificateSubject(subject?: string | null): string {
  if (!subject) return '-';
  return subject.replace(dnAttribute, (attribute, separator: string, spacing: string, type: string, value: string) => {
    if (!emailAttribute.test(type.trim())) return attribute;
    const encoded = /^(#\S+)(\s*)$/.exec(value.trimStart());
    if (!encoded) return separator + spacing + 'E=' + value;
    const decoded = decodeEmailDer(encoded[1]);
    return decoded === undefined ? attribute : separator + spacing + 'E=' + decoded + encoded[2];
  });
}

export function formatCertificateSubjectColumn(_row: unknown, _column: unknown, value?: string | null): string {
  return formatCertificateSubject(value);
}
