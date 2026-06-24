<template>
  <div class="kmc-watermark-page">
    <!-- 水位概览 -->
    <el-row :gutter="16" class="summary-row">
      <el-col :span="6">
        <div class="stat-card stat-total">
          <div class="stat-value">{{ rows.length }}</div>
          <div class="stat-label">策略总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-normal">
          <div class="stat-value">{{ normalCount }}</div>
          <div class="stat-label">水位正常</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-low">
          <div class="stat-value">{{ lowCount }}</div>
          <div class="stat-label">低于水位</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-high">
          <div class="stat-value">{{ highCount }}</div>
          <div class="stat-label">超水位</div>
        </div>
      </el-col>
    </el-row>

    <!-- 策略列表 -->
    <el-card shadow="never" class="table-card">
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
      <el-table v-loading="loading" :data="rows" border :header-cell-style="{ background: '#f8f9fa', color: '#606266', fontWeight: 600 }">
        <template #empty>
          <el-empty description="暂无策略数据" :image-size="80" />
        </template>
        <el-table-column prop="algType" label="算法" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="light">{{ row.algType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="poolName" label="密钥池" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.poolName || row.algType + '加密密钥池' || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="密钥数量" min-width="220" align="center">
          <template #default="{ row }">
            <div class="watermark-bar-cell">
              <div class="watermark-info">
                <span class="watermark-count">{{ row.currentCount ?? 0 }}</span>
                <span class="watermark-range">/ {{ row.lowWatermark ?? 0 }} ~ {{ row.highWatermark ?? 0 }}</span>
              </div>
              <el-progress
                :percentage="watermarkPercentage(row)"
                :color="watermarkColor(row)"
                :stroke-width="6"
                :show-text="false"
                style="margin-top: 4px"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="light" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="Operation" size="small" v-hasPermi="['kmc:poolwatermark:check']" @click="handleCheck(row.strategyId)">
              检查补齐
            </el-button>
            <el-button link type="primary" icon="Plus" size="small" v-hasPermi="['kmc:poolwatermark:generate']" @click="handleGenerate(row.strategyId)">
              生成
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 最近检查结果 -->
    <el-card v-if="lastResult" shadow="never" class="result-card">
      <template #header>
        <div class="card-header">
          <span>最近检查补齐结果</span>
          <el-button link type="primary" icon="Close" @click="lastResult = null">关闭</el-button>
        </div>
      </template>
      <el-descriptions v-if="lastResultType === 'all'" border :column="3" size="small">
        <el-descriptions-item label="检查策略">{{ lastResult.checkedStrategies ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="需要补齐">{{ lastResult.strategiesNeedingReplenishment ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="补齐成功">{{ lastResult.successfullyReplenished ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="补齐失败">
          <span :style="{ color: (lastResult.failedReplenishment || 0) > 0 ? 'var(--el-color-danger)' : '' }">{{ lastResult.failedReplenishment ?? 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="生成密钥">{{ lastResult.totalKeysGenerated ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="执行状态">
          <el-tag :type="(lastResult.failedReplenishment || 0) > 0 ? 'danger' : 'success'" size="small">
            {{ (lastResult.failedReplenishment || 0) > 0 ? '部分失败' : '完成' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-descriptions v-else border :column="3" size="small">
        <el-descriptions-item label="策略ID">{{ lastResult.strategyId ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="当前数量">{{ lastResult.currentCount ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标数量">{{ lastResult.targetCount ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="低水位">{{ lastResult.lowWatermark ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="高水位">{{ lastResult.highWatermark ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="生成数量">{{ lastResult.generatedCount ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="执行状态">
          <el-tag :type="lastResult.success ? 'success' : 'danger'" size="small">{{ lastResult.success ? '成功' : '失败' }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup name="KmcPoolWatermark" lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { checkAndReplenishPool, checkAndReplenishPools, generatePoolKeys, getPoolWatermarkStatus } from '@/api/kmc/poolWatermark';
import { unwrapKmcData } from '@/api/kmc/common';

const loading = ref(false);
const actionLoading = ref(false);
const rows = ref<any[]>([]);
const lastResult = ref<any>(null);
const lastResultType = ref<'all' | 'strategy'>('all');

const normalCount = computed(() => rows.value.filter((r) => statusTagType(r.status) === 'success').length);
const lowCount = computed(() => rows.value.filter((r) => statusTagType(r.status) === 'danger').length);
const highCount = computed(() => rows.value.filter((r) => statusTagType(r.status) === 'warning').length);

const watermarkPercentage = (row: any) => {
  const cur = Number(row.currentCount ?? 0);
  const high = Number(row.highWatermark ?? 100);
  if (high <= 0) return 0;
  return Math.min(100, Math.round((cur / high) * 100));
};

const watermarkColor = (row: any) => {
  const status = statusTagType(row.status);
  if (status === 'danger') return '#f56c6c';
  if (status === 'warning') return '#e6a23c';
  return '#67c23a';
};

const normalizeRows = (data: any) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.poolStats)) return data.poolStats;
  return Object.entries(data ?? {}).map(([strategyId, value]: [string, any]) => ({
    strategyId,
    ...(typeof value === 'object' ? value : { currentCount: value })
  }));
};

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    BELOW_LOW: '低于低水位',
    NORMAL: '正常',
    AT_HIGH: '达到高水位',
    ABOVE_HIGH: '超过高水位',
    LOW: '低水位',
    REPLENISHING: '补充中'
  };
  return map[status || ''] || status || '-';
};

const statusTagType = (status?: string) => {
  if (status === 'BELOW_LOW' || status === 'LOW') return 'danger';
  if (status === 'ABOVE_HIGH' || status === 'AT_HIGH') return 'warning';
  if (status === 'REPLENISHING') return 'info';
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
.kmc-watermark-page {
  padding: 4px;
}

.summary-row {
  margin-bottom: 16px;
}

.stat-card {
  padding: 20px 16px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-total .stat-value { color: var(--el-color-primary); }
.stat-normal .stat-value { color: var(--el-color-success); }
.stat-low .stat-value { color: var(--el-color-danger); }
.stat-high .stat-value { color: var(--el-color-warning); }

.table-card,
.result-card {
  & + & {
    margin-top: 16px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.watermark-bar-cell {
  padding: 2px 8px;
}

.watermark-info {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 2px;
}

.watermark-count {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.watermark-range {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 768px) {
  .summary-row {
    .el-col {
      margin-bottom: 8px;
    }
  }

  .stat-value {
    font-size: 24px;
  }
}
</style>
