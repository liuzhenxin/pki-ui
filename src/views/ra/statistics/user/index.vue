<template>
  <div class="p-2 user-stat-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>用户统计</span>
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
            <el-button v-hasPermi="['ra:stat:user']" type="primary" icon="Search" @click="getData">查询</el-button>
            <el-button v-hasPermi="['ra:stat:user']" icon="Refresh" @click="resetQuery">重置</el-button>
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
            <div class="section-title">申请状态分布</div>
            <div ref="applyStatusChartRef" class="chart"></div>
          </section>
          <section class="chart-section">
            <div class="section-title">部门用户分布</div>
            <div ref="deptChartRef" class="chart"></div>
          </section>
          <section class="chart-section trend-section">
            <div class="section-title">申请趋势</div>
            <div ref="trendChartRef" class="chart"></div>
          </section>
          <section class="chart-section">
            <div class="section-title">用户证书排行</div>
            <el-table :data="statistics.userCertStats" height="280" border>
              <el-table-column type="index" label="排名" width="70" align="center" />
              <el-table-column prop="name" label="用户" min-width="160" show-overflow-tooltip />
              <el-table-column prop="value" label="证书数" width="110" align="right" />
            </el-table>
          </section>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup name="RaUserStatistics" lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import * as echarts from 'echarts';
import { getRaUserStatistics } from '@/api/ra/statistics/user';
import type { UserStatistics } from '@/api/ra/statistics/user';

const emptyOverview = {
  totalUserCount: 0,
  activeUserCount: 0,
  disabledUserCount: 0,
  signedUserCertCount: 0,
  totalApplyCount: 0,
  periodApplyCount: 0,
  pendingApplyCount: 0,
  approvedApplyCount: 0,
  rejectedApplyCount: 0,
  totalOwnedCertCount: 0
};

const loading = ref(false);
const dateRange = ref<[string, string] | []>([]);
const applyStatusChartRef = ref<HTMLDivElement>();
const deptChartRef = ref<HTMLDivElement>();
const trendChartRef = ref<HTMLDivElement>();
let applyStatusChart: echarts.ECharts | null = null;
let deptChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

const statistics = reactive<UserStatistics>({
  overview: { ...emptyOverview },
  applyStatusStats: [],
  deptStats: [],
  userCertStats: [],
  trendStats: []
});

const unwrap = (response: any) => response?.data ?? response;
const overviewCards = computed(() => [
  { key: 'totalUser', label: '用户总数', value: statistics.overview.totalUserCount },
  { key: 'activeUser', label: '启用用户', value: statistics.overview.activeUserCount },
  { key: 'disabledUser', label: '停用用户', value: statistics.overview.disabledUserCount },
  { key: 'signedUserCert', label: '已签发用户证书', value: statistics.overview.signedUserCertCount },
  { key: 'totalApply', label: '申请总数', value: statistics.overview.totalApplyCount },
  { key: 'periodApply', label: '区间申请', value: statistics.overview.periodApplyCount },
  { key: 'pendingApply', label: '待审批申请', value: statistics.overview.pendingApplyCount },
  { key: 'approvedApply', label: '已通过申请', value: statistics.overview.approvedApplyCount },
  { key: 'rejectedApply', label: '已拒绝申请', value: statistics.overview.rejectedApplyCount },
  { key: 'ownedCert', label: '用户拥有证书', value: statistics.overview.totalOwnedCertCount }
]);

async function getData() {
  loading.value = true;
  try {
    const [startDate, endDate] = dateRange.value || [];
    const response = await getRaUserStatistics({ startDate, endDate });
    const data = unwrap(response) || {};
    Object.assign(statistics.overview, emptyOverview, data.overview || {});
    statistics.applyStatusStats = data.applyStatusStats || [];
    statistics.deptStats = data.deptStats || [];
    statistics.userCertStats = data.userCertStats || [];
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
  renderApplyStatusChart();
  renderDeptChart();
  renderTrendChart();
}

function renderApplyStatusChart() {
  if (!applyStatusChartRef.value) return;
  applyStatusChart = applyStatusChart || echarts.init(applyStatusChartRef.value);
  applyStatusChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['50%', '44%'],
        data: statistics.applyStatusStats,
        label: { formatter: '{b}: {c}' }
      }
    ]
  });
}

function renderDeptChart() {
  if (!deptChartRef.value) return;
  deptChart = deptChart || echarts.init(deptChartRef.value);
  deptChart.setOption({
    grid: { left: 42, right: 20, top: 28, bottom: 70 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: statistics.deptStats.map((item) => item.name),
      axisLabel: { interval: 0, rotate: 30 }
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: statistics.deptStats.map((item) => item.value),
        barMaxWidth: 34,
        itemStyle: { color: '#0f766e' }
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
        lineStyle: { width: 3, color: '#2f80ed' },
        itemStyle: { color: '#2f80ed' }
      }
    ]
  });
}

function resizeCharts() {
  applyStatusChart?.resize();
  deptChart?.resize();
  trendChart?.resize();
}

onMounted(() => {
  getData();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  applyStatusChart?.dispose();
  deptChart?.dispose();
  trendChart?.dispose();
});
</script>

<style scoped lang="scss">
.user-stat-page {
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
  .user-stat-page {
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
