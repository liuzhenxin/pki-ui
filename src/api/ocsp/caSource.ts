import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type { OcspProbe, OcspStatusSource } from '@/api/ocsp/types';

export const listOcspCaStatusSources = () => {
  return request({
    url: '/ocsp/v1/ca-status-sources',
    method: 'get'
  }).then((res) => unwrapOcspData<OcspStatusSource[]>(res));
};

export const getOcspCaStatusSource = (caId: number) => {
  return request({
    url: `/ocsp/v1/ca-status-sources/${caId}`,
    method: 'get'
  }).then((res) => unwrapOcspData<OcspStatusSource | null>(res));
};

export const saveOcspCaStatusSource = (data: OcspStatusSource) => {
  return request({
    url: '/ocsp/v1/ca-status-sources',
    method: 'put',
    data
  }).then((res) => unwrapOcspData<OcspStatusSource>(res));
};

export const removeOcspCaStatusSource = (caId: number) => {
  return request({
    url: `/ocsp/v1/ca-status-sources/${caId}`,
    method: 'delete'
  }).then((res) => unwrapOcspData<boolean>(res));
};

export const probeOcspCaStatusSource = (caId: number) => {
  return request({
    url: '/ocsp/v1/ca-status-sources/probe',
    method: 'post',
    data: { caId }
  }).then((res) => unwrapOcspData<OcspProbe>(res));
};
