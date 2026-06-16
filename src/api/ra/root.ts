import request from '@/utils/request';
import { Result } from '@/api/types';

export function listRaRootCa(query: any): Promise<Result<any>> {
  return request({
    url: '/ra/v1/roots/page',
    method: 'post',
    data: query
  }) as any;
}

export function getRaRootCa(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ra/v1/roots/${id}`,
    method: 'get'
  }) as any;
}

export interface RaAuthorizedCaSyncRequest {
  caAddress: string;
}

export interface RaAuthorizedCaSyncRoot {
  id: string | number;
  name: string;
  profileCount: number;
  profileNames: string[];
}

export interface RaAuthorizedCaSyncResult {
  rootCount: number;
  profileCount: number;
  relationCount: number;
  profileNames: string[];
  roots?: RaAuthorizedCaSyncRoot[];
}

export function syncAuthorizedCa(data: RaAuthorizedCaSyncRequest): Promise<Result<RaAuthorizedCaSyncResult>> {
  return request({
    url: '/ra/v1/init/sync-ca',
    method: 'post',
    data
  });
}
