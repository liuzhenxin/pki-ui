import type { AlertConditionRule, AlertConditionType } from '@/api/ops/types';

export function isStateCondition(type: AlertConditionType) {
  return type === 'RA_STANDARD_REVIEW' || type === 'RA_PUBLIC_REVIEW' || type === 'COMPONENT' || type === 'KMC_HSM' || type === 'CA_HSM';
}

export function isThresholdCondition(type: AlertConditionType) {
  return !isStateCondition(type) && type !== 'SERVER_AGENT' && type !== 'RA_CERT_EXPIRY';
}

export function describeCondition(rule: AlertConditionRule, trigger: boolean) {
  if (rule.type === 'RA_STANDARD_REVIEW' || rule.type === 'RA_PUBLIC_REVIEW') {
    return trigger
      ? `连续 ${rule.triggerSamples} 次：待审 ≥ ${rule.pendingLimit} 件或最长等待 ≥ ${rule.waitHours} 小时`
      : `两项均低于阈值连续 ${rule.recoverySamples} 次`;
  }
  if (rule.type === 'RA_CERT_EXPIRY') {
    return trigger ? (rule.expiryDays ?? []).map((days) => (days === 0 ? '已到期' : `到期前 ${days} 天`)).join('、') : 'RA 上报状态变更';
  }
  if (isThresholdCondition(rule.type)) {
    return trigger ? `≥ ${rule.triggerPercent}% 持续 ${rule.triggerSeconds} 秒` : `≤ ${rule.recoveryPercent}% 持续 ${rule.recoverySeconds} 秒`;
  }
  if (isStateCondition(rule.type)) {
    return `连续 ${trigger ? rule.triggerSamples : rule.recoverySamples} 次`;
  }
  return trigger ? `${rule.timeoutSeconds} 秒内无采样` : '收到有效采样';
}
