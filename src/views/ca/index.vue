<template>
  <div class="ca-dashboard">
    <!-- 数据概览 -->
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-blue">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总签发证书</div>
              <div class="stat-value">{{ stats.totalCerts }}</div>
            </div>
          </div>
          <div class="stat-footer">
            <div class="footer-desc">累计签发总量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-green">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">有效证书</div>
              <div class="stat-value">{{ stats.validCerts }}</div>
            </div>
          </div>
          <div class="stat-footer">
            <el-progress :percentage="Math.round((stats.validCerts / stats.totalCerts) * 100) || 0" :stroke-width="4" status="success" />
            <div class="footer-desc">占比 {{ Math.round((stats.validCerts / stats.totalCerts) * 100) || 0 }}%</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-red">
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已吊销证书</div>
              <div class="stat-value">{{ stats.revokedCerts }}</div>
            </div>
          </div>
          <div class="stat-footer">
            <div class="footer-desc">包含手动吊销及异常证书</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon bg-orange">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">即将过期</div>
              <div class="stat-value">{{ stats.expiringSoon }}</div>
            </div>
          </div>
          <div class="stat-footer">
            <div class="footer-desc">未来30天内到期</div>
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
              <span>证书签发趋势</span>
              <el-radio-group v-model="timeRange" size="small">
                <el-radio-button label="week">近一周</el-radio-button>
                <el-radio-button label="month">近一月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>算法分布</span>
            </div>
          </template>
          <div ref="algoChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 底部：近期证书与审计日志 -->
    <el-row :gutter="20" class="mt20">
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>最新签发证书</span>
              <el-button link type="primary" @click="goCertList">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentCerts" size="small" style="width: 100%">
            <el-table-column prop="serialNumber" label="序列号" width="120" show-overflow-tooltip />
            <el-table-column prop="subject" label="主题" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)" size="small">
                  {{ getStatusLabel(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createTime" label="签发时间" width="160" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>安全审计事件</span>
            </div>
          </template>
          <el-timeline size="small">
            <el-timeline-item
              v-for="(log, index) in securityLogs"
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
import { ref, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import * as echarts from 'echarts';
import { useRouter } from 'vue-router';
import { pageCert } from '@/api/ca/cert';

const router = useRouter();
const timeRange = ref('week');
const trendChartRef = ref<HTMLElement | null>(null);
const algoChartRef = ref<HTMLElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let algoChart: echarts.ECharts | null = null;

const stats = reactive({
  totalCerts: 1250,
  validCerts: 1180,
  revokedCerts: 42,
  expiringSoon: 28
});

const recentCerts = ref([]);

const securityLogs = ref([
  { time: '2026-04-23 11:05:21', content: '管理员 admin 签发了新证书 [Serial: 7A...E1]', type: 'primary' },
  { time: '2026-04-23 10:30:45', content: '系统自动发布了最新的 CRL 列表', type: 'success' },
  { time: '2026-04-23 09:15:02', content: '发现 3 个证书进入 30 天过期预警范围', type: 'warning' },
  { time: '2026-04-22 16:40:18', content: '审计员 auditor 审核并批准了一项吊销请求', type: 'info' },
  { time: '2026-04-22 14:22:55', content: '检测到非授权 IP 尝试访问管理接口 (已拦截)', type: 'danger' }
]);

const getStatusType = (status: string) => {
  const types: any = { 'VALID': 'success', 'REVOKED': 'danger', 'EXPIRED': 'warning' };
  return types[status] || 'info';
};

const getStatusLabel = (status: string) => {
  const labels: any = { 'VALID': '有效', 'REVOKED': '已吊销', 'EXPIRED': '已过期' };
  return labels[status] || status;
};

const goCertList = () => {
  router.push('/ca/cert');
};

const initTrendChart = () => {
  if (!trendChartRef.value) return;
  trendChart = echarts.init(trendChartRef.value);
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value', name: '签发数量' },
    series: [
      {
        name: '签发量',
        type: 'line',
        smooth: true,
        data: [120, 132, 101, 134, 90, 230, 210],
        itemStyle: { color: '#409EFF' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.3)' },
            { offset: 1, color: 'rgba(64,158,255,0)' }
          ])
        }
      }
    ]
  };
  trendChart.setOption(option);
};

const initAlgoChart = () => {
  if (!algoChartRef.value) return;
  algoChart = echarts.init(algoChartRef.value);
  const option = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '5%', left: 'center' },
    series: [
      {
        name: '算法分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: 850, name: 'SM2 (国密)', itemStyle: { color: '#67C23A' } },
          { value: 400, name: 'RSA-2048', itemStyle: { color: '#409EFF' } }
        ]
      }
    ]
  };
  algoChart.setOption(option);
};

const fetchRecentCerts = async () => {
  try {
    const res = await pageCert({ pageNum: 1, pageSize: 5 });
    recentCerts.value = res.data.rows || res.data.records || [];
  } catch (error) {
    console.error('获取证书列表失败:', error);
  }
};

const handleResize = () => {
  trendChart?.resize();
  algoChart?.resize();
};

onMounted(() => {
  fetchRecentCerts();
  nextTick(() => {
    initTrendChart();
    initAlgoChart();
  });
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  algoChart?.dispose();
});
</script>

<style lang="scss" scoped>
.ca-dashboard {
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
      .bg-red { background-color: #F56C6C; }
      .bg-orange { background-color: #E6A23C; }
      
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
