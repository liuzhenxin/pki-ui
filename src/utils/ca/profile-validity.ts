export const MAX_PROFILE_VALIDITY = 2_147_483_647;

export const profileValidityUnits = [
  { value: 'y', label: '年' },
  { value: 'd', label: '天' },
  { value: 'w', label: '周' },
  { value: 'h', label: '小时' },
  { value: 'm', label: '分钟' }
] as const;

export type ProfileValidityUnit = (typeof profileValidityUnits)[number]['value'];

/** Match the CA Validity syntax: m means minutes; an omitted suffix means days. */
export function parseProfileValidity(value: unknown): { value: number; unit: ProfileValidityUnit } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d+)([ywdhm]?)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_PROFILE_VALIDITY) return null;
  return { value: amount, unit: (match[2].toLowerCase() || 'd') as ProfileValidityUnit };
}

export function formatProfileValidity(value: unknown): string {
  const parsed = parseProfileValidity(value);
  if (!parsed) return '未设置或格式不正确';
  const label = profileValidityUnits.find((unit) => unit.value === parsed.unit)!.label;
  return `${parsed.value} ${label}`;
}
