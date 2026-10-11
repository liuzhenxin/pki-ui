/** 只翻译已知状态，未知厂商/服务状态保留原值。 */
export function initializationLabel(state?: string): string {
  if (!state) return '尚未查询';
  return (
    ({ UNINITIALIZED: '未初始化', INITIALIZING: '初始化中', READY: '已就绪', FAILED: '初始化失败', MAINTENANCE: '维护中' } as Record<string, string>)[
      state
    ] || state
  );
}
export function auditOutcomeLabel(outcome: string): string {
  return ({ SUCCESS: '成功', FAILURE: '失败', FAILED: '失败', DENIED: '拒绝' } as Record<string, string>)[outcome] || outcome;
}
