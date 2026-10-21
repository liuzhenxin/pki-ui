import { kdsPost } from './client';
import type { AlertEventView, AlertSettings, AlertTestResult, EvidenceSummary, OpsStatus } from '@/types/kds';

export function getOpsStatus() {
  return kdsPost<OpsStatus>('ops/status');
}

export function getAlertSettings() {
  return kdsPost<AlertSettings>('ops/alerts/settings');
}

export function getAlertEvents(limit = 20) {
  return kdsPost<{ events: AlertEventView[] }>('ops/alerts/events', { limit });
}

export function testAlert() {
  return kdsPost<AlertTestResult>('ops/alerts/test');
}

export function getDestructionStatus() {
  return kdsPost<import('@/types/kds').DestructionStatus>('ops/destruction/status');
}

export function executeDestruction(confirmation: string) {
  return kdsPost<{ reportId: string; state: string; steps: string[] }>('ops/destruction', { reason: confirmation });
}

export function registerEvidence(payload: { type: string; reference: string; environment?: string; note?: string }) {
  return kdsPost<EvidenceSummary>('ops/evidence/register', payload);
}

export function queryEvidence(payload: { type?: string; limit?: number }) {
  return kdsPost<{ items: EvidenceSummary[] }>('ops/evidence/query', payload);
}
