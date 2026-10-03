<template>
  <header class="ocsp-page-heading">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="ocsp-page-actions"><slot /></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
<style scoped>
.ocsp-page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1.7;
}
.ocsp-page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}
.ocsp-page-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
@media (max-width: 760px) {
  .ocsp-page-heading {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 23px;
  }
}
</style>
