<template>
  <div class="ops-page">
    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <div>
            <span>运维审计</span>
            <small>容器启停、探针重试和采集刷新等操作记录</small>
          </div>
          <el-button icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="operations" border empty-text="暂无运维审计记录">
        <el-table-column label="操作编号" prop="operationNo" min-width="210" show-overflow-tooltip />
        <el-table-column label="操作类型" prop="operationType" min-width="120">
          <template #default="{ row }">{{ operationTypeText(row.operationType) }}</template>
        </el-table-column>
        <el-table-column label="目标服务器" prop="serverCode" min-width="150" show-overflow-tooltip />
        <el-table-column label="目标容器" prop="containerName" min-width="160" show-overflow-tooltip />
        <el-table-column label="结果" prop="status" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前步骤" prop="currentStep" min-width="120">
          <template #default="{ row }">{{ stepText(row.currentStep) }}</template>
        </el-table-column>
        <el-table-column label="开始时间" prop="createdAt" width="180" align="center">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="结束时间" prop="finishedAt" width="180" align="center">
          <template #default="{ row }">{{ formatTime(row.finishedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="OpsAudit" lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getOpsOperations } from '@/api/ops';
import type { OpsOperation } from '@/api/ops/types';

const loading = ref(false);
const operations = ref<OpsOperation[]>([]);

const loadData = async () => {
  loading.value = true;
  try {
    operations.value = await getOpsOperations();
  } catch (error) {
    console.error(error);
    ElMessage.error('运维审计记录加载失败');
  } finally {
    loading.value = false;
  }
};

const operationTypeText = (value?: string) => {
  const map: Record<string, string> = {
    START: '启动容器',
    STOP: '停止容器',
    RESTART: '重启容器',
    UPGRADE: '升级容器',
    PROBE_RETRY: '探针重试',
    COLLECTION_REFRESH: '采集刷新'
  };
  return value ? map[value] || value : '-';
};

const statusText = (value?: string) => {
  const map: Record<string, string> = {
    PENDING: '等待中',
    RUNNING: '执行中',
    SUCCESS: '成功',
    FAILED: '失败'
  };
  return value ? map[value] || value : '-';
};

const statusTagType = (value?: string) => {
  if (value === 'SUCCESS') return 'success';
  if (value === 'FAILED') return 'danger';
  if (value === 'RUNNING') return 'warning';
  return 'info';
};

const stepText = (value?: string) => {
  const map: Record<string, string> = {
    precheck: '前置检查',
    start: '启动',
    stop: '停止',
    restart: '重启',
    upgrade: '升级',
    executing: '执行中',
    completed: '完成',
    failed: '失败',
    'executor-failed': '执行器失败'
  };
  return value ? map[value] || value : '-';
};

const formatTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
};

onMounted(loadData);
</script>

<style scoped lang="scss">
.ops-page {
  padding: 12px;
}

.ops-panel {
  border-radius: 8px;
}

.ops-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span,
  small {
    display: block;
  }

  span {
    color: #1f2937;
    font-weight: 600;
  }

  small {
    margin-top: 4px;
    color: #6b7280;
    font-size: 12px;
    font-weight: 400;
  }
}
</style>
