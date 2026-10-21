import { kdsPost } from './client';
import type { RestoreCreateResult, RestoreStatus } from '@/types/kds';

export function createRestore(payload: { deviceSn: string; backupRef: string; confirmationToken: string; idempotencyKey: string }) {
  return kdsPost<RestoreCreateResult>('restore/create', payload);
}

export function getRestoreStatus(taskId: string) {
  return kdsPost<RestoreStatus>('restore/status', { taskId });
}
