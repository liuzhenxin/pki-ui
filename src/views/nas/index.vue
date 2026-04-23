<template>
  <div class="nas-dashboard">
    <!-- 数据概览 -->
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-blue">
              <el-icon><Storage /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总存储容量</div>
              <div class="stat-value">20.0 TB</div>
            </div>
          </div>
          <div class="stat-footer">
            <el-progress :percentage="65" :stroke-width="4" />
            <div class="footer-desc">已使用 13.0 TB (65%)</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-green">
              <el-icon><Switch /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">正在运行任务</div>
              <div class="stat-value">{{ runningTasks }}</div>
            </div>
          </div>
          <div class="stat-footer">
            <div class="footer-desc">总迁移任务: {{ totalTasks }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-orange">
              <el-icon><Connection /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">当前活跃连接</div>
              <div class="stat-value">128</div>
            </div>
          </div>
          <div class="stat-footer">
            <div class="footer-desc">NFS: 82 | SMB: 46</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-purple">
              <el-icon><Notification /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">系统运行状态</div>
              <div class="stat-value">健康</div>
            </div>
          </div>
          <div class="stat-footer">
            <div class="footer-desc">运行时间: 142天 5小时</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表展示 -->
    <el-row :gutter="20" class="mt20">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>性能趋势监控 (IOPS & 带宽)</span>
              <el-radio-group v-model="timeRange" size="small">
                <el-radio-button label="1h">近1小时</el-radio-button>
                <el-radio-button label="24h">近24小时</el-radio-button>
                <el-radio-button label="7d">近7天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="performanceChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>文件类型分布</span>
            </div>
          </template>
          <div ref="fileTypeChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 底部：迁移任务与系统日志 -->
    <el-row :gutter="20" class="mt20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>近期迁移任务</span>
              <el-button link type="primary" @click="goMigration">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentTasks" size="small" style="width: 100%">
            <el-table-column prop="name" label="任务名称" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusTag(scope.row.status)" size="small">
                  {{ getStatusLabel(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="150">
              <template #default="scope">
                <el-progress :percentage="scope.row.progress" :stroke-width="2" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>系统事件日志</span>
            </div>
          </template>
          <el-timeline size="small">
            <el-timeline-item
              v-for="(log, index) in systemLogs"
              :key="index"
              :type="log.type"
              :timestamp="log.time"
            >
              {{ log.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { useRouter } from 'vue-router';
import { listTask } from '@/api/nas/migrationTask';

const router = useRouter();
const timeRange = ref('1h');
const performanceChartRef = ref<HTMLElement | null>(null);
const fileTypeChartRef = ref<HTMLElement | null>(null);
let performanceChart: echarts.ECharts | null = null;
let fileTypeChart: echarts.ECharts | null = null;

const runningTasks = ref(0);
const totalTasks = ref(0);
const recentTasks = ref([]);

const systemLogs = ref([
  { time: '2026-04-23 10:15:32', content: '系统自动快照 [Daily_Backup_20260423] 创建成功。', type: 'success' },
  { time: '2026-04-23 09:42:10', content: '用户 admin 修改了 NFS 共享目录 [/data/shared] 的权限。', type: 'info' },
  { time: '2026-04-23 08:00:05', content: '存储池 Pool_01 容量超过 80% 阈值告警。', type: 'warning' },
  { time: '2026-04-22 23:55:18', content: '数据迁移任务 [Oracle_DB_Archive] 已顺利完成。', type: 'success' },
  { time: '2026-04-22 14:20:00', content: '节点 Node-02 网络接口发生瞬时中断，已自动切换。', type: 'danger' }
]);

const getStatusTag = (status: string) => {
  const tags: any = { 'PENDING': 'info', 'RUNNING': 'primary', 'COMPLETED': 'success', 'FAILED': 'danger' };
  return tags[status] || 'info';
};

const getStatusLabel = (status: string) => {
  const labels: any = { 'PENDING': '等待中', 'RUNNING': '运行中', 'COMPLETED': '已完成', 'FAILED': '失败' };
  return labels[status] || status;
};

const goMigration = () => {
  router.push('/nas/migration-task');
};

const initPerformanceChart = () => {
  if (!performanceChartRef.value) return;
  performanceChart = echarts.init(performanceChartRef.value);
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['IOPS', '带宽 (MB/s)'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50', '11:00'] },
    yAxis: [
      { type: 'value', name: 'IOPS', position: 'left' },
      { type: 'value', name: 'MB/s', position: 'right' }
    ],
    series: [
      {
        name: 'IOPS',
        type: 'line',
        smooth: true,
        data: [1200, 1350, 1100, 1600, 2100, 1800, 1950],
        itemStyle: { color: '#409EFF' },
        areaStyle: { opacity: 0.1 }
      },
      {
        name: '带宽 (MB/s)',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: [210, 235, 190, 280, 320, 290, 310],
        itemStyle: { color: '#67C23A' },
        areaStyle: { opacity: 0.1 }
      }
    ]
  };
  performanceChart.setOption(option);
};

const initFileTypeChart = () => {
  if (!fileTypeChartRef.value) return;
  fileTypeChart = echarts.init(fileTypeChartRef.value);
  const option = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '5%', left: 'center' },
    series: [
      {
        name: '文件类型',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: 45, name: '图片/视频', itemStyle: { color: '#409EFF' } },
          { value: 25, name: '数据库文件', itemStyle: { color: '#67C23A' } },
          { value: 15, name: '文档记录', itemStyle: { color: '#E6A23C' } },
          { value: 10, name: '虚拟机镜像', itemStyle: { color: '#F56C6C' } },
          { value: 5, name: '其他', itemStyle: { color: '#909399' } }
        ]
      }
    ]
  };
  fileTypeChart.setOption(option);
};

const fetchTasks = async () => {
  try {
    const response = await listTask({ pageNum: 1, pageSize: 5 });
    if (response && response.rows) {
      recentTasks.value = response.rows.map((t: any) => ({
        ...t,
        progress: t.totalFiles > 0 ? Math.floor((t.migratedFiles / t.totalFiles) * 100) : 0
      }));
      totalTasks.value = response.total;
      runningTasks.value = response.rows.filter((t: any) => t.status === 'RUNNING').length;
    }
  } catch (error) {
    console.error('获取迁移任务失败:', error);
  }
};

const handleResize = () => {
  performanceChart?.resize();
  fileTypeChart?.resize();
};

onMounted(() => {
  fetchTasks();
  nextTick(() => {
    initPerformanceChart();
    initFileTypeChart();
  });
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  performanceChart?.dispose();
  fileTypeChart?.dispose();
});
</script>

<style lang="scss" scoped>
.nas-dashboard {
  .mt20 { margin-top: 20px; }
  
  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      
      .stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: #fff;
        margin-right: 15px;
      }
      
      .bg-blue { background-color: #409EFF; }
      .bg-green { background-color: #67C23A; }
      .bg-orange { background-color: #E6A23C; }
      .bg-purple { background-color: #9C27B0; }
      
      .stat-info {
        .stat-label { font-size: 14px; color: #909399; margin-bottom: 5px; }
        .stat-value { font-size: 20px; font-weight: bold; color: #303133; }
      }
    }
    
    .stat-footer {
      border-top: 1px solid #EBEEF5;
      padding-top: 10px;
      .footer-desc { font-size: 12px; color: #909399; margin-top: 5px; }
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
  }
}
</style>
