import request from '@/utils/request';

export type NoticeModule = 'root' | 'intranet' | 'public';
export interface BusinessNoticeTemplate {
  category: string;
  channel: 'EMAIL' | 'DINGTALK';
  messageType: string;
  title: string;
  content: string;
}
export interface BusinessNoticeConfig {
  automatic: boolean;
  departure: boolean;
  approval: boolean;
  email: boolean;
  dingtalk: boolean;
  administrators: boolean;
  owner: boolean;
  days: string;
  time: string;
  departureIntervalDays: number;
  templates: BusinessNoticeTemplate[];
}
export const getBusinessNoticeSettings = (module: NoticeModule) =>
  request({ url: `/ra/v1/business-notice-settings/${module}`, method: 'get' }) as any;
export const saveBusinessNoticeSettings = (module: NoticeModule, data: BusinessNoticeConfig) =>
  request({ url: `/ra/v1/business-notice-settings/${module}`, method: 'put', data }) as any;

export const notifyBusinessCertificates = (module: NoticeModule, ids: (string | number)[]) =>
  request({ url: `/ra/v1/business-notice-settings/${module}/notify`, method: 'post', data: ids }) as any;

export const setBusinessCertificateReminder = (module: 'intranet' | 'public', id: string | number, enabled: boolean, sendExpired?: boolean) =>
  request({ url: `/ra/v1/business-notice-settings/${module}/${id}/reminder`, method: 'put', data: { enabled, sendExpired } }) as any;
