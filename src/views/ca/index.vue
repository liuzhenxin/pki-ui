<template>
  <div class="ca-dashboard">
    <div
      v-if="loadingStatus"
      v-loading="true"
      style="height: 500px; display: flex; align-items: center; justify-content: center; flex-direction: column"
    >
      <span style="margin-top: 15px; color: #909399">正在检查系统状态...</span>
    </div>

    <div v-else-if="!isInitialized" class="uninitialized-container">
      <el-card class="init-card" shadow="never">
        <el-result icon="warning" title="CA 系统尚未初始化" sub-title="检测到当前租户尚未完成 CA 系统的初始化配置，请先完成初始化向导。">
          <template #extra>
            <el-button type="primary" size="large" @click="goInit"> 前往初始化向导 </el-button>
          </template>
        </el-result>
      </el-card>
    </div>

    <div v-else>
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
                  <el-radio-button value="week">近一周</el-radio-button>
                  <el-radio-button value="month">近一月</el-radio-button>
                </el-radio-group>
              </div>
            </template>
            <div ref="trendChartRef" style="height: 350px"></div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <span>算法分布</span>
              </div>
            </template>
            <div ref="algoChartRef" style="height: 350px"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 底部：近期证书与审计日志 -->
      <el-row v-if="isCaBusinessAdmin" :gutter="20" class="mt20">
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
              <el-timeline-item v-for="(log, index) in securityLogs" :key="index" :type="log.type" :timestamp="log.time">
                {{ log.content }}
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, nextTick, getCurrentInstance, ComponentInternalInstance, watch, computed } from 'vue';
import * as echarts from 'echarts';
import { useRouter } from 'vue-router';
import { pageCert } from '@/api/ca/cert';
import { getTenant } from '@/api/system/tenant';
import { useUserStore } from '@/store/modules/user';
import { X509, ASN1HEX } from 'jsrsasign';

const router = useRouter();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const userStore = useUserStore();
const isCaBusinessAdmin = computed(() => {
  const permissions = userStore.permissions || [];
  const isAdmin = permissions.includes('ca:admin') || permissions.includes('setup');
  const hasCertAccess = permissions.includes('ca:cert:page') || permissions.includes('ca:archive-cert:page');
  return hasCertAccess && !isAdmin;
});
const timeRange = ref('week');
const trendChartRef = ref<HTMLElement | null>(null);
const algoChartRef = ref<HTMLElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let algoChart: echarts.ECharts | null = null;

const isInitialized = ref(false);
const loadingStatus = ref(true);

const stats = reactive({
  totalCerts: 0,
  validCerts: 0,
  revokedCerts: 0,
  expiringSoon: 0
});

const allCerts = ref<any[]>([]);
const recentCerts = ref<any[]>([]);
const algoDistribution = ref<{ name: string; value: number; itemStyle?: { color: string } }[]>([]);

const securityLogs = ref<any[]>([]);

const checkInitialization = async () => {
  try {
    const tenantId = userStore.tenantId || localStorage.getItem('tenantId');
    if (tenantId) {
      const res = await getTenant(tenantId);
      // 根据系统逻辑，status === -1 表示已完成初始化
      isInitialized.value = res.data.status === -1;
    }
  } catch (error) {
  } finally {
    loadingStatus.value = false;
  }
};

const getStatusType = (status: string) => {
  const types: any = { VALID: 'success', REVOKED: 'danger', EXPIRED: 'warning', HOLD: 'info' };
  return types[status] || 'info';
};

const getStatusLabel = (status: string) => {
  const labels: any = { VALID: '有效', REVOKED: '已吊销', EXPIRED: '已过期', HOLD: '已冻结' };
  return labels[status] || status;
};

const goCertList = () => {
  router.push('/ca/cert');
};

const goInit = () => {
  proxy?.$tab.openPage('/ca/init', 'CA系统初始化');
};

const initTrendChart = () => {
  if (!trendChartRef.value) return;
  trendChart = echarts.init(trendChartRef.value);
  renderTrendChart();
};

const renderTrendChart = () => {
  if (!trendChart) return;
  const trend = buildIssueTrend();
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trend.labels },
    yAxis: { type: 'value', name: '签发数量' },
    series: [
      {
        name: '签发量',
        type: 'line',
        smooth: true,
        data: trend.values,
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
  renderAlgoChart();
};

const renderAlgoChart = () => {
  if (!algoChart) return;
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
        data: algoDistribution.value.length ? algoDistribution.value : [{ value: 0, name: '暂无证书', itemStyle: { color: '#909399' } }]
      }
    ]
  };
  algoChart.setOption(option);
};

const fetchDashboardData = async () => {
  try {
    const certs = await fetchAllCerts();
    allCerts.value = certs.map(normalizeCert);
    updateStats();
    updateAlgoDistribution();
    if (isCaBusinessAdmin.value) {
      updateRecentCerts();
      updateSecurityLogs();
    }
  } catch (error) {}
};

const fetchAllCerts = async () => {
  const pageSize = 500;
  const first = await pageCert({ pageNum: 1, pageSize });
  const firstPage = unwrapPage(first);
  const records = [...firstPage.records];
  const total = Number(firstPage.total || records.length);
  const maxTotal = Math.min(total, 2000);
  const pageCount = Math.ceil(maxTotal / pageSize);
  for (let pageNum = 2; pageNum <= pageCount; pageNum++) {
    const page = unwrapPage(await pageCert({ pageNum, pageSize }));
    records.push(...page.records);
  }
  return records;
};

const unwrapPage = (res: any) => {
  const data = res?.data ?? res;
  const records = data?.records || data?.rows || data?.data || (Array.isArray(data) ? data : []);
  const total = data?.total || data?.totalCount || records.length;
  return { records, total };
};

const normalizeCert = (cert: any) => {
  const issueTime = parseDate(cert.notBefore || cert.createTime || cert.lastUpdate);
  const notAfter = parseDate(cert.notAfter);
  return {
    ...cert,
    status: resolveCertStatus(cert),
    issueTime,
    issueTimeText: formatDate(issueTime),
    createTime: cert.createTime || cert.notBefore || cert.lastUpdate || '',
    notAfterDate: notAfter,
    algorithm: resolveCertAlgorithm(cert)
  };
};

const updateStats = () => {
  stats.totalCerts = allCerts.value.length;
  stats.validCerts = allCerts.value.filter((item) => item.status === 'VALID').length;
  stats.revokedCerts = allCerts.value.filter((item) => item.status === 'REVOKED').length;
  stats.expiringSoon = allCerts.value.filter((item) => isExpiringSoon(item)).length;
};

const updateRecentCerts = () => {
  recentCerts.value = [...allCerts.value].sort((a, b) => dateTime(b.issueTime) - dateTime(a.issueTime)).slice(0, 5);
};

const updateAlgoDistribution = () => {
  const colors: Record<string, string> = {
    'SM2 (国密)': '#67C23A',
    RSA: '#409EFF',
    ECDSA: '#E6A23C',
    EdDSA: '#909399',
    其他: '#C0C4CC'
  };
  const counts = allCerts.value.reduce((acc: Record<string, number>, cert) => {
    acc[cert.algorithm] = (acc[cert.algorithm] || 0) + 1;
    return acc;
  }, {});
  algoDistribution.value = Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    itemStyle: { color: colors[name] || colors['其他'] }
  }));
};

const updateSecurityLogs = () => {
  const logs = [...allCerts.value]
    .sort((a, b) => dateTime(b.issueTime) - dateTime(a.issueTime))
    .slice(0, 5)
    .map((cert) => ({
      time: cert.createTime || cert.issueTimeText,
      content: `${cert.status === 'REVOKED' ? '证书已吊销' : '证书已签发'} [Serial: ${shortSerial(cert.serialNumber)}] ${cert.subject || ''}`,
      type: cert.status === 'REVOKED' ? 'danger' : cert.status === 'EXPIRED' ? 'warning' : 'primary'
    }));
  if (stats.expiringSoon > 0) {
    logs.unshift({
      time: formatDate(new Date()),
      content: `${stats.expiringSoon} 个证书将在 30 天内到期`,
      type: 'warning'
    });
  }
  securityLogs.value = logs;
};

const buildIssueTrend = () => {
  const days = timeRange.value === 'month' ? 30 : 7;
  const labels: string[] = [];
  const counts: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = formatDay(d);
    labels.push(key);
    counts[key] = 0;
  }
  allCerts.value.forEach((cert) => {
    if (!cert.issueTime) return;
    const key = formatDay(cert.issueTime);
    if (key in counts) {
      counts[key] += 1;
    }
  });
  return { labels, values: labels.map((label) => counts[label]) };
};

const resolveCertStatus = (cert: any) => {
  if (cert.status) return cert.status;
  if (Number(cert.isRevoked) === 1 || cert.revocationTime) return 'REVOKED';
  const notAfter = parseDate(cert.notAfter);
  if (notAfter && notAfter.getTime() < Date.now()) return 'EXPIRED';
  if (cert.certStatus) return cert.certStatus;
  return 'VALID';
};

const resolveCertAlgorithm = (cert: any) => {
  if (cert.algorithm) return cert.algorithm;
  if (cert.cert) {
    try {
      const x509 = new X509();
      x509.readCertPEM(cert.cert);
      const sigAlgName = x509.getSignatureAlgorithmName();
      if (/sm2|sm3|1\.2\.156\.10197/i.test(sigAlgName)) return 'SM2 (国密)';
      const oidFromPath = (path: number[]) => {
        const oidHex = ASN1HEX.getVbyList(x509.hex, 0, [...path]);
        return oidHex ? ASN1HEX.hextooidstr(oidHex) : '';
      };
      const publicKeyOid = oidFromPath([0, 6, 0, 0]);
      const publicKeyCurveOid = oidFromPath([0, 6, 0, 1]);
      if (publicKeyCurveOid === '1.2.156.10197.1.301') return 'SM2 (国密)';
      if (/rsa/i.test(sigAlgName)) return 'RSA';
      if (/ecdsa|ec/i.test(sigAlgName)) return 'ECDSA';
      if (/ed25519|ed448/i.test(sigAlgName)) return 'EdDSA';
      const oid = publicKeyOid || oidFromPath([0, 5, 0, 0]);
      if (oid === '1.2.840.113549.1.1.1') return 'RSA';
      if (oid === '1.2.840.10045.2.1') return 'ECDSA';
    } catch (error) {}
  }
  return '其他';
};

const isExpiringSoon = (cert: any) => {
  if (cert.status !== 'VALID' || !cert.notAfterDate) return false;
  const diff = cert.notAfterDate.getTime() - Date.now();
  return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(/-/g, '/');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateTime = (date?: Date | null) => date?.getTime?.() || 0;

const formatDay = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

const formatDate = (date?: Date | null) => {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const shortSerial = (serial?: string) => {
  if (!serial) return '-';
  return serial.length > 10 ? `${serial.slice(0, 6)}...${serial.slice(-4)}` : serial;
};

const handleResize = () => {
  trendChart?.resize();
  algoChart?.resize();
};

onMounted(async () => {
  await checkInitialization();
  if (isInitialized.value) {
    await fetchDashboardData();
    nextTick(() => {
      initTrendChart();
      initAlgoChart();
    });
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  algoChart?.dispose();
});

watch(timeRange, () => {
  renderTrendChart();
});
</script>

<style lang="scss" scoped>
.ca-dashboard {
  .mt20 {
    margin-top: 20px;
  }

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

      .stat-info {
        .stat-label {
          font-size: 14px;
          color: #909399;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 20px;
          font-weight: bold;
          color: #303133;
        }
      }
    }

    .stat-footer {
      border-top: 1px solid #ebeef5;
      padding-top: 10px;
      .footer-desc {
        font-size: 12px;
        color: #909399;
        margin-top: 5px;
      }
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
  }

  .uninitialized-container {
    padding: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 500px;

    .init-card {
      width: 100%;
      max-width: 600px;
      border-radius: 12px;
    }
  }
}
</style>
