<template>
  <el-card shadow="hover" class="panel" v-loading="loading"
    ><template #header
      ><div class="header">
        <b>请求日志保留</b>
        <div>
          <el-button @click="load">刷新</el-button
          ><el-button v-hasPermi="['ocsp:log:admin']" type="danger" :loading="running" @click="purge">立即清理</el-button>
        </div>
      </div></template
    >
    <el-descriptions :column="5" border
      ><el-descriptions-item label="自动清理"
        ><el-tag :type="status.enabled ? 'success' : 'info'">{{ status.enabled ? '启用' : '关闭' }}</el-tag></el-descriptions-item
      ><el-descriptions-item label="保留天数">{{ status.retentionDays ?? '-' }}</el-descriptions-item
      ><el-descriptions-item label="批次大小">{{ status.batchSize ?? '-' }}</el-descriptions-item
      ><el-descriptions-item label="总行数">{{ status.totalRows ?? '-' }}</el-descriptions-item
      ><el-descriptions-item label="已过期">{{ status.expiredRows ?? '-' }}</el-descriptions-item
      ><el-descriptions-item label="最早请求" :span="5">{{ status.oldestRequestTime || '-' }}</el-descriptions-item></el-descriptions
    >
    <el-alert
      v-if="lastResult"
      class="result"
      :type="lastResult.lockAcquired === false ? 'warning' : 'success'"
      :title="lastResult.lockAcquired === false ? '其他节点正在清理' : `已删除 ${lastResult.deletedTotal || 0} 行，共 ${lastResult.batches || 0} 批`"
      :closable="false"
      show-icon
  /></el-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { getOcspRetentionStatus, runOcspRetention } from '@/api/ocsp/operations';
import type { OcspRetentionResult, OcspRetentionStatus } from '@/api/ocsp/types';
const loading = ref(false),
  running = ref(false),
  status = ref<OcspRetentionStatus>({}),
  lastResult = ref<OcspRetentionResult>();
const load = async () => {
  loading.value = true;
  try {
    status.value = await getOcspRetentionStatus();
  } finally {
    loading.value = false;
  }
};
const purge = async () => {
  await ElMessageBox.confirm(
    `将硬删除超过 ${status.value.retentionDays || '-'} 天的请求日志（当前过期 ${status.value.expiredRows || 0} 行），不可恢复。`,
    '确认执行保留清理',
    { type: 'warning', confirmButtonText: '确认清理' }
  );
  running.value = true;
  try {
    lastResult.value = await runOcspRetention();
    await load();
  } finally {
    running.value = false;
  }
};
onMounted(load);
</script>
<style scoped>
.panel {
  margin-bottom: 16px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.result {
  margin-top: 12px;
}
</style>
