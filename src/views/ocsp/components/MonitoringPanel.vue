<template>
  <el-card shadow="hover" class="panel"
    ><template #header
      ><div class="header">
        <b>一致性监控与告警</b>
        <div>
          <el-button v-hasPermi="['ocsp:monitoring:run']" :loading="running" @click="run('source-health')">检查来源</el-button
          ><el-button v-hasPermi="['ocsp:monitoring:run']" :loading="running" @click="run('consistency')">检查一致性</el-button
          ><el-button v-hasPermi="['ocsp:monitoring:run']" type="primary" :loading="running" @click="run('alerts')">刷新告警</el-button>
        </div>
      </div></template
    >
    <el-row :gutter="12" v-loading="loading"
      ><el-col v-for="item in cards" :key="item.label" :span="4"><el-statistic :title="item.label" :value="item.value" /></el-col
    ></el-row>
    <el-tabs v-model="tab" @tab-change="loadAlerts"><el-tab-pane label="打开告警" name="open" /><el-tab-pane label="历史" name="history" /></el-tabs>
    <el-table :data="alerts" border
      ><el-table-column prop="lastSeenTime" label="最后出现" width="170" /><el-table-column prop="severity" label="级别" width="90"
        ><template #default="{ row }"
          ><el-tag :type="row.severity === 'ERROR' ? 'danger' : row.severity === 'WARN' ? 'warning' : 'info'">{{ row.severity }}</el-tag></template
        ></el-table-column
      ><el-table-column prop="code" label="代码" width="220" /><el-table-column prop="componentKey" label="组件" min-width="150" /><el-table-column
        prop="safeMessage"
        label="安全消息"
        min-width="180"
      /><el-table-column label="证据" min-width="220"
        ><template #default="{ row }"
          ><span class="evidence">{{ safeEvidence(row.evidence) }}</span></template
        ></el-table-column
      ></el-table
    >
    <el-empty v-if="!loading && !alerts.length" description="暂无告警"
  /></el-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getOcspMonitoringSummary, listOcspAlerts, runOcspMonitoring } from '@/api/ocsp/operations';
import type { OcspAlert, OcspMonitoringSummary } from '@/api/ocsp/types';
const loading = ref(false),
  running = ref(false),
  tab = ref('open');
const summary = ref<OcspMonitoringSummary>({ openAlertCount: 0, sourceAlertCount: 0, signerAlertCount: 0, sloAlertCount: 0, syntheticAlertCount: 0 });
const alerts = ref<OcspAlert[]>([]);
const cards = computed(() => [
  { label: '打开告警', value: summary.value.openAlertCount },
  { label: '来源', value: summary.value.sourceAlertCount },
  { label: '签名', value: summary.value.signerAlertCount },
  { label: 'SLO', value: summary.value.sloAlertCount },
  { label: '合成检查', value: summary.value.syntheticAlertCount },
  { label: '最严重', value: summary.value.worstSeverity || '-' }
]);
const safeEvidence = (v?: string) => {
  if (!v) return '-';
  try {
    return JSON.stringify(JSON.parse(v));
  } catch {
    return v;
  }
};
const loadAlerts = async () => {
  alerts.value = await listOcspAlerts(tab.value === 'history');
};
const load = async () => {
  loading.value = true;
  try {
    summary.value = await getOcspMonitoringSummary();
    await loadAlerts();
  } finally {
    loading.value = false;
  }
};
const run = async (k: 'consistency' | 'source-health' | 'alerts') => {
  running.value = true;
  try {
    await runOcspMonitoring(k);
    ElMessage.success('检查完成');
    await load();
  } finally {
    running.value = false;
  }
};
onMounted(load);
</script>
<style scoped>
.panel {
  margin-top: 16px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.evidence {
  overflow-wrap: anywhere;
}
</style>
