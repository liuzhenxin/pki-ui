export interface KmcEnvironmentRow {
  name: string;
  value: string;
  message?: string;
  ok: boolean;
}

/** Normalize both supported environment response shapes; explicit false always wins. */
export function normalizeKmcEnvironment(data: unknown): KmcEnvironmentRow[] {
  const row = (name: string, value: unknown): KmcEnvironmentRow => {
    const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      name,
      value: String(record.value ?? value ?? '-'),
      message: record.message == null && record.remark == null ? undefined : String(record.message ?? record.remark),
      ok: record.ok == null ? record.status === 'success' || record.status === true || value === true : record.ok === true
    };
  };
  if (Array.isArray(data)) {
    return data.map((value, index) => {
      const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      return { ...row(String(record.name ?? record.item ?? `检测项 ${index + 1}`), value), value: String(record.value ?? '-') };
    });
  }
  return data !== null && typeof data === 'object' ? Object.entries(data).map(([name, value]) => row(name, value)) : [];
}
