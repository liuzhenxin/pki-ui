const COMPACT_DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Convert an Element Plus local datetime value to the compact UTC format used
 * by the CA certificate API.
 */
export function localCertificateTimeToUtc(value?: string): string | undefined {
  if (!value) return value;

  const match = COMPACT_DATE_TIME_PATTERN.exec(value);
  if (!match) return value;

  const [, year, month, day, hour, minute, second] = match;
  const localDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));

  return (
    String(localDate.getUTCFullYear()) +
    pad(localDate.getUTCMonth() + 1) +
    pad(localDate.getUTCDate()) +
    pad(localDate.getUTCHours()) +
    pad(localDate.getUTCMinutes()) +
    pad(localDate.getUTCSeconds())
  );
}

export function withUtcCertificateValidity<T extends Record<string, any>>(data: T): T {
  return {
    ...data,
    notBefore: localCertificateTimeToUtc(data.notBefore),
    notAfter: localCertificateTimeToUtc(data.notAfter)
  };
}
