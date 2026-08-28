import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type { OcspCertStatus } from '@/api/ocsp/types';

export const queryOcspCertStatus = (params: { caId: number; serialNumber: string; bypassCache?: boolean }) => {
  return request({
    url: '/ocsp/v1/cert-status',
    method: 'get',
    params
  }).then((res) => unwrapOcspData<OcspCertStatus>(res));
};
