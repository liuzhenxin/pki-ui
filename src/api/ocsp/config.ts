import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type { OcspProbe, OcspRuntimeConfig, OcspStatusSource } from '@/api/ocsp/types';

export const getOcspStatusSource = () => {
  return request({
    url: '/ocsp/v1/config/status-source',
    method: 'get'
  }).then((res) => unwrapOcspData<OcspStatusSource>(res));
};

export const saveOcspStatusSource = (data: OcspStatusSource) => {
  return request({
    url: '/ocsp/v1/config/status-source',
    method: 'put',
    data
  }).then((res) => unwrapOcspData<OcspStatusSource>(res));
};

export const probeOcspStatusSource = () => {
  return request({
    url: '/ocsp/v1/config/status-source/probe',
    method: 'post'
  }).then((res) => unwrapOcspData<OcspProbe>(res));
};

export const getOcspRuntimeConfig = () => {
  return request({
    url: '/ocsp/v1/config/runtime',
    method: 'get'
  }).then((res) => unwrapOcspData<OcspRuntimeConfig>(res));
};

export const saveOcspRuntimeConfig = (data: OcspRuntimeConfig) => {
  return request({
    url: '/ocsp/v1/config/runtime',
    method: 'put',
    data
  }).then((res) => unwrapOcspData<OcspRuntimeConfig>(res));
};

export const clearOcspCache = () => {
  return request({
    url: '/ocsp/v1/config/cache/clear',
    method: 'post'
  }).then((res) => unwrapOcspData<boolean>(res));
};
