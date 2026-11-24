<template>
  <section aria-label="通知结果">
    <h4>通知结果</h4>
    <div v-for="phase in phases" :key="phase.key">
      <strong>{{ phase.label }}</strong>
      <p v-if="!phase.items.length">没有该阶段的通知记录</p>
      <ul v-else>
        <li v-for="item in phase.items" :key="item.channel + item.status">
          {{ item.channel ? item.channel + ' · ' : '' }}{{ labels[item.status] || item.status }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { IncidentNotificationResult } from '@/api/ops';

const props = defineProps<{ results?: IncidentNotificationResult[]; recovered: boolean }>();
const labels: Record<string, string> = {
  NOTIFICATIONS_DISABLED: '已跳过：自动通知已关闭',
  NO_MATCHING_MESSAGE: '已跳过：没有匹配的投递文案',
  CHANNEL_UNAVAILABLE: '已跳过：渠道未启用或配置不完整',
  NO_RECIPIENT: '已跳过：缺少适用的收件信息',
  PENDING: '等待投递',
  SENDING: '正在投递',
  SENT: '渠道已受理',
  FAILED: '投递失败',
  UNKNOWN: '投递结果未知'
};
const phases = computed(() =>
  ['TRIGGERED', ...(props.recovered ? ['RECOVERED'] : [])].map((key) => ({
    key,
    label: key === 'TRIGGERED' ? '触发通知' : '恢复通知',
    items: props.results?.filter((item) => item.phase === key) ?? []
  }))
);
</script>
