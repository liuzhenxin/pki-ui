import request from '@/utils/request';
export interface InstallationStatus {
  state: 'INSTALLING' | 'COMPLETED';
  rootId: string;
  profileId: string;
  requestorId: string;
  certificateAvailable: boolean;
  crlAvailable: boolean;
  completionAvailable: boolean;
  projectionPending: boolean;
}
export const installationStatus = async (): Promise<InstallationStatus> => {
  const response = await request({ url: '/ca/v1/installation/status', method: 'get' });
  const value = response.data as InstallationStatus;
  if (
    !value ||
    !['INSTALLING', 'COMPLETED'].includes(value.state) ||
    ['certificateAvailable', 'crlAvailable', 'completionAvailable', 'projectionPending'].some(
      (key) => typeof value[key as keyof InstallationStatus] !== 'boolean'
    )
  )
    throw new Error('安装状态不可确认');
  return value;
};
export const installationCertificate = (grant: string, csr: string) =>
  request({ url: '/ca/v1/installation/certificate', method: 'post', data: { csr }, headers: { 'X-Installation-Grant': grant, repeatSubmit: false } });
export const installationCrl = (grant: string) =>
  request({ url: '/ca/v1/installation/initial-crl', method: 'post', headers: { 'X-Installation-Grant': grant, repeatSubmit: false } });
export const completeInstallation = () => request({ url: '/ca/v1/installation/complete', method: 'post' });
