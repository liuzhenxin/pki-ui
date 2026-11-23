<template>
  <el-tag :type="result.type" effect="plain">{{ result.label }}</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status?: string; blocked?: boolean }>();

const result = computed(() => {
  if (props.status === 'SENT') return { type: 'success', label: '已受理' } as const;
  if (props.status === 'FAILED') return { type: 'danger', label: '失败' } as const;
  if (props.status === 'UNKNOWN') return { type: 'warning', label: '结果待核实' } as const;
  if (props.status === 'NOT_APPLICABLE') return { type: 'info', label: '未选择' } as const;
  if (props.status === 'NOT_SENT') return { type: 'info', label: '未发送' } as const;
  if (props.status === 'SENDING') return { type: 'info', label: '发送中' } as const;
  return { type: 'info', label: props.blocked ? '未发送' : '待发送' } as const;
});
</script>
