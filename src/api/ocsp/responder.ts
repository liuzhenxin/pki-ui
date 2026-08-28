import request from '@/utils/request';
import { unwrapOcspData } from '@/api/ocsp/common';
import type {
  OcspAdminPage,
  OcspResponder,
  OcspResponderCertImportCmd,
  OcspResponderCsr,
  OcspResponderCsrCmd,
  OcspResponderPageQry
} from '@/api/ocsp/types';

export const pageOcspResponders = (data: OcspResponderPageQry) => {
  return request({
    url: '/ocsp/v1/responders/page',
    method: 'post',
    data
  }).then((res) => unwrapOcspData<OcspAdminPage<OcspResponder>>(res));
};

export const getOcspResponder = (id: number) => {
  return request({
    url: `/ocsp/v1/responders/${id}`,
    method: 'get'
  }).then((res) => unwrapOcspData<OcspResponder>(res));
};

export const createOcspResponder = (data: OcspResponder) => {
  return request({
    url: '/ocsp/v1/responders',
    method: 'post',
    data
  }).then((res) => unwrapOcspData<OcspResponder>(res));
};

export const updateOcspResponder = (id: number, data: OcspResponder) => {
  return request({
    url: `/ocsp/v1/responders/${id}`,
    method: 'put',
    data
  }).then((res) => unwrapOcspData<OcspResponder>(res));
};

export const updateOcspResponderStatus = (id: number, status: 'ACTIVE' | 'INACTIVE') => {
  return request({
    url: `/ocsp/v1/responders/${id}/status`,
    method: 'put',
    data: { status }
  }).then((res) => unwrapOcspData<OcspResponder>(res));
};

export const generateOcspResponderCsr = (data: OcspResponderCsrCmd) => {
  return request({
    url: '/ocsp/v1/responders/csr',
    method: 'post',
    data
  }).then((res) => unwrapOcspData<OcspResponderCsr>(res));
};

export const getOcspResponderCsr = (name: string) => {
  return request({
    url: '/ocsp/v1/responders/csr',
    method: 'get',
    params: { name }
  }).then((res) => unwrapOcspData<OcspResponderCsr>(res));
};

export const importOcspResponderCertificate = (data: OcspResponderCertImportCmd) => {
  return request({
    url: '/ocsp/v1/responders/cert',
    method: 'post',
    data
  }).then((res) => unwrapOcspData<OcspResponder>(res));
};
