import dayjs from 'dayjs';
import { ElMessageBox } from 'element-plus';

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
