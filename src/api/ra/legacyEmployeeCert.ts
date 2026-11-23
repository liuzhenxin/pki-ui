import request from '@/utils/request';
import type { Result } from '@/api/types';

const endpoint = '/ra/v1/employee-certs/legacy';

export interface LegacyPreviewRow {
  number: number;
  serial?: string;
  account?: string;
  status: string;
  message: string;
}

export interface LegacyPreview {
  token: string;
  total: number;
  eligible: number;
  counts: Record<string, number>;
  rows: LegacyPreviewRow[];
}

export interface LegacyImportResult {
  batchNo?: string;
  imported: number;
  rebound: number;
  repaired: number;
}

export interface LegacyLedgerRow {
  id: string;
  batchNo: string;
  serial: string;
  account: string;
  employeeName: string;
  status: string;
  message: string;
  notAfter: string;
}

export function previewLegacyEmployeeCerts(file: File): Promise<Result<LegacyPreview>> {
  return request({
    url: endpoint + '/preview',
    method: 'post',
    data: file,
    timeout: 120_000,
    headers: { 'Content-Type': 'application/octet-stream', repeatSubmit: false }
  });
}

export function importLegacyEmployeeCerts(file: File, token: string): Promise<Result<LegacyImportResult>> {
  return request({
    url: endpoint + '/import',
    method: 'post',
    data: file,
    timeout: 120_000,
    headers: { 'Content-Type': 'application/octet-stream', 'X-RA-Legacy-Preview': token, repeatSubmit: false }
  });
}

export function pageLegacyEmployeeCerts(pageNum: number, status: string): Promise<Result<{ records: LegacyLedgerRow[]; total: number }>> {
  return request({ url: endpoint, method: 'get', params: { pageNum, status } });
}
