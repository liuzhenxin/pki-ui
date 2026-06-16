<template>
  <div class="p-2 trend-stat-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>趋势分析</span>
          <div class="toolbar">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              clearable
              style="width: 260px"
            />
            <el-button v-hasPermi="['ra:stat:trend']" type="primary" icon="Search" @click="getData">查询</el-button>
            <el-button v-hasPermi="['ra:stat:trend']" icon="Refresh" @click="resetQuery">重置</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="stat-content">
        <div class="overview-grid">
          <div v-for="item in overviewCards" :key="item.key" class="overview-item">
            <div class="overview-label">{{ item.label }}</div>
            <div class="overview-value">{{ item.value }}</div>
          </div>
        </div>

        <div class="chart-grid">
          <section class="chart-section wide-section">
            <div class="section-title">综合趋势</div>
            <div ref="combinedChartRef" class="chart large-chart"></div>
          </section>
          <section class="chart-section">
            <div class="section-title">申请 / 签发对比</div>
            <div ref="compareChartRef" class="chart"></div>
          </section>
          <section class="chart-section">
            <div class="section-title">到期趋势</div>
            <div ref="expireChartRef" class="chart"></div>
          </section>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup name="RaTrendStatistics" lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import * as echarts from 'echarts';
import { getRaTrendStatistics } from '@/api/ra/statistics/trend';
import type { TrendItem, TrendStatistics } from '@/api/ra/statistics/trend';

const emptyOverview = {
  periodCertIssueCount: 0,
  periodApplyCount: 0,
  periodRenewalCount: 0,
  periodUpdateCount: 0,
  periodRevokeCount: 0,
  weekExpireCertCount: 0,
  monthExpireCertCount: 0
};

const loading = ref(false);
const dateRange = ref<[string, string] | []>([]);
const combinedChartRef = ref<HTMLDivElement>();
const compareChartRef = ref<HTMLDivElement>();
const expireChartRef = ref<HTMLDivElement>();
let combinedChart: echarts.ECharts | null = null;
let compareChart: echarts.ECharts | null = null;
let expireChart: echarts.ECharts | null = null;

const statistics = reactive<TrendStatistics>({
  overview: { ...emptyOverview },
  certIssueTrend: [],
  applyTrend: [],
  renewalTrend: [],
  updateTrend: [],
  revokeTrend: [],
  expireTrend: []
});

const unwrap = (response: any) => response?.data ?? response;
const overviewCards = computed(() => [
  { key: 'certIssue', label: '区间签发', value: statistics.overview.periodCertIssueCount },
  { key: 'apply', label: '区间申请', value: statistics.overview.periodApplyCount },
  { key: 'renewal', label: '区间续期', value: statistics.overview.periodRenewalCount },
  { key: 'update', label: '区间更新', value: statistics.overview.periodUpdateCount },
  { key: 'revoke', label: '区间吊销', value: statistics.overview.periodRevokeCount },
  { key: 'weekExpire', label: '7天内到期', value: statistics.overview.weekExpireCertCount },
  { key: 'monthExpire', label: '30天内到期', value: statistics.overview.monthExpireCertCount }
]);

async function getData() {
  loading.value = true;
  try {
    const [startDate, endDate] = dateRange.value || [];
    const response = await getRaTrendStatistics({ startDate, endDate });
    const data = unwrap(response) || {};
    Object.assign(statistics.overview, emptyOverview, data.overview || {});
    statistics.certIssueTrend = data.certIssueTrend || [];
    statistics.applyTrend = data.applyTrend || [];
    statistics.renewalTrend = data.renewalTrend || [];
    statistics.updateTrend = data.updateTrend || [];
    statistics.revokeTrend = data.revokeTrend || [];
    statistics.expireTrend = data.expireTrend || [];
    await nextTick();
    renderCharts();
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  dateRange.value = [];
  getData();
}

function dates() {
  return statistics.certIssueTrend.map((item) => item.date);
}

function values(items: TrendItem[]) {
  return items.map((item) => item.value);
}

function renderCharts() {
  renderCombinedChart();
  renderCompareChart();
  renderExpireChart();
}

function renderCombinedChart() {
  if (!combinedChartRef.value) return;
  combinedChart = combinedChart || echarts.init(combinedChartRef.value);
  combinedChart.setOption({
    color: ['#2f80ed', '#0f766e', '#f59e0b', '#7c3aed', '#dc2626'],
    grid: { left: 44, right: 28, top: 42, bottom: 48 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: dates() },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      buildLine('签发', statistics.certIssueTrend),
      buildLine('申请', statistics.applyTrend),
      buildLine('续期', statistics.renewalTrend),
      buildLine('更新', statistics.updateTrend),
      buildLine('吊销', statistics.revokeTrend)
    ]
  });
}

function renderCompareChart() {
  if (!compareChartRef.value) return;
  compareChart = compareChart || echarts.init(compareChartRef.value);
  compareChart.setOption({
    color: ['#0f766e', '#2f80ed'],
    grid: { left: 42, right: 20, top: 42, bottom: 48 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: dates() },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '申请', type: 'bar', barMaxWidth: 22, data: values(statistics.applyTrend) },
      buildLine('签发', statistics.certIssueTrend)
    ]
  });
}

function renderExpireChart() {
  if (!expireChartRef.value) return;
  expireChart = expireChart || echarts.init(expireChartRef.value);
  expireChart.setOption({
    color: ['#b45309'],
    grid: { left: 42, right: 20, top: 28, bottom: 48 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: statistics.expireTrend.map((item) => item.date) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '到期',
        type: 'bar',
        barMaxWidth: 24,
        data: values(statistics.expireTrend)
      }
    ]
  });
}

function buildLine(name: string, items: TrendItem[]) {
  return {
    name,
    type: 'line',
    smooth: true,
    symbolSize: 5,
    lineStyle: { width: 2 },
    data: values(items)
  };
}

function resizeCharts() {
  combinedChart?.resize();
  compareChart?.resize();
  expireChart?.resize();
}

onMounted(() => {
  getData();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  combinedChart?.dispose();
  compareChart?.dispose();
  expireChart?.dispose();
});
</script>

<style scoped lang="scss">
.trend-stat-page {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .stat-content {
    min-height: 620px;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .overview-item {
    min-height: 82px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    padding: 14px;
    background: var(--el-fill-color-extra-light);
  }

  .overview-label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 20px;
  }

  .overview-value {
    margin-top: 8px;
    color: var(--el-text-color-primary);
    font-size: 26px;
    font-weight: 700;
    line-height: 32px;
  }

  .chart-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
  }

  .chart-section {
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    padding: 14px;
    min-width: 0;
  }

  .wide-section {
    grid-column: 1 / -1;
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .chart {
    height: 300px;
  }

  .large-chart {
    height: 360px;
  }
}

@media (max-width: 960px) {
  .trend-stat-page {
    .card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .chart-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
