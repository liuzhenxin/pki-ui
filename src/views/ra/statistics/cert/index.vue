<template>
  <div class="p-2 cert-stat-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>证书统计</span>
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
            <el-button v-hasPermi="['ra:stat:cert']" type="primary" icon="Search" @click="getData">查询</el-button>
            <el-button v-hasPermi="['ra:stat:cert']" icon="Refresh" @click="resetQuery">重置</el-button>
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
          <section class="chart-section">
            <div class="section-title">证书状态分布</div>
            <div ref="statusChartRef" class="chart"></div>
          </section>
          <section class="chart-section">
            <div class="section-title">根 CA 分布</div>
            <div ref="rootChartRef" class="chart"></div>
          </section>
          <section class="chart-section trend-section">
            <div class="section-title">新增趋势</div>
            <div ref="trendChartRef" class="chart"></div>
          </section>
          <section class="chart-section">
            <div class="section-title">模板排行</div>
            <el-table :data="statistics.profileStats" height="280" border>
              <el-table-column type="index" label="排名" width="70" align="center" />
              <el-table-column prop="name" label="模板" min-width="160" show-overflow-tooltip />
              <el-table-column prop="value" label="证书数" width="110" align="right" />
            </el-table>
          </section>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup name="RaCertStatistics" lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import * as echarts from 'echarts';
import { getRaCertStatistics } from '@/api/ra/statistics/cert';
import type { CertStatistics } from '@/api/ra/statistics/cert';

const emptyOverview = {
  totalCertCount: 0,
  validCertCount: 0,
  revokedCertCount: 0,
  expiredCertCount: 0,
  pendingCertCount: 0,
  newCertCount: 0,
  renewedCertCount: 0,
  updatedCertCount: 0,
  todayExpireCertCount: 0,
  weekExpireCertCount: 0,
  monthExpireCertCount: 0
};

const loading = ref(false);
const dateRange = ref<[string, string] | []>([]);
const statusChartRef = ref<HTMLDivElement>();
const rootChartRef = ref<HTMLDivElement>();
const trendChartRef = ref<HTMLDivElement>();
let statusChart: echarts.ECharts | null = null;
let rootChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

const statistics = reactive<CertStatistics>({
  overview: { ...emptyOverview },
  statusStats: [],
  rootStats: [],
  profileStats: [],
  trendStats: []
});

const unwrap = (response: any) => response?.data ?? response;
const overviewCards = computed(() => [
  { key: 'total', label: '证书总数', value: statistics.overview.totalCertCount },
  { key: 'valid', label: '有效证书', value: statistics.overview.validCertCount },
  { key: 'revoked', label: '吊销证书', value: statistics.overview.revokedCertCount },
  { key: 'expired', label: '过期证书', value: statistics.overview.expiredCertCount },
  { key: 'pending', label: '待审核申请', value: statistics.overview.pendingCertCount },
  { key: 'new', label: '区间新增', value: statistics.overview.newCertCount },
  { key: 'renewed', label: '区间续期', value: statistics.overview.renewedCertCount },
  { key: 'updated', label: '区间更新', value: statistics.overview.updatedCertCount },
  { key: 'todayExpire', label: '今日到期', value: statistics.overview.todayExpireCertCount },
  { key: 'weekExpire', label: '7天内到期', value: statistics.overview.weekExpireCertCount },
  { key: 'monthExpire', label: '30天内到期', value: statistics.overview.monthExpireCertCount }
]);

async function getData() {
  loading.value = true;
  try {
    const [startDate, endDate] = dateRange.value || [];
    const response = await getRaCertStatistics({ startDate, endDate });
    const data = unwrap(response) || {};
    Object.assign(statistics.overview, emptyOverview, data.overview || {});
    statistics.statusStats = data.statusStats || [];
    statistics.rootStats = data.rootStats || [];
    statistics.profileStats = data.profileStats || [];
    statistics.trendStats = data.trendStats || [];
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

function renderCharts() {
  renderStatusChart();
  renderRootChart();
  renderTrendChart();
}

function renderStatusChart() {
  if (!statusChartRef.value) return;
  statusChart = statusChart || echarts.init(statusChartRef.value);
  statusChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['50%', '44%'],
        data: statistics.statusStats,
        label: { formatter: '{b}: {c}' }
      }
    ]
  });
}

function renderRootChart() {
  if (!rootChartRef.value) return;
  rootChart = rootChart || echarts.init(rootChartRef.value);
  rootChart.setOption({
    grid: { left: 42, right: 20, top: 28, bottom: 70 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: statistics.rootStats.map((item) => item.name),
      axisLabel: { interval: 0, rotate: 30 }
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: statistics.rootStats.map((item) => item.value),
        barMaxWidth: 34,
        itemStyle: { color: '#2f80ed' }
      }
    ]
  });
}

function renderTrendChart() {
  if (!trendChartRef.value) return;
  trendChart = trendChart || echarts.init(trendChartRef.value);
  trendChart.setOption({
    grid: { left: 42, right: 24, top: 30, bottom: 44 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: statistics.trendStats.map((item) => item.date) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'line',
        smooth: true,
        data: statistics.trendStats.map((item) => item.value),
        areaStyle: { opacity: 0.14 },
        symbolSize: 6,
        lineStyle: { width: 3, color: '#16a34a' },
        itemStyle: { color: '#16a34a' }
      }
    ]
  });
}

function resizeCharts() {
  statusChart?.resize();
  rootChart?.resize();
  trendChart?.resize();
}

onMounted(() => {
  getData();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  statusChart?.dispose();
  rootChart?.dispose();
  trendChart?.dispose();
});
</script>

<style scoped lang="scss">
.cert-stat-page {
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
    min-height: 560px;
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

  .trend-section {
    grid-column: span 1;
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .chart {
    height: 280px;
  }
}

@media (max-width: 960px) {
  .cert-stat-page {
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
