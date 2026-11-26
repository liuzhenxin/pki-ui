import type { PublicCert, PublicCertDetail, PublicCertEmployee, PublicCertUsage } from '@/api/ra/publicCert';

export function publicCertFormData(certificate: PublicCert, files: File[]) {
  const form = new FormData();
  form.append('certificate', new Blob([JSON.stringify(certificate)], { type: 'application/json' }));
  files.forEach((file) => form.append('files', file));
  return form;
}

export const publicCertDomainRequired = (code?: string) => !['IOS', 'ANDROID', 'HARMONY'].includes((code || '').toUpperCase());

export function certificateExpiryText(value?: string, now = Date.now()): string {
  if (!value) return '未填写到期时间';
  const expiry = new Date(value.replace(' ', 'T'));
  if (!Number.isFinite(expiry.getTime())) return '到期时间无效';
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = (day(expiry) - day(new Date(now))) / 86400000;
  if (days === 0) return expiry.getTime() < now ? '今天已过期' : '今天到期';
  return days < 0 ? `已过期 ${-days} 天` : `剩余 ${days} 天`;
}

export function effectivePortalIdleMinutes(limit?: number): number {
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 5 && limit <= 1440 ? limit : 30;
}

export const publicNoticeStatus = (status?: number | null) => status == null ? '未通知' : (({ 0: '待发送', 1: '接口已受理', 2: '失败', 3: '发送中', 4: '结果未知', 5: '已跳过' } as Record<number, string>)[status] || '结果未知');

export function publicCertUsageError(rows?: PublicCertUsage[]): string | undefined {
  if (!rows?.length || rows.length > 100) return '使用信息须填写1至100行';
  if (rows.some((row) => !row.systemName?.trim() || !row.businessOwnerEmployeeId)) return '每行须填写使用系统并选择系统负责人';
}

export function selectCertificateMaintainer(form: PublicCert, employee: PublicCertEmployee) {
  Object.assign(form, {
    businessOwnerEmployeeId: employee.id, businessOwnerIdentityKey: undefined,
    businessOwnerName: employee.cnName, businessOwnerAccount: employee.domainAccount, businessOwnerEmail: employee.email || '',
    departmentId: employee.departmentId, departmentName: employee.departmentName || '', departmentPath: employee.departmentNamePath || ''
  });
}

export function publicCertEditValues(data: PublicCertDetail) {
  return {
    ...data.cert,
    businessOwnerEmployeeId: data.cert.businessOwnerEmployeeId || data.cert.maintainerEmployeeId,
    businessOwnerName: data.cert.businessOwnerName || data.cert.maintainerName,
    usages: data.usages?.length ? data.usages : [{ systemName: data.cert.systemName || '', usageDomain: data.cert.domainName || '', usageScene: '' }]
  };
}
