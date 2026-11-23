import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { parseProfileValidity } from '@/utils/ca/profile-validity';

dayjs.extend(utc);

export const issueValidityUnits = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'week', label: '周' },
  { value: 'day', label: '日' },
  { value: 'hour', label: '小时' },
  { value: 'minute', label: '分钟' }
] as const;

export type IssueValidityUnit = (typeof issueValidityUnits)[number]['value'];

interface IssueValidity {
  notBefore?: string;
  notAfter?: string;
  expiry?: Date;
}

const validityUnit = { y: 'year', w: 'week', d: 'day', h: 'hour', m: 'minute' } as const;

export function defaultIssueDuration(start: Date, templateValidities: unknown[], issuerNotAfter?: string) {
  const limits = templateValidities.map((value) => parseProfileValidity(typeof value === 'string' ? value.trim() : value));
  if (!limits.length || limits.some((limit) => !limit)) return undefined;
  const maximum = limits.filter((limit) => limit !== null)
    .map((limit) => ({ value: limit.value, unit: validityUnit[limit.unit] }))
    .sort((a, b) => dayjs.utc(start).add(a.value, a.unit).diff(dayjs.utc(start).add(b.value, b.unit)))[0];
  if (issuerNotAfter && dayjs.utc(start).add(maximum.value, maximum.unit).isAfter(dayjs.utc(issuerNotAfter))) {
    const minutes = dayjs.utc(issuerNotAfter).diff(dayjs.utc(start), 'minute');
    return minutes > 0 ? { value: minutes, unit: 'minute' as const } : undefined;
  }
  return maximum;
}

function templateExpiry(start: Date, validity: unknown) {
  const limit = parseProfileValidity(typeof validity === 'string' ? validity.trim() : validity);
  if (!limit) throw new Error('证书模板有效期缺失或格式不正确，请重新同步 CA 模板');
  return dayjs.utc(start).add(limit.value, limit.unit);
}

export function resolveIssueValidity(
  start: Date | null,
  duration: number | undefined,
  unit: IssueValidityUnit,
  templateValidities: unknown[],
  now = new Date()
): IssueValidity {
  if (!start) {
    if (duration != null) throw new Error('指定有效期时请选择生效时间');
    return {};
  }
  const effective = dayjs(start).startOf('second');
  if (!effective.isValid()) throw new Error('请选择有效的证书生效时间');
  if (effective.isBefore(dayjs(now).startOf('second'))) throw new Error('证书生效时间不能早于当前时间');
  const notBefore = effective.utc().format('YYYYMMDDHHmmss');
  if (duration == null) return { notBefore };
  if (!Number.isSafeInteger(duration) || duration < 1) throw new Error('有效期必须为正整数');
  const expiry = effective.utc().add(duration, unit);
  if (!expiry.isValid() || expiry.utc().year() > 9999) throw new Error('证书到期时间超出允许范围');
  if (templateValidities.some((validity) => expiry.isAfter(templateExpiry(effective.toDate(), validity)))) {
    throw new Error('证书有效期不能超过证书模板允许的有效期');
  }
  return { notBefore, notAfter: expiry.utc().format('YYYYMMDDHHmmss'), expiry: expiry.toDate() };
}
