<template>
  <div class="ocsp-dashboard">
    <div class="dashboard-header">
      <div>
        <p class="header-label">在线证书状态服务</p>
        <h1>OCSP 服务看板</h1>
        <p class="header-desc">聚合最近请求量、证书状态分布与活跃响应者，不含序列号</p>
      </div>
      <div class="header-actions">
        <el-radio-group v-model="range" @change="loadSummary">
          <el-radio-button value="1h">1 小时</el-radio-button>
          <el-radio-button value="24h">24 小时</el-radio-button>
          <el-radio-button value="7d">7 天</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadSummary">刷新</el-button>
      </div>
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
            <div class="footer-desc">{{ card.desc }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :xs="24" :lg="16">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header"><span>请求量趋势</span></div>
          </template>
          <div ref="lineChartRef" class="chart-panel"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header"><span>证书状态分布</span></div>
          </template>
          <div ref="pieChartRef" class="chart-panel"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :span="24">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header"><span>响应者</span></div>
          </template>
          <el-table v-loading="loading" :data="summary.responders || []" size="small" @row-click="openResponder">
            <template #empty>
              <el-empty description="暂无响应者" :image-size="120" />
            </template>
            <el-table-column prop="name" label="名称" min-width="180" />
            <el-table-column prop="caId" label="CA ID" width="100" />
            <el-table-column prop="signerType" label="签名类型" width="120" />
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="OcspDashboard" lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { Connection, Refresh, TrendCharts, Warning, CircleCheck } from '@element-plus/icons-vue';
import { getOcspDashboardSummary } from '@/api/ocsp/dashboard';
import type { OcspDashboardSummary, OcspResponder } from '@/api/ocsp/types';
import { checkPermi } from '@/utils/permission';

const router = useRouter();
const loading = ref(false);
const range = ref('24h');
const summary = ref<OcspDashboardSummary>({
  range: '24h',
  requestCount: 0,
  successCount: 0,
  unknownCount: 0,
  activeResponderCount: 0,
  series: [],
  statusPie: {},
  responders: []
});
const lineChartRef = ref<HTMLElement | null>(null);
const pieChartRef = ref<HTMLElement | null>(null);
let lineChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

const unknownRatio = computed(() => {
  if (!summary.value.requestCount) {
    return 0;
  }
  return Math.round((summary.value.unknownCount / summary.value.requestCount) * 1000) / 10;
});

const successRatio = computed(() => {
  if (!summary.value.requestCount) {
    return 100;
  }
  return Math.round((summary.value.successCount / summary.value.requestCount) * 1000) / 10;
});

const statCards = computed(() => [
  {
    label: '请求总数',
    value: summary.value.requestCount,
    unit: '次',
    desc: `统计窗口 ${range.value}`,
    icon: TrendCharts,
    iconClass: 'bg-blue'
  },
  {
    label: '成功响应',
    value: successRatio.value,
    unit: '%',
    desc: `${summary.value.successCount} 次 SUCCESS`,
    icon: CircleCheck,
    iconClass: 'bg-green'
  },
  {
    label: 'UNKNOWN',
    value: summary.value.unknownCount,
    unit: '次',
    desc: unknownRatio.value > 5 ? `占比 ${unknownRatio.value}%，请检查验证数据源` : `占比 ${unknownRatio.value}%`,
    icon: Warning,
    iconClass: unknownRatio.value > 5 ? 'bg-orange' : 'bg-purple'
  },
  {
    label: '活跃响应者',
    value: summary.value.activeResponderCount,
    unit: '个',
    desc: 'status = ACTIVE',
    icon: Connection,
    iconClass: 'bg-green'
  }
]);

const renderCharts = () => {
  if (lineChartRef.value) {
    lineChart = lineChart || echarts.init(lineChartRef.value);
    const series = summary.value.series || [];
    lineChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['SUCCESS', 'MALFORMED', '其他'], bottom: 0 },
      grid: { left: 40, right: 20, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: series.map((item) => item.hour) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        { name: 'SUCCESS', type: 'line', smooth: true, data: series.map((item) => item.success) },
        { name: 'MALFORMED', type: 'line', smooth: true, data: series.map((item) => item.malformed || 0) },
        { name: '其他', type: 'line', smooth: true, data: series.map((item) => item.other) }
      ]
    });
  }
  if (pieChartRef.value) {
    pieChart = pieChart || echarts.init(pieChartRef.value);
    const pie = summary.value.statusPie || {};
    pieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center' },
      color: ['#67c23a', '#f56c6c', '#e6a23c'],
      series: [
        {
          name: '证书状态',
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '44%'],
          data: [
            { name: 'GOOD', value: pie.GOOD || 0 },
            { name: 'REVOKED', value: pie.REVOKED || 0 },
            { name: 'UNKNOWN', value: pie.UNKNOWN || 0 }
          ]
        }
      ]
    });
  }
};

const loadSummary = async () => {
  loading.value = true;
  try {
    summary.value = (await getOcspDashboardSummary(range.value)) ?? summary.value;
    await nextTick();
    renderCharts();
  } finally {
    loading.value = false;
  }
};

const openResponder = (row: OcspResponder) => {
  if (checkPermi(['ocsp:responder']) && row.id) {
    router.push({ path: '/ocsp-responder', query: { id: String(row.id) } });
  }
};

const handleResize = () => {
  lineChart?.resize();
  pieChart?.resize();
};

onMounted(async () => {
  await loadSummary();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  lineChart?.dispose();
  pieChart?.dispose();
});
</script>

<style scoped lang="scss">
.ocsp-dashboard {
  padding: 20px;
}

.mt20 {
  margin-top: 20px;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

.card-header {
  font-weight: 600;
}

.chart-panel {
  height: 350px;
}

@media (max-width: 768px) {
  .ocsp-dashboard {
    padding: 12px;
  }

  .dashboard-header,
  .header-actions {
    flex-direction: column;
  }
}
</style>
