import request from '@/utils/request';

export interface CryptoDeviceStatus {
  status: 'UP' | 'DOWN';
  deviceId: string;
  provider: string;
  vendor: string;
  deviceName: string;
  maskedSerial: string;
  deviceVersion: string;
  standardVersion: string;
  algorithms: string[];
  sessionPoolSize: number;
  availableSessions: number;
  borrowTimeoutMs: number;
  lastSuccessAt?: string;
  latencyMs: number;
  errorCategory?: string;
  message: string;
}

export const getCryptoDeviceStatus = (refresh = false) => {
  return request({
    url: '/kmc/v1/crypto-devices/status',
    method: 'get',
    params: { refresh }
  });
};
