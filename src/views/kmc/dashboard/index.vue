<template>
  <div class="kmc-dashboard">
    <div class="dashboard-header">
      <div>
        <p class="header-label">密钥管理中心</p>
        <h1>KMC 密钥管理看板</h1>
        <p class="header-desc">实时监控密钥池存量、算法分布与核心服务健康状态</p>
      </div>
      <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadStats">刷新数据</el-button>
    </div>

    <el-row :gutter="20">
      <el-col v-for="card in statCards" :key="card.label" :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" :class="card.iconClass">
              <el-icon><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">{{ card.label }}</div>
              <div class="stat-value">
                {{ card.value }}
                <span v-if="card.unit">{{ card.unit }}</span>
              </div>
            </div>
          </div>
          <div class="stat-footer">
            <el-progress
              v-if="card.percent !== undefined"
              :percentage="card.percent"
              :stroke-width="4"
              :status="card.progressStatus"
              :show-text="false"
            />
            <div class="footer-desc">{{ card.desc }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :xs="24" :lg="16">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>密钥池水位</span>
              <el-tag :type="lowPoolCount > 0 ? 'danger' : 'success'" effect="light">
                {{ lowPoolCount > 0 ? `${lowPoolCount} 个低水位` : '全部正常' }}
              </el-tag>
            </div>
          </template>

          <div v-loading="loading" class="pool-list">
            <el-empty v-if="poolStats.length === 0" description="暂无密钥池策略数据" :image-size="120" />
            <div v-for="pool in poolStats" v-else :key="pool.strategyId" class="pool-item">
              <div class="pool-head">
                <div>
                  <span class="pool-name">{{ pool.algType || '-' }}</span>
                  <span class="pool-usage">{{ keyUsageText(pool.keyUsage) }}</span>
                </div>
                <el-tag :type="statusTagType(pool.status)" effect="light" size="small">{{ statusText(pool.status) }}</el-tag>
              </div>
              <el-progress :percentage="watermarkPercent(pool)" :status="pool.status === 'LOW' ? 'exception' : undefined" />
              <div class="pool-meta">
                <span>低水位 {{ pool.lowWatermark ?? '-' }}</span>
                <span>当前 {{ pool.currentCount ?? 0 }}</span>
                <span>高水位 {{ pool.highWatermark ?? '-' }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>算法分布</span>
            </div>
          </template>
          <div ref="algoChartRef" class="chart-panel"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :xs="24" :lg="14">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>策略状态明细</span>
            </div>
          </template>
          <el-table v-loading="loading" :data="poolStats" size="small" style="width: 100%">
            <el-table-column prop="strategyId" label="策略ID" width="90" />
            <el-table-column prop="algType" label="算法" width="110" />
            <el-table-column label="用途" width="100">
              <template #default="{ row }">{{ keyUsageText(row.keyUsage) }}</template>
            </el-table-column>
            <el-table-column prop="currentCount" label="当前存量" width="110" align="right" />
            <el-table-column label="水位区间" min-width="170">
              <template #default="{ row }">{{ row.lowWatermark }} / {{ row.highWatermark }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>系统健康事件</span>
            </div>
          </template>
          <el-timeline size="small" class="health-timeline">
            <el-timeline-item v-for="item in healthEvents" :key="item.label" :type="item.type" :timestamp="item.label">
              {{ item.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="KmcDashboard" lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { Coin, Connection, Key, Refresh, TrendCharts, Warning } from '@element-plus/icons-vue';
import { getKmcDashboardStats } from '@/api/kmc/dashboard';
import { unwrapKmcData } from '@/api/kmc/common';

interface PoolStats {
  strategyId: number | string;
  algType: string;
  keyUsage: string;
  currentCount: number;
  lowWatermark: number;
  highWatermark: number;
  status: string;
}

const loading = ref(false);
const stats = ref<any>({});
const algoChartRef = ref<HTMLElement | null>(null);
let algoChart: echarts.ECharts | null = null;

const poolStats = computed<PoolStats[]>(() => stats.value.poolStats ?? []);
const systemHealth = computed(() => stats.value.systemHealth ?? {});
const distributionRows = computed(() =>
  Object.entries(stats.value.keyDistribution ?? {}).map(([algType, count]) => ({
    algType,
    count: Number(count || 0)
  }))
);

const totalKeys = computed(() => distributionRows.value.reduce((sum, item) => sum + item.count, 0));
const lowPoolCount = computed(() => poolStats.value.filter((item) => item.status === 'LOW').length);
const normalPoolPercent = computed(() => {
  if (poolStats.value.length === 0) {
    return 100;
  }
  return Math.round(((poolStats.value.length - lowPoolCount.value) / poolStats.value.length) * 100);
});

const statCards = computed(() => [
  {
    label: '总密钥存量',
    value: totalKeys.value,
    unit: '枚',
    desc: '按算法分布汇总',
    icon: Key,
    iconClass: 'bg-blue'
  },
  {
    label: '密钥池策略',
    value: poolStats.value.length,
    unit: '个',
    desc: `正常策略占比 ${normalPoolPercent.value}%`,
    percent: normalPoolPercent.value,
    progressStatus: lowPoolCount.value > 0 ? 'exception' : 'success',
    icon: TrendCharts,
    iconClass: 'bg-green'
  },
  {
    label: '低水位策略',
    value: lowPoolCount.value,
    unit: '个',
    desc: lowPoolCount.value > 0 ? '需要补充密钥池库存' : '密钥池库存充足',
    icon: Warning,
    iconClass: lowPoolCount.value > 0 ? 'bg-red' : 'bg-orange'
  },
  {
    label: 'API 延迟',
    value: String(systemHealth.value.apiLatency || '-').replace('ms', ''),
    unit: systemHealth.value.apiLatency ? 'ms' : '',
    desc: `HSM ${systemHealth.value.hsmStatus || '-'}，数据库 ${systemHealth.value.dbStatus || '-'}`,
    icon: Connection,
    iconClass: 'bg-purple'
  }
]);

const healthEvents = computed(() => [
  {
    label: 'HSM',
    type: systemHealth.value.hsmStatus === 'UP' ? 'success' : 'danger',
    content: `加密机状态：${systemHealth.value.hsmStatus || '-'}`
  },
  {
    label: '数据库',
    type: systemHealth.value.dbStatus === 'UP' ? 'success' : 'danger',
    content: `业务库连接：${systemHealth.value.dbStatus || '-'}`
  },
  {
    label: '接口',
    type: 'primary',
    content: `核心接口延迟：${systemHealth.value.apiLatency || '-'}`
  },
  {
    label: '密钥池',
    type: lowPoolCount.value > 0 ? 'warning' : 'success',
    content: lowPoolCount.value > 0 ? `发现 ${lowPoolCount.value} 个低水位策略` : '所有策略水位处于正常区间'
  }
]);

const watermarkPercent = (row: PoolStats) => {
  const high = Number(row.highWatermark || 0);
  if (!high) {
    return 0;
  }
  return Math.min(100, Math.round((Number(row.currentCount || 0) / high) * 100));
};

const keyUsageText = (usage?: string) => {
  const map: Record<string, string> = {
    SIGN: '签名',
    ENCRYPT: '加密',
    WRAP: '封装'
  };
  return map[usage || ''] || usage || '-';
};

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    NORMAL: '正常',
    LOW: '低水位',
    REPLENISHING: '补充中'
  };
  return map[status || ''] || status || '-';
};

const statusTagType = (status?: string) => {
  if (status === 'LOW') {
    return 'danger';
  }
  if (status === 'REPLENISHING') {
    return 'warning';
  }
  return 'success';
};

const renderAlgoChart = () => {
  if (!algoChartRef.value) {
    return;
  }
  if (!algoChart) {
    algoChart = echarts.init(algoChartRef.value);
  }
  const data = distributionRows.value.map((item) => ({ name: item.algType, value: item.count }));
  algoChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, left: 'center' },
    color: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399'],
    series: [
      {
        name: '算法分布',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '44%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}' },
        data
      }
    ]
  });
};

const loadStats = async () => {
  loading.value = true;
  try {
    stats.value = unwrapKmcData(await getKmcDashboardStats()) ?? {};
    await nextTick();
    renderAlgoChart();
  } finally {
    loading.value = false;
  }
};

const handleResize = () => {
  algoChart?.resize();
};

watch(distributionRows, () => nextTick(renderAlgoChart));

onMounted(async () => {
  await loadStats();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  algoChart?.dispose();
});
</script>

<style scoped lang="scss">
.kmc-dashboard {
  padding: 20px;

  .mt20 {
    margin-top: 20px;
  }
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.header-label {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.dashboard-header h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 600;
}

.header-desc {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}

.stat-card {
  height: 100%;

  .stat-content {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    margin-right: 15px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24px;
  }

  .bg-blue {
    background-color: #409eff;
  }

  .bg-green {
    background-color: #67c23a;
  }

  .bg-red {
    background-color: #f56c6c;
  }

  .bg-orange {
    background-color: #e6a23c;
  }

  .bg-purple {
    background-color: #626aef;
  }

  .stat-label {
    margin-bottom: 5px;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }

  .stat-value {
    color: var(--el-text-color-primary);
    font-size: 22px;
    font-weight: 700;

    span {
      margin-left: 4px;
      color: var(--el-text-color-secondary);
      font-size: 13px;
      font-weight: 400;
    }
  }

  .stat-footer {
    min-height: 34px;
    padding-top: 10px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .footer-desc {
    margin-top: 5px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.panel-card {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.pool-list {
  min-height: 350px;
}

.pool-item {
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    border-bottom: 0;
  }
}

.pool-head,
.pool-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pool-head {
  margin-bottom: 10px;
}

.pool-name {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.pool-usage {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.pool-meta {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.chart-panel {
  height: 350px;
}

.health-timeline {
  min-height: 252px;
  padding-top: 4px;
}

@media (max-width: 768px) {
  .kmc-dashboard {
    padding: 12px;
  }

  .dashboard-header {
    flex-direction: column;
  }

  .dashboard-header .el-button {
    width: 100%;
  }

  .stat-card {
    margin-bottom: 12px;
  }
}
</style>
