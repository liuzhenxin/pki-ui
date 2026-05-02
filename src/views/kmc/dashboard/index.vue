<template>
  <div class="p-2">
    <el-row :gutter="12" class="mb-3">
      <el-col :xs="24" :sm="8">
        <el-card shadow="never">
          <el-statistic title="密钥池策略数" :value="poolStats.length" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card shadow="never">
          <el-statistic title="低水位策略" :value="lowPoolCount" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card shadow="never">
          <el-statistic title="算法类型数" :value="distributionRows.length" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :xs="24" :lg="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>密钥池水位</span>
              <el-button icon="Refresh" :loading="loading" @click="loadStats">刷新</el-button>
            </div>
          </template>
          <el-table v-loading="loading" :data="poolStats" border>
            <el-table-column prop="strategyId" label="策略ID" width="100" />
            <el-table-column prop="algType" label="算法" width="120" />
            <el-table-column prop="keyUsage" label="用途" width="120" />
            <el-table-column prop="currentCount" label="当前数量" width="120" />
            <el-table-column label="水位" min-width="220">
              <template #default="{ row }">
                <el-progress :percentage="watermarkPercent(row)" :status="row.status === 'LOW' ? 'exception' : undefined" />
                <span class="muted">{{ row.lowWatermark }} / {{ row.highWatermark }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="130" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'LOW' ? 'danger' : row.status === 'REPLENISHING' ? 'warning' : 'success'">
                  {{ statusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card shadow="never" class="mb-3">
          <template #header>系统健康</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="HSM">{{ systemHealth.hsmStatus || '-' }}</el-descriptions-item>
            <el-descriptions-item label="数据库">{{ systemHealth.dbStatus || '-' }}</el-descriptions-item>
            <el-descriptions-item label="API 延迟">{{ systemHealth.apiLatency || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card shadow="never">
          <template #header>算法分布</template>
          <el-table :data="distributionRows" border>
            <el-table-column prop="algType" label="算法" />
            <el-table-column prop="count" label="数量" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="KmcDashboard" lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getKmcDashboardStats } from '@/api/kmc/dashboard';
import { unwrapKmcData } from '@/api/kmc/common';

const loading = ref(false);
const stats = ref<any>({});

const poolStats = computed(() => stats.value.poolStats ?? []);
const systemHealth = computed(() => stats.value.systemHealth ?? {});
const distributionRows = computed(() =>
  Object.entries(stats.value.keyDistribution ?? {}).map(([algType, count]) => ({ algType, count }))
);
const lowPoolCount = computed(() => poolStats.value.filter((item: any) => item.status === 'LOW').length);

const watermarkPercent = (row: any) => {
  const high = Number(row.highWatermark || 0);
  if (!high) {
    return 0;
  }
  return Math.min(100, Math.round((Number(row.currentCount || 0) / high) * 100));
};

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    NORMAL: '正常',
    LOW: '低水位',
    REPLENISHING: '补充中'
  };
  return map[status || ''] || status || '-';
};

const loadStats = async () => {
  loading.value = true;
  try {
    stats.value = unwrapKmcData(await getKmcDashboardStats()) ?? {};
  } finally {
    loading.value = false;
  }
};

onMounted(loadStats);
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>

