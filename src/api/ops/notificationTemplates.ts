import request from '@/utils/request';
import { opsApiBaseURL } from './index';

export interface TemplateVariable {
  name: string;
  label: string;
  sample: string;
}

interface TemplateOption {
  value: string;
  label: string;
}

export interface NotificationTemplateCatalog {
  applications: (TemplateOption & { scenes: (TemplateOption & { variables: TemplateVariable[] })[] })[];
  channels: TemplateOption[];
  editable: boolean;
}

export interface NotificationTemplateKey {
  application: string;
  scene: string;
  channel: string;
}

export interface NotificationTemplateDraft {
  title: string;
  body: string;
}

export interface NotificationTemplate extends NotificationTemplateDraft {
  revision: string | null;
  origin: 'DEFAULT' | 'INHERITED' | 'CUSTOM';
  inheritedFrom: string | null;
}

const directory = '/v1/alert/notification-templates';

function templateUrl({ application, scene, channel }: NotificationTemplateKey) {
  return [directory, ...[application, scene, channel].map(encodeURIComponent)].join('/');
}

export function getNotificationTemplateCatalog() {
  return request<unknown, NotificationTemplateCatalog>({ baseURL: opsApiBaseURL, url: `${directory}/catalog`, method: 'get' });
}

export function getNotificationTemplate(key: NotificationTemplateKey) {
  return request<unknown, NotificationTemplate>({ baseURL: opsApiBaseURL, url: templateUrl(key), method: 'get' });
}

export function saveNotificationTemplate(key: NotificationTemplateKey, draft: NotificationTemplateDraft, revision: string | null) {
  return request<unknown, NotificationTemplate>({
    baseURL: opsApiBaseURL,
    url: templateUrl(key),
    method: 'put',
    data: { ...draft, revision }
  });
}

export function previewNotificationTemplate(key: NotificationTemplateKey, draft: NotificationTemplateDraft) {
  return request<unknown, NotificationTemplateDraft>({
    baseURL: opsApiBaseURL,
    url: `${templateUrl(key)}/preview`,
    method: 'post',
    data: draft,
    headers: { repeatSubmit: false }
  });
}
