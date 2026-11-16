import request from '@/utils/request';

export interface UcspInitStatus {
  initialized: boolean;
  progress: -1 | 0 | 1 | 2;
  agreementVersion: string;
}

export interface UcspInitCheck {
  key: string;
  ready: boolean;
}

const base = '/ucsp/v1/init';

export const getUcspInitStatus = async (): Promise<UcspInitStatus> => (await request({ url: base + '/status' })).data;

export const acceptUcspAgreement = async (agreementVersion: string): Promise<UcspInitStatus> =>
  (await request({ url: base + '/agreement', method: 'post', data: { accepted: true, agreementVersion } })).data;

export const checkUcspEnvironment = async (): Promise<UcspInitCheck[]> => (await request({ url: base + '/env' })).data.checks;

export const confirmUcspEnvironment = async (): Promise<UcspInitStatus> => (await request({ url: base + '/env', method: 'post' })).data;

export const completeUcspInstallation = async (agreementVersion: string, adminPassword: string, auditorPassword: string): Promise<UcspInitStatus> =>
  (
    await request({
      url: base + '/admin',
      method: 'post',
      headers: { sensitive: true, repeatSubmit: false },
      data: { expectedProgress: 2, accepted: true, agreementVersion, adminPassword, auditorPassword }
    })
  ).data;
