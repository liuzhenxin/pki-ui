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
            <el-tag :type="statusTagType(row.status)">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="Operation" v-hasPermi="['kmc:poolwatermark:check']" @click="handleCheck(row.strategyId)"
              >检查补齐</el-button
            >
            <el-button link type="primary" icon="Plus" v-hasPermi="['kmc:poolwatermark:generate']" @click="handleGenerate(row.strategyId)"
              >生成</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="lastResult" shadow="never" class="mt-3">
      <template #header>最近检查补齐结果</template>
      <el-descriptions v-if="lastResultType === 'all'" border :column="3">
        <el-descriptions-item label="检查策略">{{ lastResult.checkedStrategies }}</el-descriptions-item>
        <el-descriptions-item label="需要补齐">{{ lastResult.strategiesNeedingReplenishment }}</el-descriptions-item>
        <el-descriptions-item label="补齐成功">{{ lastResult.successfullyReplenished }}</el-descriptions-item>
        <el-descriptions-item label="补齐失败">{{ lastResult.failedReplenishment }}</el-descriptions-item>
        <el-descriptions-item label="生成密钥">{{ lastResult.totalKeysGenerated }}</el-descriptions-item>
        <el-descriptions-item label="执行状态">
          <el-tag :type="lastResult.failedReplenishment > 0 ? 'danger' : 'success'">
            {{ lastResult.failedReplenishment > 0 ? '部分失败' : '完成' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="lastResult.failureDetails?.length" label="失败详情" :span="3">
          <div v-for="item in lastResult.failureDetails" :key="item">{{ item }}</div>
        </el-descriptions-item>
      </el-descriptions>
      <el-descriptions v-else border :column="3">
        <el-descriptions-item label="策略ID">{{ lastResult.strategyId }}</el-descriptions-item>
        <el-descriptions-item label="当前数量">{{ lastResult.currentCount }}</el-descriptions-item>
        <el-descriptions-item label="目标数量">{{ lastResult.targetCount }}</el-descriptions-item>
        <el-descriptions-item label="低水位">{{ lastResult.lowWatermark }}</el-descriptions-item>
        <el-descriptions-item label="高水位">{{ lastResult.highWatermark }}</el-descriptions-item>
        <el-descriptions-item label="生成数量">{{ lastResult.generatedCount }}</el-descriptions-item>
        <el-descriptions-item label="执行状态">
          <el-tag :type="lastResult.success ? 'success' : 'danger'">{{ lastResult.success ? '成功' : '失败' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="lastResult.failureReason" label="失败原因" :span="2">{{ lastResult.failureReason }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup name="KmcPoolWatermark" lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { checkAndReplenishPool, checkAndReplenishPools, generatePoolKeys, getPoolWatermarkStatus } from '@/api/kmc/poolWatermark';
import { unwrapKmcData } from '@/api/kmc/common';

const loading = ref(false);
const actionLoading = ref(false);
const rows = ref<any[]>([]);
const lastResult = ref<any>(null);
const lastResultType = ref<'all' | 'strategy'>('all');

const normalizeRows = (data: any) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.poolStats)) {
    return data.poolStats;
  }
  return Object.entries(data ?? {}).map(([strategyId, value]: [string, any]) => ({
    strategyId,
    ...(typeof value === 'object' ? value : { currentCount: value })
  }));
};

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    BELOW_LOW: '低水位',
    NORMAL: '正常',
    AT_HIGH: '达到高水位',
    ABOVE_HIGH: '超过高水位',
    LOW: '低水位',
    REPLENISHING: '补充中'
  };
  return map[status || ''] || status || '-';
};

const statusTagType = (status?: string) => {
  if (status === 'BELOW_LOW' || status === 'LOW') {
    return 'danger';
  }
  if (status === 'ABOVE_HIGH' || status === 'AT_HIGH') {
    return 'warning';
  }
  return 'success';
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
    lastResult.value = unwrapKmcData(await checkAndReplenishPools());
    lastResultType.value = 'all';
    if (lastResult.value?.failedReplenishment > 0) {
      ElMessage.warning(`检查完成，失败 ${lastResult.value.failedReplenishment} 个策略`);
    } else if (lastResult.value?.failureDetails?.length) {
      ElMessage.success(lastResult.value.failureDetails[0]);
    } else {
      ElMessage.success(`检查完成，生成 ${lastResult.value?.totalKeysGenerated || 0} 个备用密钥`);
    }
    await loadStatus();
  } finally {
    actionLoading.value = false;
  }
};

const handleCheck = async (strategyId: string | number) => {
  lastResult.value = unwrapKmcData(await checkAndReplenishPool(strategyId));
  lastResultType.value = 'strategy';
  if (lastResult.value?.success === false) {
    ElMessage.error(lastResult.value.failureReason || '策略水位补齐失败');
  } else if (lastResult.value?.failureReason) {
    ElMessage.success(lastResult.value.failureReason);
  } else if ((lastResult.value?.generatedCount || 0) > 0) {
    ElMessage.success(`补齐完成，生成 ${lastResult.value.generatedCount} 个备用密钥`);
  } else {
    ElMessage.success('水位正常，无需补齐');
  }
  await loadStatus();
};

const handleGenerate = async (strategyId: string | number) => {
  const { value } = await ElMessageBox.prompt('请输入生成数量', '生成备用密钥', {
    confirmButtonText: '生成',
    cancelButtonText: '取消',
    inputValue: '1',
    inputPattern: /^(?:[1-9]\d{0,2}|1000)$/,
    inputErrorMessage: '生成数量必须为 1-1000'
  });
  const result = unwrapKmcData(await generatePoolKeys(strategyId, Number(value)));
  if (result?.success === false) {
    ElMessage.error(result.failureReason || '生成备用密钥失败');
    await loadStatus();
    return;
  }
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
