<template>
  <div class="ops-page" :class="{ 'ops-page-embedded': embedded }">
    <div class="ops-toolbar">
      <div>
        <h2>运行总览</h2>
        <span>最近采集时间：{{ dateTimeText(overview?.collectedAt) }}</span>
      </div>
      <el-button class="ops-refresh-btn" type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新数据</el-button>
    </div>

    <div class="ops-metrics-grid">
      <div v-for="item in metricCards" :key="item.label">
        <div class="ops-metric">
          <div class="ops-metric-icon" :class="item.tone">
            <el-icon><component :is="item.icon" /></el-icon>
          </div>
          <div>
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="ops-dashboard-grid">
      <section class="ops-component-panel" aria-label="平台组件与容器监控">
        <el-card shadow="never" class="ops-panel">
          <template #header>
            <div class="ops-panel-header">
              <span>平台组件与容器监控</span>
              <div class="ops-panel-tags">
                <el-tag effect="plain" :type="summary.abnormalComponentCount > 0 ? 'warning' : 'success'">
                  异常 {{ summary.abnormalComponentCount }}
                </el-tag>
                <el-tag effect="plain">{{ summary.runningContainerCount }}/{{ summary.containerCount }} 容器运行</el-tag>
              </div>
            </div>
          </template>
          <el-skeleton :loading="loading" animated :rows="8">
            <el-select
              v-if="overview?.layers?.length || unboundContainers.length"
              v-model="activeLayerTab"
              class="ops-layer-select"
              aria-label="组件分层"
              placeholder="选择组件分层"
            >
              <el-option
                v-for="layer in overview?.layers || []"
                :key="layer.code"
                :label="`${layer.name}（${layer.components.length}）`"
                :value="layer.code"
              />
              <el-option v-if="unboundContainers.length" :label="`未归属容器（${unboundContainers.length}）`" value="__unbound_containers" />
            </el-select>
            <template v-for="layer in overview?.layers || []" :key="layer.code">
              <template v-if="activeLayerTab === layer.code">
                <div class="ops-component-grid">
                  <div
                    v-for="component in layer.components.map(withSelectedAgent)"
                    :key="component.name"
                    class="ops-component"
                    role="button"
                    tabindex="0"
                    @click="openComponentDetail(component)"
                    @keydown.enter.self.prevent="openComponentDetail(component)"
                  >
                    <div class="ops-component-main">
                      <b>{{ component.displayName }}</b>
                      <span v-if="layer.code === 'infrastructure'">{{ componentDeploymentText(component) }} · {{ component.name }}</span>
                      <span v-else>{{ component.name }}</span>
                    </div>
                    <div v-if="component.name === agentName" @click.stop @keydown.stop>
                      <el-select
                        v-if="agentContainers.length > 1 || (agentContainers.length === 1 && !selectedAgent)"
                        :model-value="selectedAgent?.serverCode || ''"
                        @update:model-value="agentServerCode = $event"
                        aria-label="Agent 所在节点"
                        placeholder="选择 Agent 所在节点"
                        size="small"
                        class="ops-agent-node-select"
                      >
                        <el-option
                          v-for="agent in agentContainers"
                          :key="agent.serverCode"
                          :label="agentNodeLabel(agent)"
                          :value="agent.serverCode"
                        />
                      </el-select>
                      <span v-else>所在节点：{{ selectedAgent ? agentNodeLabel(selectedAgent) : '未发现节点' }}</span>
                    </div>
                    <el-tag :type="componentStatusTagType(component)" effect="plain">
                      {{ componentStatusText(component) }}
                    </el-tag>
                    <div v-if="component.deployment === 'EXTERNAL'" class="ops-container-inline">
                      <div>
                        <span>检查:</span>
                        <b :title="component.availability?.detail">{{ component.availability?.detail || '等待首次检查' }}</b>
                      </div>
                    </div>
                    <div v-else class="ops-container-inline">
                      <div>
                        <span>ID:</span>
                        <b>{{ shortContainerId(component.container?.containerId) }}</b>
                      </div>
                      <div>
                        <span>镜像:</span>
                        <b>{{ component.container?.image || '-' }}</b>
                      </div>
                      <div>
                        <span>状态:</span>
                        <b>
                          {{
                            component.container?.status ||
                            statusText(component.container?.state, component.container?.running, component.container?.present)
                          }}
                        </b>
                      </div>
                    </div>
                    <div v-if="component.dependencies?.length" class="ops-deps">
                      依赖：{{ component.dependencies.map((dependency) => dependencyLabel(dependency, overview)).join(' / ') }}
                    </div>
                    <div v-if="component.deployment !== 'EXTERNAL'" class="ops-card-actions">
                      <el-button
                        class="ops-log-btn ops-card-log-btn"
                        icon="Document"
                        size="small"
                        :disabled="
                          !component.container?.present || (component.name !== agentName && !findServerByContainerName(component.container?.name))
                        "
                        @click.stop="openLogsForComponent(component)"
                      >
                        查看日志
                      </el-button>
                    </div>
                  </div>
                  <el-empty v-if="layer.components.length === 0" description="暂无组件配置" />
                </div>
              </template>
            </template>
            <template v-if="activeLayerTab === '__unbound_containers'">
              <div class="ops-container-grid compact">
                <div
                  v-for="container in unboundContainers"
                  :key="`${container.serverCode}-${container.name}-${container.containerId}`"
                  class="ops-container-card"
                  role="button"
                  tabindex="0"
                  @click="openContainerDetail(container)"
                  @keydown.enter.prevent="openContainerDetail(container)"
                >
                  <div class="ops-container-title">
                    <el-icon><Box /></el-icon>
                    <b>{{ container.name }}</b>
                  </div>
                  <div class="ops-container-detail">
                    <span>ID:</span>
                    <b>{{ shortContainerId(container.containerId) }}</b>
                  </div>
                  <div class="ops-container-detail">
                    <span>状态:</span>
                    <b>{{ container.status || statusText(container.state, container.running, container.present) }}</b>
                  </div>
                  <div class="ops-container-detail">
                    <span>镜像:</span>
                    <b>{{ container.image || '-' }}</b>
                  </div>
                  <div class="ops-card-actions">
                    <el-button
                      class="ops-log-btn ops-card-log-btn"
                      icon="Document"
                      size="small"
                      :disabled="!container.serverCode"
                      @click.stop="openLogsForContainer(container)"
                    >
                      查看日志
                    </el-button>
                  </div>
                </div>
              </div>
            </template>
            <el-empty v-if="!overview?.layers?.length && !unboundContainers.length" description="暂无组件与容器数据" />
          </el-skeleton>
        </el-card>
      </section>

      <aside class="ops-dashboard-aside" aria-label="告警与服务器状态">
        <el-card shadow="never" class="ops-panel">
          <template #header>
            <div class="ops-panel-header">
              <span>当前告警</span>
              <el-tag effect="plain" :type="currentAlerts.length > 0 ? 'danger' : 'success'"> {{ currentAlerts.length }} 条 </el-tag>
            </div>
          </template>
          <el-skeleton :loading="loading" animated :rows="4">
            <div v-if="currentAlerts.length > 0" class="ops-alert-list">
              <button
                v-for="alert in currentAlerts"
                :key="alert.id || alert.name"
                class="ops-alert-item"
                type="button"
                @click="openAlertDetail(alert.name, alert.id)"
              >
                <div>
                  <b>{{ alert.displayName }}</b>
                  <span>{{ alert.source }} · {{ alert.name }}</span>
                </div>
                <el-tag type="danger" effect="plain">{{ alert.reason }}</el-tag>
              </button>
            </div>
            <el-empty v-else description="暂无未恢复告警" />
          </el-skeleton>
        </el-card>

        <el-card shadow="never" class="ops-panel">
          <template #header>
            <div class="ops-panel-header">
              <span>服务器状态</span>
              <el-tag effect="plain">{{ summary.onlineServerCount }}/{{ summary.serverCount }} 在线</el-tag>
            </div>
          </template>
          <el-table v-loading="loading" :data="servers" size="small" max-height="360">
            <el-table-column label="服务器" min-width="112" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="ops-table-main">
                  <b>{{ row.name }}</b>
                  <span>{{ row.host }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="76" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status, row.online)" effect="plain">{{ statusText(row.status, row.online) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="容器" width="56" align="center" prop="runningContainerCount" />
          </el-table>
        </el-card>
      </aside>

      <el-card shadow="never" class="ops-panel ops-resources-panel">
        <template #header>
          <div class="ops-panel-header">
            <span>服务器资源水位</span>
          </div>
        </template>
        <div class="ops-resource-list">
          <div v-for="server in servers" :key="server.code" class="ops-resource">
            <div class="ops-resource-title">
              <span>{{ server.name }}</span>
              <small>{{ server.host }}</small>
            </div>
            <div class="ops-progress-row">
              <span>CPU</span>
              <el-progress :percentage="safePercent(server.cpuUsage)" :stroke-width="8" />
            </div>
            <div class="ops-progress-row">
              <span>内存</span>
              <el-progress
                :percentage="safePercent(server.memoryUsage)"
                :stroke-width="8"
                :status="server.memoryUsage && server.memoryUsage > 90 ? 'exception' : undefined"
              />
            </div>
            <div class="ops-progress-row">
              <span>磁盘</span>
              <el-progress :percentage="safePercent(server.diskUsage)" :stroke-width="8" />
            </div>
          </div>
          <el-empty v-if="!loading && servers.length === 0" description="暂无服务器上报" />
        </div>
      </el-card>
    </div>

    <el-drawer v-model="detailDrawerVisible" :size="drawerSize" destroy-on-close>
      <template #header>
        <div class="ops-drawer-title">
          <span>{{ selectedComponent?.displayName || '组件详情' }}</span>
          <el-tag v-if="selectedComponent" :type="componentStatusTagType(selectedComponent)" effect="plain">
            {{ componentStatusText(selectedComponent) }}
          </el-tag>
        </div>
      </template>

      <div v-if="selectedComponent" class="ops-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="组件编码">{{ selectedComponent.name }}</el-descriptions-item>
          <el-descriptions-item label="所属层级">{{ selectedComponent.layerName || selectedComponent.layer }}</el-descriptions-item>
          <el-descriptions-item label="部署方式">{{ componentDeploymentText(selectedComponent) }}</el-descriptions-item>
          <el-descriptions-item label="依赖组件">
            <div v-if="selectedComponent.dependencies?.length" class="ops-detail-tags">
              <el-tag v-for="dependency in selectedComponent.dependencies" :key="dependency" effect="plain">
                {{ dependencyLabel(dependency, overview) }}
              </el-tag>
            </div>
            <span v-else>无</span>
          </el-descriptions-item>
          <template v-if="selectedComponent.deployment === 'EXTERNAL'">
            <el-descriptions-item label="检查结果">{{ selectedComponent.availability?.detail || '等待首次检查' }}</el-descriptions-item>
            <el-descriptions-item label="最近检查">{{ dateTimeText(selectedComponent.availability?.checkedAt) }}</el-descriptions-item>
          </template>
          <template v-else>
            <el-descriptions-item label="容器名称">{{ selectedComponent.container?.name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="容器 ID">{{ selectedComponent.container?.containerId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="镜像">{{ selectedComponent.container?.image || '-' }}</el-descriptions-item>
            <el-descriptions-item label="容器状态">
              {{ selectedComponent.container?.status || selectedComponent.container?.state || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="端口">{{ selectedComponent.container?.ports || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所在服务器">{{ selectedServerText }}</el-descriptions-item>
          </template>
        </el-descriptions>
      </div>
    </el-drawer>

    <el-drawer v-model="containerDrawerVisible" :size="drawerSize" destroy-on-close>
      <template #header>
        <div class="ops-drawer-title">
          <span>{{ selectedContainer?.name || '容器详情' }}</span>
          <el-tag
            v-if="selectedContainer"
            :type="statusTagType(selectedContainer.state, selectedContainer.running, selectedContainer.present)"
            effect="plain"
          >
            {{ statusText(selectedContainer.state, selectedContainer.running, selectedContainer.present) }}
          </el-tag>
        </div>
      </template>

      <div v-if="selectedContainer" class="ops-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="容器名称">{{ selectedContainer.name }}</el-descriptions-item>
          <el-descriptions-item label="容器 ID">{{ selectedContainer.containerId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="镜像">{{ selectedContainer.image || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ selectedContainer.status || selectedContainer.state || '-' }}</el-descriptions-item>
          <el-descriptions-item label="端口">{{ selectedContainer.ports || '-' }}</el-descriptions-item>
          <el-descriptions-item label="所在服务器">{{ selectedContainer.serverName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="服务器地址">{{ selectedContainer.serverHost || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>

    <el-drawer v-model="logsDrawerVisible" size="70%" destroy-on-close>
      <template #header>
        <div class="ops-drawer-title">
          <span>容器日志：{{ selectedLogsContainer?.name || '-' }}</span>
          <el-button class="ops-log-btn" icon="Refresh" :loading="logsLoading" @click="reloadLogs">刷新日志</el-button>
        </div>
      </template>

      <div class="ops-logs-panel" v-loading="logsLoading">
        <div class="ops-logs-meta">
          <span>服务器：{{ containerLogs?.serverName || selectedLogsContainer?.serverName || '-' }}</span>
          <span>最近 {{ containerLogs?.tail || logsTail }} 行</span>
          <span>采集时间：{{ dateTimeText(containerLogs?.collectedAt) }}</span>
        </div>
        <div v-if="containerLogs?.lines?.length" class="ops-logs-content">
          <pre v-for="(line, index) in containerLogs.lines" :key="index">{{ line }}</pre>
        </div>
        <el-empty v-else-if="!logsLoading" description="暂无日志输出" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup name="OpsOverview" lang="ts">
import { getAlertIncidents, getOpsContainerLogs, getOpsContainers, getOpsOverview, getOpsServers } from '@/api/ops';
import type { AlertIncident } from '@/api/ops';
import { useRouter } from 'vue-router';
import type { OpsComponent, OpsContainer, OpsContainerLogs, OpsOverview, OpsServer, OpsSummary } from '@/api/ops/types';
import {
  buildSummary,
  collectContainers,
  componentDeploymentText,
  componentStatusTagType,
  componentStatusText,
  dateTimeText,
  dependencyLabel,
  flattenComponents,
  findOverviewAgent,
  isComponentAbnormal,
  statusTagType,
  statusText
} from '@/views/ops/utils';

defineProps<{ embedded?: boolean }>();

type OpsContainerWithServer = OpsContainer & {
  serverCode?: string;
  serverName?: string;
  serverHost?: string;
};

const loading = ref(false);
const router = useRouter();
const trackedAlerts = ref<AlertIncident[]>();
const overview = ref<OpsOverview>();
const servers = ref<OpsServer[]>([]);
const containers = ref<OpsContainer[]>([]);
const detailDrawerVisible = ref(false);
const containerDrawerVisible = ref(false);
const logsDrawerVisible = ref(false);
const logsLoading = ref(false);
const selectedComponent = ref<(OpsComponent & { layerName?: string; layerOrder?: number }) | undefined>();
const selectedContainer = ref<OpsContainerWithServer | undefined>();
const selectedLogsContainer = ref<OpsContainerWithServer | undefined>();
const containerLogs = ref<OpsContainerLogs>();
const activeLayerTab = ref('');
const logsTail = 200;
let logsRequestId = 0;
const agentName = 'pki-ops-agent';
const agentServerCode = ref('');

const summary = computed<OpsSummary>(() => buildSummary(overview.value, servers.value, containers.value));
const components = computed(() => flattenComponents(overview.value));
const allContainers = computed<OpsContainerWithServer[]>(() => collectContainers(servers.value, containers.value));
const agentContainers = computed(() =>
  allContainers.value.filter((container) => container.name === agentName && container.present && container.serverCode !== '-')
);
const selectedAgent = computed(() => findOverviewAgent(agentContainers.value, agentServerCode.value));
const agentNodeLabel = (agent: OpsContainerWithServer) =>
  agent.serverHost && agent.serverHost !== agent.serverCode ? `${agent.serverCode}（${agent.serverHost}）` : agent.serverCode;
const withSelectedAgent = (component: OpsComponent): OpsComponent =>
  component.name === agentName ? { ...component, container: selectedAgent.value } : component;
const componentContainerNames = computed(() => new Set(components.value.map((component) => component.container?.name).filter(Boolean)));
const unboundContainers = computed(() =>
  allContainers.value.filter((container) => container.name && !componentContainerNames.value.has(container.name))
);
const appComponents = computed(() => components.value.filter((component) => component.layer === 'domain'));
const appRunningCount = computed(() => appComponents.value.filter((component) => component.container?.running).length);
const appAbnormalCount = computed(() => appComponents.value.length - appRunningCount.value);
const overallStatus = computed(() => {
  if (summary.value.abnormalComponentCount > 0 || summary.value.serverCount !== summary.value.onlineServerCount) {
    return 'DEGRADED';
  }
  if (summary.value.componentCount === 0) {
    return 'UNKNOWN';
  }
  return 'UP';
});
const currentAlerts = computed(
  () =>
    trackedAlerts.value?.map((alert) => ({
      id: alert.id,
      name: alert.objectKey,
      displayName: alert.title,
      source: alert.source === 'KMC_HSM' ? '密码机' : '组件监控',
      reason: alert.acknowledgedAt ? '已确认' : '待确认'
    })) ??
    components.value.filter(isComponentAbnormal).map((component) => ({
      id: undefined,
      name: component.name,
      displayName: component.displayName,
      source: componentDeploymentText(component),
      reason: componentStatusText(component)
    }))
);
const findServerByContainerName = (containerName?: string) => {
  if (!containerName) {
    return undefined;
  }
  return servers.value.find((server) => server.containers?.some((container) => container.name === containerName));
};
const selectedServer = computed(() => {
  const containerName = selectedComponent.value?.container?.name;
  return findServerByContainerName(containerName);
});
const selectedServerText = computed(() => {
  if (selectedComponent.value?.name === agentName) {
    return selectedAgent.value ? agentNodeLabel(selectedAgent.value) : '-';
  }
  if (!selectedServer.value) {
    return '-';
  }
  return `${selectedServer.value.name}（${selectedServer.value.host || selectedServer.value.code}）`;
});
const drawerSize = computed(() => (window.innerWidth < 768 ? '92%' : '520px'));

const metricCards = computed(() => [
  {
    label: '整体状态',
    value: statusText(overallStatus.value),
    icon: overallStatus.value === 'UP' ? 'CircleCheck' : 'Warning',
    tone: overallStatus.value === 'UP' ? 'green' : overallStatus.value === 'UNKNOWN' ? 'gray' : 'orange'
  },
  { label: '在线服务器', value: `${summary.value.onlineServerCount}/${summary.value.serverCount}`, icon: 'Monitor', tone: 'blue' },
  { label: '运行容器', value: `${summary.value.runningContainerCount}/${summary.value.containerCount}`, icon: 'Box', tone: 'cyan' },
  {
    label: '业务领域服务',
    value: `${appRunningCount.value}/${appComponents.value.length}`,
    icon: 'Connection',
    tone: appAbnormalCount.value > 0 ? 'orange' : 'green'
  },
  { label: '当前告警', value: currentAlerts.value.length, icon: 'Warning', tone: currentAlerts.value.length > 0 ? 'red' : 'gray' }
]);

const safePercent = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
};

const openComponentDetail = (component: OpsComponent & { layerName?: string; layerOrder?: number }) => {
  selectedComponent.value = component;
  detailDrawerVisible.value = true;
};

const openAlertDetail = (componentName: string, incidentId?: string) => {
  if (incidentId) {
    void router.push({ path: '/ops/alert', query: { incident: incidentId } });
    return;
  }
  const component = components.value.find((item) => item.name === componentName);
  if (component) {
    openComponentDetail(component);
  }
};

const openContainerDetail = (container: OpsContainerWithServer) => {
  selectedContainer.value = container;
  containerDrawerVisible.value = true;
};

const openLogsForComponent = async (component = selectedComponent.value) => {
  if (component?.name === agentName) {
    if (selectedAgent.value) {
      await openLogsForContainer(selectedAgent.value);
    }
    return;
  }
  const server = findServerByContainerName(component?.container?.name);
  if (!component?.container || !server) {
    return;
  }
  await openLogsForContainer({
    ...component.container,
    serverCode: server.code,
    serverName: server.name,
    serverHost: server.host
  });
};

const openLogsForContainer = async (container: OpsContainerWithServer) => {
  if (!container.serverCode || !container.name) {
    ElMessage.warning('未找到容器所在服务器，无法读取日志');
    return;
  }
  containerLogs.value = undefined;
  selectedLogsContainer.value = container;
  logsDrawerVisible.value = true;
  await loadContainerLogs(container);
};

const reloadLogs = async () => {
  if (selectedLogsContainer.value) {
    await loadContainerLogs(selectedLogsContainer.value);
  }
};

const loadContainerLogs = async (container: OpsContainerWithServer) => {
  if (!container.serverCode || !container.name) {
    return;
  }
  const requestId = ++logsRequestId;
  logsLoading.value = true;
  try {
    const logs = await getOpsContainerLogs(container.serverCode, container.name, logsTail);
    if (requestId === logsRequestId) {
      containerLogs.value = logs;
    }
  } catch (error) {
    if (requestId === logsRequestId) {
      containerLogs.value = undefined;
      ElMessage.error((error as Error)?.message || '读取容器日志失败');
    }
  } finally {
    if (requestId === logsRequestId) {
      logsLoading.value = false;
    }
  }
};

const shortContainerId = (containerId?: string) => {
  if (!containerId) {
    return '-';
  }
  return containerId.length > 12 ? containerId.slice(0, 12) : containerId;
};

const loadData = async () => {
  loading.value = true;
  try {
    const [overviewRes, serverRes, containerRes] = await Promise.all([getOpsOverview(), getOpsServers(), getOpsContainers()]);
    overview.value = overviewRes;
    try {
      const page = await getAlertIncidents(false, 0, 200);
      trackedAlerts.value = page.enabled ? page.items : undefined;
    } catch {
      trackedAlerts.value = undefined;
    }
    servers.value = serverRes || [];
    containers.value = containerRes || [];
    const layerCodes = overviewRes?.layers?.map((layer) => layer.code) || [];
    if (unboundContainers.value.length > 0) {
      layerCodes.push('__unbound_containers');
    }
    if (!layerCodes.includes(activeLayerTab.value)) {
      activeLayerTab.value = layerCodes[0] || '';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
.ops-page {
  min-height: calc(100vh - 84px);
  padding: 24px;
  background: var(--el-bg-color-page);
  color: #1d3557;
}

.ops-toolbar,
.ops-panel-header,
.ops-layer-title,
.ops-resource-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ops-toolbar {
  max-width: 1420px;
  margin: 0 auto 18px;
  padding: 10px 4px 12px;

  h2 {
    margin: 0 0 4px;
    color: #457b9d;
    font-size: 30px;
    font-weight: 800;
  }

  span {
    color: #1d3557;
    font-size: 14px;
  }
}

.ops-refresh-btn,
.ops-docker-refresh {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #2a9d8f, #457b9d);
  box-shadow: 0 10px 24px rgb(42 157 143 / 26%);
  color: #fff;
  font-weight: 700;
}

.ops-metrics-grid {
  max-width: 1420px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin: 0 auto 16px;
}

.ops-metric {
  display: flex;
  align-items: center;
  min-height: 86px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);

  span {
    display: block;
    color: #5f6d7a;
    font-size: 13px;
  }

  strong {
    display: block;
    margin-top: 6px;
    color: #1d3557;
    font-size: 26px;
    font-weight: 700;
  }
}

.ops-metric-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-right: 14px;
  border-radius: 12px;
  color: #fff;
  font-size: 22px;

  &.blue {
    background: linear-gradient(135deg, #457b9d, #4cc9f0);
  }
  &.green {
    background: linear-gradient(135deg, #2a9d8f, #8ac926);
  }
  &.cyan {
    background: linear-gradient(135deg, #2a9d8f, #457b9d);
  }
  &.orange {
    background: linear-gradient(135deg, #e9c46a, #f4a261);
  }
  &.red {
    background: linear-gradient(135deg, #f4a261, #e76f51);
  }
  &.gray {
    background: linear-gradient(135deg, #8da2b5, #65758a);
  }
}

.ops-panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);

  :deep(.el-card__body) {
    padding: 14px;
  }
}

.ops-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(285px, 1fr);
  align-items: start;
  gap: 14px;
  max-width: 1420px;
  margin: 0 auto;
}

.ops-component-panel,
.ops-dashboard-aside {
  min-width: 0;
}

.ops-dashboard-aside {
  display: grid;
  gap: 14px;
}

.ops-resources-panel {
  grid-column: 1 / -1;
}

.ops-panel-header {
  font-weight: 600;
  color: #1d3557;
}

.ops-panel-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.ops-layer-select {
  width: min(100%, 320px);
  margin-bottom: 14px;
}

.ops-component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 285px), 1fr));
  gap: 14px;
}

.ops-component {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 188px;
  padding: 16px;
  border: 1px solid rgb(69 123 157 / 18%);
  border-radius: 12px;
  background: rgb(255 255 255 / 76%);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: #2a9d8f;
    box-shadow: 0 12px 28px rgb(69 123 157 / 16%);
    transform: translateY(-1px);
  }
}

.ops-container-inline {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(29 53 87 / 7%);

  div {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 10px;
    color: #6c757d;
    font-size: 12px;
  }

  b {
    overflow: hidden;
    color: #1d3557;
    font-weight: 700;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ops-component-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;

  b,
  span {
    display: block;
  }

  b {
    color: #1d3557;
  }

  span {
    margin-top: 3px;
    color: #6c757d;
    font-size: 12px;
  }
}

.ops-deps {
  margin-top: 8px;
  color: #6c757d;
  font-size: 12px;
}

.ops-alert-list {
  display: grid;
  gap: 10px;
}

.ops-alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
  padding: 10px 0;
  border: 0;
  border-bottom: 1px solid rgb(29 53 87 / 7%);
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:last-child {
    border-bottom: 0;
  }

  &:hover b {
    color: #2a9d8f;
  }

  b,
  span {
    display: block;
  }

  b {
    color: #1d3557;
  }

  span {
    margin-top: 3px;
    color: #6c757d;
    font-size: 12px;
  }
}

.ops-table-main {
  b,
  span {
    display: block;
  }

  span {
    color: #6c757d;
    font-size: 12px;
  }
}

.ops-resource-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 12px;
}

.ops-resource {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.ops-resource-title {
  flex-wrap: wrap;
  gap: 4px 12px;
  overflow-wrap: anywhere;
  margin-bottom: 10px;

  span {
    font-weight: 600;
    color: #1d3557;
  }

  small {
    color: #6c757d;
  }
}

.ops-progress-row {
  display: grid;
  grid-template-columns: 42px 1fr;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #495057;
  font-size: 12px;
}

.ops-container-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 285px), 1fr));
  gap: 14px;

  &.compact {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
}

.ops-container-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 190px;
  padding: 16px;
  border: 1px solid rgb(69 123 157 / 18%);
  border-radius: 12px;
  background: rgb(255 255 255 / 78%);
  box-shadow: 0 8px 18px rgb(29 53 87 / 7%);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: #2a9d8f;
    box-shadow: 0 12px 28px rgb(69 123 157 / 16%);
    transform: translateY(-2px);
  }
}

.ops-container-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  color: #457b9d;

  b {
    overflow: hidden;
    font-size: 16px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ops-container-detail {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  margin-top: 10px;
  color: #6c757d;
  font-size: 13px;

  b {
    overflow: hidden;
    color: #1d3557;
    font-weight: 700;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ops-drawer-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;

  span {
    overflow: hidden;
    color: #1d3557;
    font-size: 16px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ops-detail {
  :deep(.el-descriptions__label) {
    width: 110px;
    color: #4b5563;
    font-weight: 500;
  }
}

.ops-agent-node-select {
  width: 100%;
}

.ops-card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 14px;
}

.ops-card-log-btn {
  min-width: 96px;
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
}

.ops-log-btn {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #2a9d8f, #457b9d);
  box-shadow: 0 8px 18px rgb(42 157 143 / 20%);
  color: #fff;
  font-weight: 700;

  &.is-disabled {
    background: #aab7c4;
    box-shadow: none;
    color: #fff;
  }
}

.ops-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ops-logs-panel {
  min-height: 420px;
}

.ops-logs-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  color: #6c757d;
  font-size: 13px;
}

.ops-logs-content {
  max-height: calc(100vh - 210px);
  min-height: 420px;
  padding: 18px;
  overflow: auto;
  border-radius: 12px;
  background: #1e1e1e;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
  color: #d4d4d4;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;

  pre {
    min-height: 20px;
    padding: 4px 6px;
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;

    &:nth-child(odd) {
      background: rgb(255 255 255 / 5%);
    }
  }
}

@media (max-width: 1200px) {
  .ops-metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1000px) {
  .ops-dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .ops-metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ops-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ops-component-grid,
  .ops-container-grid,
  .ops-container-grid.compact {
    grid-template-columns: minmax(0, 1fr);
  }

  .ops-metric {
    padding: 10px;
  }

  .ops-metric-icon {
    flex: 0 0 30px;
    height: 30px;
    margin-right: 8px;
    font-size: 16px;
  }

  .ops-page {
    padding: 14px;
  }
}
.ops-page.ops-page-embedded {
  min-height: 0;
  padding: 0;
}
</style>
