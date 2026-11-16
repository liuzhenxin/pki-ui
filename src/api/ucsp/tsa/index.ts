import type { Result } from '@/api/types';
import request from '@/utils/request';

export type Algorithm = 'SHA256' | 'SM3';

export interface Endpoint {
  id: string | null;
  version: number;
  name: string;
  configRef: string;
  enabled: boolean;
  healthy: boolean;
}

export interface Pool {
  id: string | null;
  version: number;
  name: string;
  members: string[];
  maxRequests: number;
  windowSeconds: number;
}

export interface TimestampService {
  id: string | null;
  version: number;
  name: string;
  poolId: string;
  primary: string;
  backup: string | null;
  algorithm: Algorithm;
  objectId: string;
  policyOid: string | null;
  enabled: boolean;
}

export interface Directory {
  endpoints: Endpoint[];
  pools: Pool[];
  services: TimestampService[];
  configurationRefs: string[];
}

const base = '/ucsp/v3/tsa-management';

export const getDirectory = () => request.get<Result<Directory>, Result<Directory>>(base);
export const saveEndpoint = ({ id, version, name, configRef, enabled }: Endpoint) =>
  request.put<Result<Endpoint>, Result<Endpoint>>(base + '/endpoints', { id, version, name, configRef, enabled });
export const savePool = (data: Pool) => request.put<Result<Pool>, Result<Pool>>(base + '/pools', data);
export const saveService = (data: TimestampService) => request.put<Result<TimestampService>, Result<TimestampService>>(base + '/services', data);
export const testEndpoint = (id: string, expectedVersion: number, algorithm: Algorithm, policyOid: string) =>
  request.post<Result<string>, Result<string>>(
    base + '/endpoints/' + encodeURIComponent(id) + '/test',
    { expectedVersion, algorithm, policyOid },
    {
      timeout: 20000
    }
  );
