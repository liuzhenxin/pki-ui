<template>
  <div class="app-container ocsp-monitoring">
    <h1>运行监控</h1>
    <p>查看来源健康、一致性检查与告警记录。</p>
    <MonitoringPanel />
  </div>
</template>
<script setup name="OcspMonitoring" lang="ts">
import MonitoringPanel from '@/views/ocsp/components/MonitoringPanel.vue';
</script>
<style scoped>
.ocsp-monitoring {
  padding: 28px;
}
h1 {
  font-size: 26px;
  margin: 0 0 10px;
}
p {
  color: var(--el-text-color-secondary);
}
</style>
