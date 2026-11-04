<template>
  <el-card shadow="never" class="panel"
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
      ><el-col v-for="item in cards" :key="item.label" :xs="12" :sm="8" :lg="4"
        ><div class="monitor-metric">
          <span>{{ item.label }}</span
          ><strong>{{ item.value }}</strong>
        </div></el-col
      ></el-row
    >
    <el-tabs v-model="tab" @tab-change="load"><el-tab-pane label="打开告警" name="open" /><el-tab-pane label="历史" name="history" /></el-tabs>
    <el-alert v-if="summaryError" type="error" title="监控摘要读取失败，当前状态未确认" :closable="false" class="summary-error" />
    <el-table v-loading="loading" :data="alerts" border
      ><template #empty
        ><OcspEmptyState
          v-if="!loading"
          :error="alertsError"
          :title="alertsError ? '告警读取失败' : tab === 'history' ? '暂无历史告警' : '暂无打开告警'"
          :description="alertsError ? '请重新加载，不能将读取失败视为没有告警。' : '当前查询未返回告警记录，服务健康请结合诊断结果判断。'"
          ><el-button v-if="alertsError" @click="load">重新加载</el-button></OcspEmptyState
        ></template
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
  </el-card>
</template>
<script setup lang="ts">
import OcspEmptyState from './OcspEmptyState.vue';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getOcspMonitoringSummary, listOcspAlerts, runOcspMonitoring } from '@/api/ocsp/operations';
import type { OcspAlert, OcspMonitoringSummary } from '@/api/ocsp/types';
const loading = ref(false),
  running = ref(false),
  tab = ref('open');
const summary = ref<OcspMonitoringSummary>();
const summaryError = ref(false);
const alertsError = ref(false);
const alerts = ref<OcspAlert[]>([]);
const cards = computed(() => [
  { label: '打开告警', value: summary.value?.openAlertCount ?? '-' },
  { label: '来源', value: summary.value?.sourceAlertCount ?? '-' },
  { label: '签名', value: summary.value?.signerAlertCount ?? '-' },
  { label: 'SLO', value: summary.value?.sloAlertCount ?? '-' },
  { label: '合成检查', value: summary.value?.syntheticAlertCount ?? '-' },
  { label: '最严重', value: summary.value?.worstSeverity || '-' }
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
  alertsError.value = false;
  alerts.value = [];
  try {
    alerts.value = await listOcspAlerts(tab.value === 'history');
  } catch {
    alertsError.value = true;
  }
};
const load = async () => {
  loading.value = true;
  try {
    await Promise.allSettled([
      (async () => {
        summaryError.value = false;
        summary.value = undefined;
        try {
          summary.value = await getOcspMonitoringSummary();
        } catch {
          summaryError.value = true;
        }
      })(),
      loadAlerts()
    ]);
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
.monitor-metric {
  padding: 12px 0 20px;
}
.monitor-metric span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.monitor-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.summary-error {
  margin: 16px 0;
}
@media (max-width: 760px) {
  .header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
