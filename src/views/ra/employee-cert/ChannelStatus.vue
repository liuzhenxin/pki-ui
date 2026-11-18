<template>
  <el-tag :type="result.type" effect="plain">{{ result.label }}</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status?: string; blocked?: boolean }>();

const result = computed(() => {
  if (props.status === 'SENT') return { type: 'success', label: '已受理' } as const;
  if (props.status === 'FAILED') return { type: 'danger', label: '失败' } as const;
  return { type: 'info', label: props.blocked ? '未发送' : '待发送' } as const;
});
</script>
