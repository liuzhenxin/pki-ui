<template>
  <div class="nas-dashboard" v-loading="loading">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-blue">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">迁移任务总数</div>
              <div class="stat-value">{{ overview.totalTasks }}</div>
            </div>
          </div>
          <div class="stat-footer">累计源文件 {{ formatNumber(overview.totalFiles) }} 个</div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-green">
              <el-icon><Loading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">活跃任务</div>
              <div class="stat-value">{{ overview.activeTasks }}</div>
            </div>
          </div>
          <div class="stat-footer">运行 {{ statusCounts.RUNNING }}，启动 {{ statusCounts.STARTING }}，停止中 {{ statusCounts.STOPPING }}</div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-cyan">
              <el-icon><Files /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已迁移文件</div>
              <div class="stat-value">{{ formatNumber(overview.migratedFiles) }}</div>
            </div>
          </div>
          <el-progress :percentage="overview.fileProgress" :stroke-width="5" />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-red">
              <el-icon><WarningFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">异常任务</div>
              <div class="stat-value">{{ overview.abnormalTasks }}</div>
            </div>
          </div>
          <div class="stat-footer">失败 {{ statusCounts.FAILED }}，完成但有失败 {{ statusCounts.COMPLETED_WITH_FAILURES }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt16">
      <el-col :xs="24" :lg="16">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>迁移文件趋势</span>
              <el-radio-group v-model="timeRange" size="small">
                <el-radio-button value="7d">近7天</el-radio-button>
                <el-radio-button value="30d">近30天</el-radio-button>
                <el-radio-button value="all">全部</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart"></div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>任务状态分布</span>
              <el-button link type="primary" icon="Refresh" @click="fetchDashboard">刷新</el-button>
            </div>
          </template>
          <div ref="statusChartRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt16">
      <el-col :xs="24" :lg="15">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>近期迁移任务</span>
              <el-button link type="primary" @click="goMigration">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentTasks" size="small" height="330" empty-text="暂无迁移任务">
            <el-table-column prop="name" label="任务名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="sourcePath" label="源路径" min-width="180" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="130">
              <template #default="scope">
                <el-tag :type="getStatusTag(scope.row.status)" size="small">{{ getStatusLabel(scope.row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="170">
              <template #default="scope">
                <el-progress :percentage="scope.row.progress" :stroke-width="4" :status="getProgressStatus(scope.row.status)" />
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="170">
              <template #default="scope">{{ formatTime(scope.row.createTime) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="9">
        <el-card shadow="hover" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>任务事件</span>
            </div>
          </template>
          <el-empty v-if="taskEvents.length === 0" description="暂无任务事件" :image-size="80" />
          <el-timeline v-else class="event-timeline">
            <el-timeline-item v-for="event in taskEvents" :key="event.id" :type="event.type" :timestamp="event.time">
              {{ event.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { CircleCheckFilled, Document, Files, Loading, WarningFilled } from '@element-plus/icons-vue';
import { listAllTasks, listTask } from '@/api/nas/migrationTask';

type MigrationTask = {
  id?: number | string;
  name?: string;
  sourcePath?: string;
  targetPath?: string;
  status?: string;
  totalFiles?: number;
  migratedFiles?: number;
  message?: string;
  createTime?: string;
  progress?: number;
};

const router = useRouter();
const loading = ref(false);
const timeRange = ref('7d');
const allTasks = ref<MigrationTask[]>([]);
const recentTasks = ref<MigrationTask[]>([]);
const trendChartRef = ref<HTMLElement | null>(null);
const statusChartRef = ref<HTMLElement | null>(null);
const statusChart = ref<echarts.ECharts | null>(null);
const trendChart = ref<echarts.ECharts | null>(null);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const statusOrder = ['PENDING', 'STARTING', 'RUNNING', 'STOPPING', 'STOPPED', 'COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED'];

const statusCounts = reactive<Record<string, number>>({
  PENDING: 0,
  STARTING: 0,
  RUNNING: 0,
  STOPPING: 0,
  STOPPED: 0,
  COMPLETED: 0,
  COMPLETED_WITH_FAILURES: 0,
  FAILED: 0
});

const overview = computed(() => {
  const totalFiles = allTasks.value.reduce((sum, task) => sum + toNumber(task.totalFiles), 0);
  const migratedFiles = allTasks.value.reduce((sum, task) => sum + toNumber(task.migratedFiles), 0);
  const activeTasks = statusCounts.STARTING + statusCounts.RUNNING + statusCounts.STOPPING;
  const abnormalTasks = statusCounts.FAILED + statusCounts.COMPLETED_WITH_FAILURES;
  return {
    totalTasks: allTasks.value.length,
    activeTasks,
    abnormalTasks,
    totalFiles,
    migratedFiles,
    fileProgress: totalFiles > 0 ? Math.min(100, Math.floor((migratedFiles / totalFiles) * 100)) : 0
  };
});

const taskEvents = computed(() =>
  [...allTasks.value]
    .sort((a, b) => toTimestamp(b.createTime) - toTimestamp(a.createTime))
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      time: formatTime(task.createTime),
      type: getTimelineType(task.status),
      content: `${task.name || '未命名任务'}：${getStatusLabel(task.status || '')}${task.message ? `，${task.message}` : ''}`
    }))
);

function toNumber(value: unknown) {
  return Number(value || 0);
}

function toTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeTasks(response: any): MigrationTask[] {
  const data = response?.data || response || {};
  const records = Array.isArray(data) ? data : data.records || data.rows || [];
  return records.map((task: MigrationTask) => {
    const totalFiles = toNumber(task.totalFiles);
    const migratedFiles = toNumber(task.migratedFiles);
    return {
      ...task,
      totalFiles,
      migratedFiles,
      progress: totalFiles > 0 ? Math.min(100, Math.floor((migratedFiles / totalFiles) * 100)) : 0
    };
  });
}

function resetStatusCounts() {
  statusOrder.forEach((status) => {
    statusCounts[status] = 0;
  });
}

function updateStatusCounts(tasks: MigrationTask[]) {
  resetStatusCounts();
  tasks.forEach((task) => {
    const status = task.status || 'PENDING';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
}

async function fetchDashboard() {
  loading.value = true;
  try {
    const [listResponse, pageResponse] = await Promise.all([listAllTasks({}), listTask({ pageNum: 1, pageSize: 6 })]);
    allTasks.value = normalizeTasks(listResponse);
    recentTasks.value = normalizeTasks(pageResponse);
    updateStatusCounts(allTasks.value);
    await nextTick();
    renderCharts();
    updatePolling();
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  renderStatusChart();
  renderTrendChart();
}

function renderStatusChart() {
  if (!statusChartRef.value) return;
  if (!statusChart.value) statusChart.value = echarts.init(statusChartRef.value);

  const data = statusOrder
    .filter((status) => statusCounts[status] > 0)
    .map((status) => ({
      name: getStatusLabel(status),
      value: statusCounts[status],
      itemStyle: { color: getStatusColor(status) }
    }));

  statusChart.value.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        name: '任务状态',
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['50%', '45%'],
        label: { formatter: '{b}: {c}' },
        data: data.length > 0 ? data : [{ name: '暂无任务', value: 1, itemStyle: { color: '#dcdfe6' } }]
      }
    ]
  });
}

function renderTrendChart() {
  if (!trendChartRef.value) return;
  if (!trendChart.value) trendChart.value = echarts.init(trendChartRef.value);

  const rows = buildTrendRows();
  trendChart.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['源文件数', '已迁移文件数'] },
    grid: { left: 12, right: 18, top: 44, bottom: 12, containLabel: true },
    xAxis: { type: 'category', data: rows.map((row) => row.label), axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '源文件数',
        type: 'bar',
        data: rows.map((row) => row.totalFiles),
        itemStyle: { color: '#409eff' },
        barMaxWidth: 28
      },
      {
        name: '已迁移文件数',
        type: 'line',
        smooth: true,
        data: rows.map((row) => row.migratedFiles),
        itemStyle: { color: '#67c23a' },
        areaStyle: { opacity: 0.12 }
      }
    ]
  });
}

function buildTrendRows() {
  const days = timeRange.value === '30d' ? 30 : timeRange.value === '7d' ? 7 : 0;
  const now = new Date();
  const start = days > 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime() : 0;
  const buckets = new Map<string, { label: string; totalFiles: number; migratedFiles: number }>();

  allTasks.value
    .filter((task) => !start || toTimestamp(task.createTime) >= start)
    .forEach((task) => {
      const key = formatDateKey(task.createTime);
      const row = buckets.get(key) || { label: key, totalFiles: 0, migratedFiles: 0 };
      row.totalFiles += toNumber(task.totalFiles);
      row.migratedFiles += toNumber(task.migratedFiles);
      buckets.set(key, row);
    });

  return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(-30);
}

function formatDateKey(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return '未知日期';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
}

function getStatusTag(status?: string) {
  const tags: Record<string, string> = {
    PENDING: 'info',
    STARTING: 'warning',
    RUNNING: 'primary',
    STOPPING: 'warning',
    STOPPED: 'info',
    COMPLETED: 'success',
    COMPLETED_WITH_FAILURES: 'warning',
    FAILED: 'danger'
  };
  return tags[status || ''] || 'info';
}

function getProgressStatus(status?: string) {
  if (status === 'FAILED') return 'exception';
  if (status === 'COMPLETED' || status === 'COMPLETED_WITH_FAILURES') return 'success';
  return '';
}

function getTimelineType(status?: string) {
  if (status === 'FAILED') return 'danger';
  if (status === 'COMPLETED_WITH_FAILURES' || status === 'STOPPING' || status === 'STARTING') return 'warning';
  if (status === 'COMPLETED') return 'success';
  return 'primary';
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    PENDING: '#909399',
    STARTING: '#e6a23c',
    RUNNING: '#409eff',
    STOPPING: '#d69e2e',
    STOPPED: '#606266',
    COMPLETED: '#67c23a',
    COMPLETED_WITH_FAILURES: '#f59e0b',
    FAILED: '#f56c6c'
  };
  return colors[status] || '#909399';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: '等待中',
    STARTING: '启动中',
    RUNNING: '运行中',
    STOPPING: '停止中',
    STOPPED: '已停止',
    COMPLETED: '已完成',
    COMPLETED_WITH_FAILURES: '已完成，有失败记录',
    FAILED: '失败'
  };
  return labels[status] || status;
}

function goMigration() {
  router.push('/nas/migration-task');
}

function handleResize() {
  statusChart.value?.resize();
  trendChart.value?.resize();
}

function updatePolling() {
  const hasActiveTask = allTasks.value.some((task) => ['STARTING', 'RUNNING', 'STOPPING'].includes(task.status || ''));
  if (hasActiveTask && !refreshTimer) {
    refreshTimer = setInterval(fetchDashboard, 5000);
  }
  if (!hasActiveTask && refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

watch(timeRange, renderTrendChart);

onMounted(() => {
  fetchDashboard();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (refreshTimer) clearInterval(refreshTimer);
  statusChart.value?.dispose();
  trendChart.value?.dispose();
});
</script>

<style lang="scss" scoped>
.nas-dashboard {
  padding: 16px;

  .mt16 {
    margin-top: 16px;
  }

  .stat-card,
  .panel-card {
    border-radius: 8px;
  }

  .stat-card {
    height: 142px;
    margin-bottom: 16px;

    .stat-content {
      display: flex;
      align-items: center;
      min-height: 66px;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 14px;
      color: #fff;
      font-size: 24px;
      flex: 0 0 48px;
    }

    .bg-blue {
      background: #409eff;
    }

    .bg-green {
      background: #67c23a;
    }

    .bg-cyan {
      background: #14b8a6;
    }

    .bg-red {
      background: #f56c6c;
    }

    .stat-info {
      min-width: 0;
    }

    .stat-label {
      font-size: 13px;
      color: #909399;
      line-height: 20px;
    }

    .stat-value {
      color: #303133;
      font-size: 24px;
      line-height: 32px;
      font-weight: 700;
    }

    .stat-footer {
      border-top: 1px solid #ebeef5;
      color: #909399;
      font-size: 12px;
      line-height: 18px;
      padding-top: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .card-header {
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-weight: 600;
  }

  .chart {
    height: 330px;
  }

  .event-timeline {
    height: 330px;
    padding: 4px 8px 0 2px;
    overflow: auto;
  }
}
</style>
