<template>
  <el-tag :type="status.type" effect="light">{{ status.label }}</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BusinessReminderResult } from '@/api/ra/businessNoticeSettings';

const props = defineProps<{ result?: BusinessReminderResult; unavailable?: boolean }>();
const states = {
  SENT: { label: '已提醒', type: 'success' },
  FAILED: { label: '提醒失败', type: 'danger' },
  PENDING: { label: '提醒中', type: 'warning' },
  UNKNOWN: { label: '结果待核实', type: 'warning' }
} as const;
const status = computed(() => props.result ? states[props.result] : {
  label: props.unavailable ? '读取失败' : '未涉及', type: 'info' as const
});
</script>
