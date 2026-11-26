import request from '@/utils/request';
import { opsApiBaseURL, type AlertIncident } from './index';

export interface CpuResource {
  code: string;
  name?: string;
  sampledAt?: string;
  usage: number | null;
  sampleStatus: string;
  activeCount: number;
  condition: { origin: string; triggerPercent: number; recoveryPercent: number; triggerSeconds: number; recoverySeconds: number } | null;
}
const url = '/v1/alert/resources/cpu';
export const getCpuResources = () => request<unknown, CpuResource[]>({ baseURL: opsApiBaseURL, url, method: 'get' });
export const getCpuIncidents = (code: string) =>
  request<unknown, AlertIncident[]>({ baseURL: opsApiBaseURL, url: url + '/' + encodeURIComponent(code) + '/incidents', method: 'get' });
export const conditionOrigins: Record<string, string> = { RESOURCE: '资源专属条件', DEFAULT: '类型默认条件', DEPLOYMENT: '部署配置' };
