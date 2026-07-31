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

    <div v-else-if="isCaAuditHome" class="ca-audit-home">
      <section class="audit-hero">
        <div>
          <span class="audit-kicker">{{ isCaAuditManager ? '审计管理员工作台' : '安全审计工作台' }}</span>
          <h1>{{ isCaAuditManager ? '审计员账号管理' : '业务日志与登录审计' }}</h1>
          <p>
            {{
              isCaAuditManager
                ? '维护审计员账号与证书状态，确保日志查看职责独立、账号可控、权限边界清晰。'
                : '集中查看 CA 登录日志和业务操作日志，关注异常登录、失败操作和关键证书生命周期事件。'
            }}
          </p>
        </div>
        <div class="audit-hero-actions">
          <el-button v-if="isCaAuditManager" type="primary" icon="User" @click="goAuditManager">审计员管理</el-button>
          <el-button v-if="!isCaAuditManager && canViewOperateLog" type="primary" plain icon="Tickets" @click="goOperateLog">业务日志</el-button>
          <el-button v-if="!isCaAuditManager && canViewLoginLog" plain icon="Key" @click="goLoginLog">登录日志</el-button>
        </div>
      </section>

      <el-row v-if="auditMetrics.length" :gutter="16" class="audit-metrics">
        <el-col v-for="item in auditMetrics" :key="item.label" :xs="12" :sm="12" :md="6">
          <div class="audit-metric-card">
            <div class="audit-metric-icon" :class="item.tone">
              <el-icon><component :is="item.icon" /></el-icon>
            </div>
            <div class="audit-metric-copy">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col v-if="!isCaAuditManager" :xs="24" :lg="15">
          <el-card class="audit-panel" shadow="never">
            <template #header>
              <div class="audit-panel-header">
                <div>
                  <h2>最新审计事件</h2>
                  <span>最近的业务操作与登录记录。</span>
                </div>
                <el-button text type="primary" icon="Refresh" @click="fetchAuditHomeData">刷新</el-button>
              </div>
            </template>
            <div v-if="auditEvents.length" class="audit-event-list">
              <button v-for="item in auditEvents" :key="item.key" type="button" class="audit-event-item" @click="goTarget(item.path)">
                <div class="audit-event-icon" :class="item.tone">
                  <el-icon><component :is="item.icon" /></el-icon>
                </div>
                <div class="audit-event-main">
                  <b>{{ item.title }}</b>
                  <span>{{ item.desc }}</span>
                </div>
                <time>{{ item.time || '-' }}</time>
              </button>
            </div>
            <el-empty v-else description="暂无审计记录" />
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="isCaAuditManager ? 24 : 9">
          <el-card class="audit-panel" shadow="never">
            <template #header>
              <div class="audit-panel-header">
                <div>
                  <h2>审计职责</h2>
                  <span>当前角色可执行的监督动作。</span>
                </div>
              </div>
            </template>
            <div class="audit-action-list">
              <button v-for="action in auditActions" :key="action.title" type="button" @click="goTarget(action.path)">
                <el-icon><component :is="action.icon" /></el-icon>
                <span>{{ action.title }}</span>
                <small>{{ action.desc }}</small>
              </button>
            </div>
          </el-card>
        </el-col>
      </el-row>
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
                <div class="stat-label">已注销证书</div>
                <div class="stat-value">{{ stats.revokedCerts }}</div>
              </div>
            </div>
            <div class="stat-footer">
              <div class="footer-desc">包含手动注销及异常证书</div>
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

      <!-- 系统信息 -->
      <el-card class="system-info-card mt20" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>系统信息</span>
          </div>
        </template>
        <div class="body">
          <el-row :gutter="20">
            <el-col :xs="24" :sm="24" :md="8">
              <div class="contact-info-box">
                <div class="contact-item">
                  <div class="icon-box">
                    <el-icon><User /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">技术支持</span>
                    <a href="mailto:liuzhenxin@ec.com.cn">liuzhenxin@ec.com.cn</a>
                  </div>
                </div>
                <div class="contact-item">
                  <div class="icon-box">
                    <el-icon><Phone /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">联系电话</span>
                    <a href="javascript:;">010-12345678</a>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="24" :md="16">
              <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #303133; font-weight: 600">版本信息</h4>
              <div class="version-info-box">
                <div class="version-item">
                  <div class="icon-box">
                    <el-icon><Monitor /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">系统版本</span>
                    <span class="value">{{ systemVersion }}</span>
                  </div>
                </div>
                <div class="version-item">
                  <div class="icon-box">
                    <el-icon><Stamp /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">证书模板</span>
                    <span class="value">{{ systemInfo.profileCount }} 个</span>
                  </div>
                </div>
                <div class="version-item">
                  <div class="icon-box">
                    <el-icon><Key /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">根CA</span>
                    <span class="value">{{ systemInfo.rootCount }} 个</span>
                  </div>
                </div>
                <div class="version-item">
                  <div class="icon-box">
                    <el-icon><Connection /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">签名者</span>
                    <span class="value">{{ systemInfo.signerCount }} 个</span>
                  </div>
                </div>
                <div class="version-item">
                  <div class="icon-box">
                    <el-icon><Tickets /></el-icon>
                  </div>
                  <div class="info">
                    <span class="label">发布者</span>
                    <span class="value">{{ systemInfo.publisherCount }} 个</span>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-card>

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
import { list as listLoginLog } from '@/api/system/loginlog';
import { list as listOperateLog } from '@/api/system/operlog';
import { useUserStore } from '@/store/modules/user';
import { X509, ASN1HEX } from 'jsrsasign';
import { getInitStatus } from '@/api/ca/init';

const router = useRouter();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const userStore = useUserStore();
const hasPermission = (permission: string) => (userStore.permissions || []).includes(permission) || (userStore.permissions || []).includes('*:*:*');
const canViewInitStatus = computed(() => hasPermission('setup') || hasPermission('ca:setup'));
const isAuditManagerAccount = computed(() => String(userStore.name || '').toLowerCase() === 'audit' || String(userStore.userId || '') === '402');
const isCaAuditManager = computed(() => isAuditManagerAccount.value || (hasPermission('ca:audit') && !hasPermission('ca:cert:page')));
const canViewLoginLog = computed(() => hasPermission('sys:login-log:page'));
const canViewOperateLog = computed(() => hasPermission('sys:operate-log:page'));
const isCaAuditor = computed(() => canViewLoginLog.value || canViewOperateLog.value);
const isCaAuditHome = computed(() => isCaAuditManager.value || isCaAuditor.value);
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
const systemVersion = ref<string>(import.meta.env.VITE_APP_VERSION || '3.5.5');
const systemInfo = reactive({
  profileCount: 0,
  rootCount: 0,
  signerCount: 0,
  publisherCount: 0,
  requestorCount: 0
});

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
const recentLoginLogs = ref<any[]>([]);
const recentOperateLogs = ref<any[]>([]);
const auditStats = reactive({
  loginTotal: 0,
  operateTotal: 0,
  failedLoginTotal: 0,
  failedOperateTotal: 0
});

const auditMetrics = computed(() =>
  isCaAuditManager.value
    ? []
    : [
        { label: '登录日志', value: auditStats.loginTotal, icon: 'Key', tone: 'blue' },
        { label: '业务日志', value: auditStats.operateTotal, icon: 'Tickets', tone: 'green' },
        { label: '异常登录', value: auditStats.failedLoginTotal, icon: 'Warning', tone: 'orange' },
        { label: '失败操作', value: auditStats.failedOperateTotal, icon: 'CircleClose', tone: 'red' }
      ]
);

const auditActions = computed(() => {
  const actions: Array<{ title: string; desc: string; icon: string; path: string }> = [];
  if (isCaAuditManager.value) {
    actions.push({
      title: '审计员管理',
      desc: '维护审计员账号、状态和证书签发。',
      icon: 'User',
      path: '/ca-audit-manager/ca-audit'
    });
  }
  if (!isCaAuditManager.value && canViewOperateLog.value) {
    actions.push({
      title: '业务日志',
      desc: '查看 CA 关键业务操作和执行结果。',
      icon: 'Tickets',
      path: '/ca-log/ca-log-operator'
    });
  }
  if (!isCaAuditManager.value && canViewLoginLog.value) {
    actions.push({
      title: '登录日志',
      desc: '追踪登录成功、失败和来源地址。',
      icon: 'Key',
      path: '/ca-log/ca-log-login'
    });
  }
  return actions;
});

const auditEvents = computed(() => {
  const loginEvents = recentLoginLogs.value.map((item, index) => ({
    key: `login-${item.id || index}`,
    title: `${item.username || item.userName || item.loginName || '-'} 登录${isFailureStatus(item.status) ? '失败' : '成功'}`,
    desc: item.ip || item.loginIp || item.address || item.browser || '登录日志',
    time: item.createTime || item.loginTime,
    icon: 'Key',
    tone: isFailureStatus(item.status) ? 'orange' : 'blue',
    path: '/ca-log/ca-log-login'
  }));
  const operateEvents = recentOperateLogs.value.map((item, index) => ({
    key: `operate-${item.id || index}`,
    title: `${item.moduleName || item.title || '业务操作'} / ${item.name || item.operation || '-'}`,
    desc: `${item.operator || item.operName || '-'} ${item.uri || item.operUrl || ''}`,
    time: item.createTime || item.operTime,
    icon: 'Tickets',
    tone: isFailureStatus(item.status) ? 'red' : 'green',
    path: '/ca-log/ca-log-operator'
  }));
  return [...loginEvents, ...operateEvents].sort((a, b) => dateTime(parseDate(b.time)) - dateTime(parseDate(a.time))).slice(0, 8);
});

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

const fetchSystemInfo = async () => {
  if (!canViewInitStatus.value) {
    return;
  }
  try {
    const res = await getInitStatus();
    const data = res?.data || {};
    systemInfo.profileCount = data.profileCount || 0;
    systemInfo.rootCount = data.rootCount || 0;
    systemInfo.signerCount = data.signerCount || 0;
    systemInfo.publisherCount = data.publisherCount || 0;
    systemInfo.requestorCount = data.requestorCount || 0;
  } catch (error) {
    console.error('获取CA系统信息失败:', error);
  }
};

const getStatusType = (status: string) => {
  const types: any = { VALID: 'success', REVOKED: 'danger', EXPIRED: 'warning', HOLD: 'info' };
  return types[status] || 'info';
};

const getStatusLabel = (status: string) => {
  const labels: any = { VALID: '有效', REVOKED: '已注销', EXPIRED: '已过期', HOLD: '已冻结' };
  return labels[status] || status;
};

const goCertList = () => {
  router.push('/ca/cert');
};

const goAuditManager = () => {
  router.push('/ca-audit-manager/ca-audit');
};

const goOperateLog = () => {
  router.push('/ca-log/ca-log-operator');
};

const goLoginLog = () => {
  router.push('/ca-log/ca-log-login');
};

const goTarget = (path: string) => {
  router.push(path);
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

const fetchAuditHomeData = async () => {
  if (isCaAuditManager.value) {
    return;
  }
  const [loginPage, operatePage, failedLoginPage, failedOperatePage] = await Promise.all([
    canViewLoginLog.value ? fetchLogPage(listLoginLog, {}) : Promise.resolve({ records: [], total: 0 }),
    canViewOperateLog.value ? fetchLogPage(listOperateLog, {}) : Promise.resolve({ records: [], total: 0 }),
    canViewLoginLog.value ? fetchLogPage(listLoginLog, { status: 1 }) : Promise.resolve({ records: [], total: 0 }),
    canViewOperateLog.value ? fetchLogPage(listOperateLog, { status: 1 }) : Promise.resolve({ records: [], total: 0 })
  ]);
  recentLoginLogs.value = loginPage.records;
  recentOperateLogs.value = operatePage.records;
  auditStats.loginTotal = loginPage.total;
  auditStats.operateTotal = operatePage.total;
  auditStats.failedLoginTotal = failedLoginPage.total;
  auditStats.failedOperateTotal = failedOperatePage.total;
};

const fetchLogPage = async (loader: (query: any) => Promise<any>, query: Record<string, any>) => {
  const res = await loader({ pageNum: 1, pageSize: 5, ...query });
  return unwrapPage(res);
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

const isFailureStatus = (status: unknown) =>
  Number(status) === 1 || String(status).toUpperCase() === 'FAIL' || String(status).toUpperCase() === 'FAILED';

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
      content: `${cert.status === 'REVOKED' ? '证书已注销' : '证书已签发'} [Serial: ${shortSerial(cert.serialNumber)}] ${cert.subject || ''}`,
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
    fetchSystemInfo();
    if (isCaAuditHome.value) {
      await fetchAuditHomeData();
    } else {
      await fetchDashboardData();
      nextTick(() => {
        initTrendChart();
        initAlgoChart();
      });
    }
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

  .ca-audit-home {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .audit-hero {
    min-height: 156px;
    padding: 24px;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;

    .audit-kicker {
      display: block;
      margin-bottom: 8px;
      color: #409eff;
      font-size: 13px;
      font-weight: 600;
    }

    h1 {
      margin: 0 0 10px;
      color: #1f2d3d;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0;
    }

    p {
      max-width: 760px;
      margin: 0;
      color: #606266;
      font-size: 14px;
      line-height: 1.7;
    }
  }

  .audit-hero-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }

  .audit-metrics {
    .audit-metric-card {
      min-height: 92px;
      padding: 18px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      background: #fff;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .audit-metric-icon {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 22px;

      &.blue {
        background: #409eff;
      }
      &.green {
        background: #67c23a;
      }
      &.orange {
        background: #e6a23c;
      }
      &.red {
        background: #f56c6c;
      }
    }

    .audit-metric-copy {
      span {
        display: block;
        color: #909399;
        font-size: 13px;
      }

      strong {
        display: block;
        margin-top: 6px;
        color: #303133;
        font-size: 22px;
      }
    }
  }

  .audit-panel {
    border-radius: 8px;
  }

  .audit-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h2 {
      margin: 0 0 4px;
      color: #303133;
      font-size: 16px;
      letter-spacing: 0;
    }

    span {
      color: #909399;
      font-size: 12px;
    }
  }

  .audit-event-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .audit-event-item {
    width: 100%;
    min-height: 64px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    background: #fff;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 150px;
    align-items: center;
    gap: 12px;
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: #409eff;
      background: #f5f9ff;
    }

    time {
      color: #909399;
      font-size: 12px;
      text-align: right;
    }
  }

  .audit-event-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;

    &.blue {
      background: #409eff;
    }
    &.green {
      background: #67c23a;
    }
    &.orange {
      background: #e6a23c;
    }
    &.red {
      background: #f56c6c;
    }
  }

  .audit-event-main {
    min-width: 0;

    b,
    span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    b {
      color: #303133;
      font-size: 14px;
    }

    span {
      margin-top: 4px;
      color: #606266;
      font-size: 12px;
    }
  }

  .audit-action-list {
    display: grid;
    gap: 10px;

    button {
      min-height: 72px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      background: #fff;
      padding: 12px;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      column-gap: 10px;
      align-items: center;
      text-align: left;
      cursor: pointer;

      &:hover {
        border-color: #409eff;
        background: #f5f9ff;
      }

      .el-icon {
        grid-row: span 2;
        color: #409eff;
        font-size: 22px;
      }

      span {
        color: #303133;
        font-size: 14px;
        font-weight: 600;
      }

      small {
        color: #909399;
        font-size: 12px;
      }
    }
  }

  @media (max-width: 768px) {
    .audit-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .audit-hero-actions {
      justify-content: flex-start;
    }

    .audit-event-item {
      grid-template-columns: 38px minmax(0, 1fr);

      time {
        grid-column: 2;
        text-align: left;
      }
    }
  }

  .system-info-card {
    .contact-info-box {
      background-color: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;

      .contact-item {
        display: flex;
        align-items: center;
        margin-bottom: 20px;

        &:last-child {
          margin-bottom: 0;
        }

        .icon-box {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #e6f7ff;
          color: #1890ff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          font-size: 20px;
        }

        .info {
          display: flex;
          flex-direction: column;

          .label {
            font-size: 12px;
            color: #909399;
            margin-bottom: 2px;
          }

          a {
            color: #303133;
            text-decoration: none;
            font-weight: 500;
            font-size: 15px;
            transition: color 0.3s;

            &:hover {
              color: #409eff;
            }
          }
        }
      }
    }

    .version-info-box {
      background-color: #f8f9fa;
      padding: 20px 25px;
      border-radius: 8px;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      align-content: start;

      .version-item {
        display: flex;
        align-items: center;

        .icon-box {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #f0f5ff;
          color: #597ef7;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          font-size: 18px;
          flex-shrink: 0;
        }

        .info {
          display: flex;
          flex-direction: column;

          .label {
            font-size: 12px;
            color: #909399;
            margin-bottom: 2px;
          }

          .value {
            color: #303133;
            font-weight: 500;
            font-size: 14px;
          }
        }
      }
    }
  }
}
</style>
