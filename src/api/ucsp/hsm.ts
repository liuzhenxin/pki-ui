import type { Result } from '@/api/types';
import request from '@/utils/request';

export interface Target {
  agentKey: string;
  poolKey: string;
  deviceKey: string;
}

export interface Agent {
  key: string;
  enabled: boolean;
  health: 'PENDING' | 'STALE' | 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  reportedAt: string | null;
}

export interface Device {
  key: string;
  poolKey: string;
  agentKey: string;
  enabled: boolean;
  available: boolean;
}

export interface Pool {
  key: string;
  region: string;
  serviceName: string;
  enabled: boolean;
  maxRequests: number;
  windowSeconds: number;
  version: number;
}

export interface Directory {
  targets: Target[];
  agents: Agent[];
  devices: Device[];
  pools: Pool[];
}

const base = '/ucsp/v3/hsm-management';

export const getDirectory = () => request.get<Result<Directory>, Result<Directory>>(base);
export const saveAgent = (data: Pick<Agent, 'key' | 'enabled'>) => request.put(base + '/agents', data);
export const saveDevice = (data: Omit<Device, 'available'>) => request.put(base + '/devices', data);
export const savePool = (data: Pool) => request.put(base + '/pools', data);
