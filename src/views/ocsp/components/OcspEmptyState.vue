<template>
  <div class="ocsp-empty-state" :class="{ 'is-error': error }" :role="error ? 'alert' : 'status'">
    <el-icon class="state-icon" :size="24" aria-hidden="true"><Warning v-if="error" /><InfoFilled v-else /></el-icon>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="state-actions"><slot /></div>
  </div>
</template>
<script setup lang="ts">
import { InfoFilled, Warning } from '@element-plus/icons-vue';
defineProps<{ title: string; description?: string; error?: boolean }>();
</script>
<style scoped>
.ocsp-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 190px;
  padding: 28px 20px;
  text-align: center;
  white-space: normal;
  line-height: 1.6;
}
.state-icon {
  display: flex;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}
.is-error .state-icon {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
p {
  max-width: 440px;
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.state-actions {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
