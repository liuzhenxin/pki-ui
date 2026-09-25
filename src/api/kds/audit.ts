import { kdsPost } from './client';

export function exportAudit(payload: { startTime: number; endTime: number }) {
  return kdsPost<Record<string, unknown>>('audit/export', { ...payload, format: 'JSON' });
}

export function verifyAudit(payload: { startTime: number; endTime: number }) {
  return kdsPost<{ checkedCount: number; brokenCount: number; valid: boolean }>('audit/verify', payload);
}
