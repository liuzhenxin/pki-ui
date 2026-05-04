<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>密钥池水位管理</span>
          <div>
            <el-button icon="Refresh" :loading="loading" @click="loadStatus">刷新</el-button>
            <el-button type="primary" icon="Operation" :loading="actionLoading" v-hasPermi="['kmc:poolwatermark:check']" @click="handleCheckAll">
              全量检查补齐
            </el-button>
          </div>
        </div>
      </template>
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="strategyId" label="策略ID" width="100" />
        <el-table-column prop="algType" label="算法" width="120" />
        <el-table-column prop="keyUsage" label="用途" width="120" />
        <el-table-column prop="currentCount" label="当前数量" width="120" />
        <el-table-column prop="lowWatermark" label="低水位" width="100" />
        <el-table-column prop="highWatermark" label="高水位" width="100" />
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'LOW' ? 'danger' : row.status === 'REPLENISHING' ? 'warning' : 'success'">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="Operation" v-hasPermi="['kmc:poolwatermark:check']" @click="handleCheck(row.strategyId)">检查补齐</el-button>
            <el-button link type="primary" icon="Plus" v-hasPermi="['kmc:poolwatermark:generate']" @click="handleGenerate(row.strategyId)">生成</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="KmcPoolWatermark" lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { checkAndReplenishPool, checkAndReplenishPools, generatePoolKeys, getPoolWatermarkStatus } from '@/api/kmc/poolWatermark';
import { unwrapKmcData } from '@/api/kmc/common';

const loading = ref(false);
const actionLoading = ref(false);
const rows = ref<any[]>([]);

const normalizeRows = (data: any) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.poolStats)) {
    return data.poolStats;
  }
  return Object.entries(data ?? {}).map(([strategyId, value]: [string, any]) => ({ strategyId, ...(typeof value === 'object' ? value : { currentCount: value }) }));
};

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    NORMAL: '正常',
    LOW: '低水位',
    REPLENISHING: '补充中'
  };
  return map[status || ''] || status || '-';
};

const loadStatus = async () => {
  loading.value = true;
  try {
    rows.value = normalizeRows(unwrapKmcData(await getPoolWatermarkStatus()));
  } finally {
    loading.value = false;
  }
};

const handleCheckAll = async () => {
  actionLoading.value = true;
  try {
    await checkAndReplenishPools();
    ElMessage.success('水位检查已提交');
    await loadStatus();
  } finally {
    actionLoading.value = false;
  }
};

const handleCheck = async (strategyId: string | number) => {
  await checkAndReplenishPool(strategyId);
  ElMessage.success('策略水位检查已提交');
  await loadStatus();
};

const handleGenerate = async (strategyId: string | number) => {
  await generatePoolKeys(strategyId);
  ElMessage.success('生成任务已提交');
  await loadStatus();
};

onMounted(loadStatus);
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>

