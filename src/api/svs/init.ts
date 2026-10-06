import request from '@/utils/request';
export const SVS_TENANT_CODE = 'svs';
export const SVS_INIT_PATH = '/svs/init';
export interface Initialization {
  locked: boolean;
  platformTenantValid: boolean;
  deviceReady: boolean;
  tenantId: number;
  code: string;
}
export const getSvsInitialization = (): Promise<Initialization> => request({ url: '/admin/svs/init', method: 'get' });
export const completeSvsInitialization = (subjects: Record<string, string>): Promise<void> =>
  request({ url: '/admin/svs/init/complete', method: 'post', data: subjects });
