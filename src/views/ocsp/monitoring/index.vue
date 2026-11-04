<template>
  <div class="app-container ocsp-monitoring">
    <OcspPageHeader title="运行监控" description="查看来源健康、一致性检查与告警记录。" />
    <MonitoringPanel />
  </div>
</template>
<script setup name="OcspMonitoring" lang="ts">
import OcspPageHeader from '@/views/ocsp/components/OcspPageHeader.vue';
import MonitoringPanel from '@/views/ocsp/components/MonitoringPanel.vue';
</script>
<style scoped>
.ocsp-monitoring {
  padding: 24px;
}
@media (max-width: 760px) {
  .ocsp-monitoring {
    padding: 12px;
  }
}
</style>
