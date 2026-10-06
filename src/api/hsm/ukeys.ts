import request, { globalHeaders } from '@/utils/request';
import axios from 'axios';

// PIN 请求独立传输，避免通用拦截器缓存、记录或自动重放敏感正文。
const pinTransport = axios.create({ baseURL: import.meta.env.VITE_APP_BASE_API, timeout: 50000 });

export type UkeyRole = 'ADMINISTRATOR' | 'OPERATOR';
export interface UkeyBinding {
  role: UkeyRole;
  slot: number;
  userId: number;
  fingerprint: string;
  active: boolean;
  version: number;
  present: boolean;
}
export interface UkeyStatus {
  device: string;
  configuration: { administrators: number; operators: number; revision: number };
  bindings: UkeyBinding[];
  hostCertificates: { key: string; certificate: string; fingerprint: string }[];
  hostAvailable: boolean;
  auditEvents: { id: number; operation: string; outcome: string; userId: number; occurredAt: string; summary: string }[];
  authorization: { role: UkeyRole; slot: number; fingerprint: string; expiresAt: string } | null;
}
export interface UkeyChallenge {
  id: string;
  expiresAt: string;
}
export function getUkeyStatus() {
  return request<UkeyStatus>({ url: '/hsm/v1/ukeys', method: 'get' });
}
export function configureUkeys(data: UkeyStatus['configuration']) {
  return request({ url: '/hsm/v1/ukeys/configuration', method: 'post', headers: { repeatSubmit: false }, data });
}
export function challengeUkey(data: { purpose: 'APPOINT' | 'REPLACE' | 'LOGIN'; role: UkeyRole; slot: number; certificateKey: string }) {
  const path = data.purpose === 'LOGIN' ? 'login/challenge' : 'appointments/challenge';
  return request<UkeyChallenge>({ url: `/hsm/v1/ukeys/${path}`, method: 'post', headers: { repeatSubmit: false }, data });
}
/** 失败只返回固定错误，丢弃包含 PIN 的 Axios 请求上下文。 */
export async function confirmUkey(challengeId: string, pin: string, appointment: boolean) {
  const body = { challengeId, pin };
  try {
    const response = await pinTransport.post(`/hsm/v1/ukeys/${appointment ? 'appointments/confirm' : 'login'}`, body, {
      headers: { ...globalHeaders(), 'Content-Type': 'application/json;charset=utf-8' }
    });
    if (response.data?.code !== 'OK') throw new Error('UKey 认证失败，请检查登录状态、设备和 PIN');
    return response.data;
  } catch {
    throw new Error('UKey 认证失败，请检查登录状态、设备和 PIN');
  } finally {
    body.pin = '';
  }
}
export function revokeUkey(data: { role: UkeyRole; slot: number; revision: number }) {
  return request({ url: '/hsm/v1/ukeys/revoke', method: 'post', headers: { repeatSubmit: false }, data });
}
export function logoutUkey() {
  return request({ url: '/hsm/v1/ukeys/logout', method: 'post', headers: { repeatSubmit: false } });
}
