<template>
  <div class="crypto-monitor-page">
    <section class="monitor-hero">
      <div>
        <div class="eyebrow">LIUZX-CRYPTO HEALTH</div>
        <h2>密码服务健康监控</h2>
        <p>持续检查 Java / Web 存活状态，并通过 SM4 加解密闭环验证密码机就绪状态。</p>
      </div>
      <div class="hero-actions">
        <el-switch v-model="autoRefresh" active-text="30 秒自动刷新" />
        <el-button icon="Refresh" :loading="loading" @click="loadData">刷新状态</el-button>
        <el-button v-hasPermi="['ops:crypto:check']" type="primary" icon="VideoPlay" :loading="checking" @click="runCheck">立即检查</el-button>
      </div>
    </section>

    <section class="metric-grid">
      <article class="metric-card">
        <span class="metric-label">监控实例</span>
        <strong>{{ instances.length }}</strong>
        <small>已配置的 liuzx-crypto 节点</small>
      </article>
      <article class="metric-card success">
        <span class="metric-label">健康实例</span>
        <strong>{{ healthyCount }}</strong>
        <small>存活和就绪检查均通过</small>
      </article>
      <article class="metric-card danger">
        <span class="metric-label">故障实例</span>
        <strong>{{ downCount }}</strong>
        <small>已达到连续失败阈值</small>
      </article>
      <article class="metric-card warning">
        <span class="metric-label">待确认状态</span>
        <strong>{{ pendingCount }}</strong>
        <small>疑似故障、恢复中或尚未检查</small>
      </article>
    </section>

    <el-alert
      v-if="downCount > 0"
      class="monitor-alert"
      type="error"
      :closable="false"
      show-icon
      :title="`${downCount} 个密码服务实例发生故障，告警邮件将按策略发送`"
    />

    <el-card shadow="never" class="monitor-panel">
      <template #header>
        <div class="panel-header">
          <div>
            <span>实例检查结果</span>
            <small>最后刷新：{{ dateTimeText(lastRefreshedAt) }}</small>
          </div>
          <el-tag :type="overallTagType" effect="dark" round>{{ overallText }}</el-tag>
        </div>
      </template>

      <el-table v-loading="loading || checking" :data="instances" row-key="instanceId" class="monitor-table">
        <el-table-column label="实例" min-width="210">
          <template #default="{ row }">
            <div class="instance-cell">
              <span class="status-dot" :class="stateClass(row.state)"></span>
              <div>
                <b>{{ instanceName(row.instanceId) }}</b>
                <small>{{ row.instanceId }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="服务地址" prop="baseUrl" min-width="225" show-overflow-tooltip />
        <el-table-column label="综合状态" width="125" align="center">
          <template #default="{ row }">
            <el-tag :type="stateTagType(row.state)" effect="plain" round>{{ stateText(row.state) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="存活检查" width="125" align="center">
          <template #default="{ row }">
            <span
              v-if="row.liveStatus || row.liveHttpStatus"
              class="probe-result"
              :class="probeHealthy(row.liveStatus, row.liveHttpStatus) ? 'healthy' : 'unhealthy'"
            >
              <i></i>{{ row.liveStatus || 'UNKNOWN' }} · {{ row.liveHttpStatus || '-' }}
            </span>
            <span v-else class="probe-empty">未检查</span>
          </template>
        </el-table-column>
        <el-table-column label="就绪检查" width="125" align="center">
          <template #default="{ row }">
            <span
              v-if="row.readyStatus || row.readyHttpStatus"
              class="probe-result"
              :class="probeHealthy(row.readyStatus, row.readyHttpStatus) ? 'healthy' : 'unhealthy'"
            >
              <i></i>{{ row.readyStatus || 'UNKNOWN' }} · {{ row.readyHttpStatus || '-' }}
            </span>
            <span v-else class="probe-empty">未检查</span>
          </template>
        </el-table-column>
        <el-table-column label="密码机耗时" width="115" align="center">
          <template #default="{ row }">
            <span :class="{ 'latency-warning': isSlow(row.readyLatencyMs) }">{{ latencyText(row.readyLatencyMs) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="连续结果" width="115" align="center">
          <template #default="{ row }">
            <span v-if="row.consecutiveFailures" class="failure-count">失败 {{ row.consecutiveFailures }}</span>
            <span v-else-if="row.consecutiveSuccesses" class="success-count">成功 {{ row.consecutiveSuccesses }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="最后检查" width="180" align="center">
          <template #default="{ row }">{{ dateTimeText(row.lastCheckedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="View" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && instances.length === 0" description="暂无已启用的密码服务监控实例" />
    </el-card>

    <el-drawer v-model="drawerVisible" :size="drawerSize" destroy-on-close>
      <template #header>
        <div class="drawer-header">
          <div>
            <span>{{ selectedInstance ? instanceName(selectedInstance.instanceId) : '实例详情' }}</span>
            <small>{{ selectedInstance?.baseUrl }}</small>
          </div>
          <el-tag v-if="selectedInstance" :type="stateTagType(selectedInstance.state)" effect="plain">
            {{ stateText(selectedInstance.state) }}
          </el-tag>
        </div>
      </template>

      <el-descriptions v-if="selectedInstance" :column="1" border>
        <el-descriptions-item label="实例编码">{{ selectedInstance.instanceId }}</el-descriptions-item>
        <el-descriptions-item label="服务地址">{{ selectedInstance.baseUrl }}</el-descriptions-item>
        <el-descriptions-item label="存活检查">
          {{ probeDetail(selectedInstance.liveStatus, selectedInstance.liveHttpStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="就绪检查">
          {{ probeDetail(selectedInstance.readyStatus, selectedInstance.readyHttpStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="SM4 闭环耗时">{{ latencyText(selectedInstance.readyLatencyMs) }}</el-descriptions-item>
        <el-descriptions-item label="连续失败">{{ selectedInstance.consecutiveFailures }} 次</el-descriptions-item>
        <el-descriptions-item label="连续成功">{{ selectedInstance.consecutiveSuccesses }} 次</el-descriptions-item>
        <el-descriptions-item label="首次失败">{{ dateTimeText(selectedInstance.firstFailureAt) }}</el-descriptions-item>
        <el-descriptions-item label="最后告警">{{ dateTimeText(selectedInstance.lastAlertAt) }}</el-descriptions-item>
        <el-descriptions-item label="最后检查">{{ dateTimeText(selectedInstance.lastCheckedAt) }}</el-descriptions-item>
        <el-descriptions-item label="诊断信息">{{ messageText(selectedInstance.message) }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup name="OpsCryptoMonitor" lang="ts">
import { checkCryptoMonitorInstances, getCryptoMonitorInstances } from '@/api/ops';
import type { CryptoMonitorInstance, CryptoMonitorState } from '@/api/ops/types';
import { dateTimeText } from '@/views/ops/utils';

const instances = ref<CryptoMonitorInstance[]>([]);
const loading = ref(false);
const checking = ref(false);
const autoRefresh = ref(true);
const lastRefreshedAt = ref<string>();
const drawerVisible = ref(false);
const selectedInstance = ref<CryptoMonitorInstance>();
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const healthyCount = computed(() => instances.value.filter((item) => item.state === 'UP').length);
const downCount = computed(() => instances.value.filter((item) => item.state === 'DOWN').length);
const pendingCount = computed(() => instances.value.length - healthyCount.value - downCount.value);
const overallText = computed(() => {
  if (!instances.value.length) return '等待监控数据';
  if (downCount.value) return '存在故障';
  if (pendingCount.value) return '状态确认中';
  return '全部健康';
});
const overallTagType = computed(() => {
  if (!instances.value.length || pendingCount.value) return 'warning';
  return downCount.value ? 'danger' : 'success';
});
const drawerSize = computed(() => (window.innerWidth < 768 ? '94%' : '560px'));

const stateText = (state: CryptoMonitorState) =>
  ({ UP: '健康', DOWN: '故障', SUSPECTED: '疑似故障', RECOVERING: '恢复确认中', UNKNOWN: '未检查' })[state] || state;
const stateTagType = (state: CryptoMonitorState) => {
  if (state === 'UP') return 'success';
  if (state === 'DOWN') return 'danger';
  if (state === 'SUSPECTED' || state === 'RECOVERING') return 'warning';
  return 'info';
};
const stateClass = (state: CryptoMonitorState) => state.toLowerCase();
const instanceName = (instanceId: string) => `密码服务 ${instanceId.replace('crypto-', '')}`;
const latencyText = (latency?: number) => (latency == null ? '-' : `${latency} ms`);
const isSlow = (latency?: number) => latency != null && latency >= 1000;
const probeHealthy = (status?: string, httpStatus?: number) => status === 'UP' && httpStatus === 200;
const probeDetail = (status?: string, httpStatus?: number) => `${status || '未检查'} / HTTP ${httpStatus || '-'}`;
const messageText = (message?: string) =>
  ({
    'not checked': '尚未执行健康检查',
    'crypto service is ready': '密码服务已就绪',
    'live probe failed': '存活检查失败',
    'ready probe failed': '密码机就绪检查失败'
  })[message || ''] ||
  message ||
  '-';

const syncSelectedInstance = () => {
  if (selectedInstance.value) {
    selectedInstance.value = instances.value.find((item) => item.instanceId === selectedInstance.value?.instanceId);
  }
};

const loadData = async (silent = false) => {
  if (!silent) loading.value = true;
  try {
    instances.value = (await getCryptoMonitorInstances()) || [];
    lastRefreshedAt.value = new Date().toISOString();
    syncSelectedInstance();
  } finally {
    if (!silent) loading.value = false;
  }
};

const runCheck = async () => {
  checking.value = true;
  try {
    instances.value = (await checkCryptoMonitorInstances()) || [];
    lastRefreshedAt.value = new Date().toISOString();
    syncSelectedInstance();
    ElMessage.success(downCount.value ? '检查完成，发现故障实例' : '检查完成，密码服务状态正常');
  } finally {
    checking.value = false;
  }
};

const openDetail = (instance: CryptoMonitorInstance) => {
  selectedInstance.value = instance;
  drawerVisible.value = true;
};

const updateRefreshTimer = (enabled: boolean) => {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = enabled ? setInterval(() => loadData(true), 30_000) : undefined;
};

watch(autoRefresh, updateRefreshTimer);
onMounted(() => {
  loadData();
  updateRefreshTimer(autoRefresh.value);
});
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped lang="scss">
.crypto-monitor-page {
  min-height: calc(100vh - 84px);
  padding: 24px;
  background:
    radial-gradient(circle at 8% 4%, rgb(58 134 255 / 12%), transparent 28%),
    radial-gradient(circle at 92% 12%, rgb(34 197 94 / 10%), transparent 30%), #f4f7fb;
}

.monitor-hero,
.metric-grid,
.monitor-alert,
.monitor-panel {
  max-width: 1480px;
  margin-right: auto;
  margin-left: auto;
}

.monitor-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
  padding: 24px 26px;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 18px;
  background: linear-gradient(125deg, #102a43 0%, #174f6f 62%, #157a6e 100%);
  box-shadow: 0 20px 45px rgb(16 42 67 / 16%);
  color: #fff;

  h2 {
    margin: 5px 0 8px;
    font-size: 29px;
    letter-spacing: 1px;
  }

  p {
    margin: 0;
    color: rgb(255 255 255 / 76%);
    font-size: 14px;
  }
}

.eyebrow {
  color: #8be0cf;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2.4px;
}

.hero-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;

  :deep(.el-switch__label) {
    color: rgb(255 255 255 / 78%);
  }
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.metric-card {
  padding: 18px 20px;
  border: 1px solid #e5ebf2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 26px rgb(31 41 55 / 6%);

  span,
  strong,
  small {
    display: block;
  }

  .metric-label {
    color: #64748b;
    font-size: 13px;
  }

  strong {
    margin: 5px 0 3px;
    color: #102a43;
    font-size: 30px;
  }

  small {
    color: #94a3b8;
  }

  &.success strong {
    color: #168f63;
  }

  &.danger strong {
    color: #dc2626;
  }

  &.warning strong {
    color: #d97706;
  }
}

.monitor-alert {
  margin-bottom: 16px;
  border-radius: 10px;
}

.monitor-panel {
  border: 1px solid #e5ebf2;
  border-radius: 14px;
  box-shadow: 0 12px 30px rgb(31 41 55 / 7%);
}

.panel-header,
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;

  span,
  small {
    display: block;
  }

  span {
    color: #102a43;
    font-weight: 700;
  }

  small {
    margin-top: 4px;
    color: #8795a7;
    font-size: 12px;
  }
}

.instance-cell {
  display: flex;
  align-items: center;
  gap: 11px;

  b,
  small {
    display: block;
  }

  b {
    color: #243b53;
  }

  small {
    margin-top: 2px;
    color: #8795a7;
  }
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 0 5px rgb(148 163 184 / 14%);

  &.up {
    background: #22a06b;
    box-shadow: 0 0 0 5px rgb(34 160 107 / 14%);
  }

  &.down {
    background: #dc2626;
    box-shadow: 0 0 0 5px rgb(220 38 38 / 14%);
  }

  &.suspected,
  &.recovering {
    background: #e99a10;
    box-shadow: 0 0 0 5px rgb(233 154 16 / 14%);
  }
}

:deep(.probe-result) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;

  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  &.healthy {
    color: #168f63;

    i {
      background: #22a06b;
    }
  }

  &.unhealthy {
    color: #dc2626;

    i {
      background: #dc2626;
    }
  }
}

:deep(.probe-empty) {
  color: #94a3b8;
  font-size: 12px;
}

.failure-count,
.latency-warning {
  color: #dc2626;
  font-weight: 600;
}

.success-count {
  color: #168f63;
}

@media (max-width: 980px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .monitor-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 620px) {
  .crypto-monitor-page {
    padding: 12px;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .monitor-hero {
    padding: 20px;

    h2 {
      font-size: 24px;
    }
  }
}
</style>
