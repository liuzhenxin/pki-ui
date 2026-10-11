<template>
  <header class="hsm-page-header">
    <div>
      <div class="hsm-eyebrow">HSM · 服务器密码机</div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div class="hsm-header-actions"><slot /></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ title: string; description: string }>();
</script>
<style scoped>
.hsm-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
.hsm-eyebrow {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
}
h1 {
  margin: 8px 0;
  font-size: 26px;
  color: var(--el-text-color-primary);
}
p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
.hsm-header-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
@media (max-width: 768px) {
  .hsm-page-header {
    align-items: flex-start;
    flex-direction: column;
  }
  h1 {
    font-size: 22px;
  }
}
</style>
