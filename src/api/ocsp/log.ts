import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type { OcspAdminPage, OcspRequestLog, OcspRequestLogPageQry } from '@/api/ocsp/types';

export const pageOcspRequestLogs = (data: OcspRequestLogPageQry) => {
  return request({
    url: '/ocsp/v1/request-logs/page',
    method: 'post',
    data
  }).then((res) => unwrapOcspData<OcspAdminPage<OcspRequestLog>>(res));
};

export const getOcspRequestLog = (id: number) => {
  return request({
    url: `/ocsp/v1/request-logs/${id}`,
    method: 'get'
  }).then((res) => unwrapOcspData<OcspRequestLog>(res));
};

export const exportOcspRequestLogs = (data: OcspRequestLogPageQry) => {
  return request({
    url: '/ocsp/v1/request-logs/export',
    method: 'post',
    data,
    responseType: 'blob'
  });
};
