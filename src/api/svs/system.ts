import request from '@/utils/request';
export interface DeviceInformation {
  server: {
    productName: string;
    manufacturer: string;
    serialNumber: string;
    model: string;
    architecture: string;
    operatingSystem: string;
    softwareVersion: string;
  };
  device: {
    manufacturer: string;
    serialNumber: string;
    model: string;
    hardwareVersion: string;
    firmwareVersion: string;
    interfaceVersion: string;
    state: string;
    lastSuccessAt: string | null;
  };
  observedAt: string;
}
export const deviceInformation = (): Promise<DeviceInformation> =>
  request({ url: '/admin/svs/device-information', headers: { hideErrorNotify: true } } as any);
