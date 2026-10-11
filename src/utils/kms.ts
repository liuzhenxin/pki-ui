import type { EncryptionContext, KeyAction, KeyState } from '@/api/kms/types';

export const keyStateLabels: Record<KeyState, string> = {
  PRE_ACTIVE: '待激活',
  ENABLED: '已启用',
  DISABLED: '已停用',
  COMPROMISED: '已泄露',
  PENDING_DELETION: '待删除',
  DESTROYING: '销毁中',
  DESTROYED: '已销毁',
  DESTROYED_COMPROMISED: '已销毁（曾泄露）'
};
export const actionLabels: Record<KeyAction, string> = {
  rotate: '轮换密钥',
  enable: '启用密钥',
  disable: '停用密钥',
  'schedule-deletion': '安排删除',
  'cancel-deletion': '取消删除'
};
export function canRunAction(state: KeyState, action: KeyAction) {
  if (action === 'rotate' || action === 'disable') return state === 'ENABLED';
  if (action === 'enable') return state === 'PRE_ACTIVE' || state === 'DISABLED';
  if (action === 'cancel-deletion') return state === 'PENDING_DELETION';
  return ['PRE_ACTIVE', 'ENABLED', 'DISABLED', 'COMPROMISED'].includes(state);
}
export function requireKeyId(raw: string) {
  const value = raw.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('请输入完整的密钥 ID（UUID）');
  return value;
}
export function parseEncryptionContext(raw: string): EncryptionContext {
  if (!raw.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('加密上下文须为 JSON 对象，且所有值为字符串');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some((v) => typeof v !== 'string')) {
    throw new Error('加密上下文须为 JSON 对象，且所有值为字符串');
  }
  return value as EncryptionContext;
}
export function requireBase64(raw: string, maxBytes: number) {
  const value = raw.trim();
  if (!value || value.length > Math.ceil(maxBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('请输入有效的标准 Base64 数据');
  }
  const decoded = atob(value);
  if (decoded.length > maxBytes || btoa(decoded) !== value) throw new Error('Base64 数据无效或超出允许长度');
  return value;
}
