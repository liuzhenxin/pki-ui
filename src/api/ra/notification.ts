import request from '@/utils/request';
import { Result } from '@/api/types';

export interface RaNotification {
  id?: number | string;
  notificationType: string;
  title: string;
  content: string;
  recipientId?: number | string;
  recipientEmail?: string;
  recipientPhone?: string;
  sendStatus: number;
  sendTime?: string;
  retryCount?: number;
  errorMessage?: string;
  isRead: number;
  readTime?: string;
  priority: number;
  businessType?: string;
  businessId?: number | string;
  createTime?: string;
  updateTime?: string;
}

export interface RaNotificationQuery {
  pageNum: number;
  pageSize: number;
  title?: string;
  notificationType?: string;
  sendStatus?: number | string;
  isRead?: number | string;
  priority?: number | string;
  businessType?: string;
  createTimeStart?: string;
  createTimeEnd?: string;
}

function withPage(query: RaNotificationQuery) {
  const pageNum = Number(query.pageNum || 1);
  const pageSize = Number(query.pageSize || 10);
  return {
    ...query,
    notificationType: query.notificationType === '' ? undefined : query.notificationType,
    sendStatus: query.sendStatus === '' ? undefined : query.sendStatus,
    isRead: query.isRead === '' ? undefined : query.isRead,
    priority: query.priority === '' ? undefined : query.priority,
    businessType: query.businessType === '' ? undefined : query.businessType,
    pageNum,
    pageSize,
    pageIndex: (pageNum - 1) * pageSize
  };
}

export function pageRaNotification(query: RaNotificationQuery): Promise<Result<any>> {
  return request({
    url: '/ra/v1/notifications/page',
    method: 'post',
    data: withPage(query)
  }) as any;
}

export function getRaNotification(id: number | string): Promise<Result<RaNotification>> {
  return request({
    url: `/ra/v1/notifications/${id}`,
    method: 'get'
  }) as any;
}

export function readRaNotification(id: number | string): Promise<Result<void>> {
  return request({
    url: `/ra/v1/notifications/${id}/read`,
    method: 'put'
  }) as any;
}

export function removeRaNotification(ids: Array<number | string>): Promise<Result<void>> {
  return request({
    url: '/ra/v1/notifications',
    method: 'delete',
    data: ids
  }) as any;
}
