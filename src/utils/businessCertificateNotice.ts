import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getBusinessNoticeSettings, type NoticeModule } from '@/api/ra/businessNoticeSettings';

export function businessCertificateExpired(expiry?: string) {
  const date = dayjs(expiry);
  return !!expiry && date.isValid() && !date.isAfter(dayjs());
}

export function businessCertificateNoticeBlocked(expiry?: string) {
  const date = dayjs(expiry);
  return !!expiry && date.isValid() && date.add(1, 'month').isBefore(dayjs());
}

export async function confirmExpiredCertificateNotice(): Promise<boolean | undefined> {
  return ElMessageBox.confirm('该证书已过期，是否发送一次过期提醒？', '过期提醒', {
    confirmButtonText: '发送',
    cancelButtonText: '不发送',
    distinguishCancelAndClose: true,
    closeOnClickModal: false,
    type: 'warning'
  }).then(
    () => true,
    (action) => (action === 'cancel' ? false : undefined)
  );
}

export function businessCertificateValidity(expiry: string | undefined, ongoingDays: number) {
  const end = dayjs(expiry);
  const now = dayjs();
  if (!expiry || !end.isValid()) return { text: '未知', type: 'info' as const };
  if (!end.isAfter(now)) return { text: '已过期', type: 'danger' as const };
  const days = Math.max(1, Math.ceil(end.diff(now) / 86_400_000));
  return { text: days > ongoingDays ? '有效' : `剩余${days}天`, type: days <= 30 ? ('warning' as const) : ('success' as const) };
}

export async function confirmManualBusinessNotice(module: NoticeModule, expiry?: string) {
  if (!expiry || businessCertificateNoticeBlocked(expiry)) return false;
  const response = await getBusinessNoticeSettings(module);
  const config = response?.data?.data ?? response?.data;
  const days = String(config?.days ?? '')
    .split(',')
    .filter((value) => value.trim())
    .map(Number);
  const remaining = dayjs(expiry).diff(dayjs());
  const due = remaining <= 0 ? days.includes(0) : days.some((day) => day > 0 && remaining <= day * 86_400_000);
  if (!due) {
    ElMessage.info('证书尚未到达配置的提醒档位');
    return false;
  }
  const text = businessCertificateValidity(expiry, Infinity).text;
  return ElMessageBox.confirm(`证书${text}，是否发送提醒？`, '通知确认', {
    type: 'warning',
    confirmButtonText: '确认发送',
    cancelButtonText: '取消',
    closeOnClickModal: false
  }).then(
    () => true,
    () => false
  );
}
