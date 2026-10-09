import request from '@/utils/request';
export type HomeRole = 'SYSADMIN' | 'SECADMIN' | 'AUDITOR';
export interface HomeRow {
  id?: string;
  name?: string;
  subject?: string;
  objectId?: string;
  kind?: string;
  applicant?: string;
  state?: string;
  expiresAt?: string;
  notAfter?: string;
  applicationId?: string;
  operation?: string;
  result?: string;
  time?: string;
  objectName?: string;
  user?: string;
  enabled?: boolean;
}
export interface HomeData {
  deviceState?: string;
  total?: number;
  enabled?: number;
  failed?: number;
  pending?: number;
  executable?: number;
  expiring?: number;
  expired?: number;
  validBindings?: number;
  attention?: number;
  rejected?: number;
  activities?: number;
  from?: string;
  to?: string;
  rows?: HomeRow[];
  waiting?: HomeRow[];
  mine?: HomeRow[];
  executionRows?: HomeRow[];
  counts?: { operation: string; result: string; count: number }[];
}
export interface HomeSection {
  ready: boolean;
  data: HomeData;
  message: string;
}
export interface HomeSummary {
  username: string;
  role: HomeRole;
  updatedAt: string;
  sections: Record<string, HomeSection>;
}
export const summary = (): Promise<HomeSummary> => request({ url: '/admin/svs/home', headers: { hideErrorNotify: true } } as any);
