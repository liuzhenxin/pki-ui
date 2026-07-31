<template>
  <div class="ops-page">
    <div class="ops-toolbar">
      <div>
        <h2>业务服务</h2>
        <span>根据实际业务服务配置展示运行情况 · 最近采集时间：{{ dateTimeText(overview?.collectedAt) }}</span>
      </div>
      <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <el-card shadow="never" class="ops-query">
      <el-form :model="query" :inline="true">
        <el-form-item label="服务">
          <el-select v-model="query.serviceName" placeholder="全部服务" clearable style="width: 190px" @change="handleQuery">
            <el-option v-for="service in serviceOptions" :key="service.name" :label="service.displayName" :value="service.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px" @change="handleQuery">
            <el-option label="运行中" value="running" />
            <el-option label="异常" value="abnormal" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="ops-metrics">
      <div class="ops-metric">
        <span>服务总数</span>
        <strong>{{ serviceRows.length }}</strong>
      </div>
      <div class="ops-metric success">
        <span>运行中</span>
        <strong>{{ runningCount }}</strong>
      </div>
      <div class="ops-metric warning">
        <span>异常服务</span>
        <strong>{{ abnormalCount }}</strong>
      </div>
    </div>

    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <span>业务服务列表</span>
          <el-tag effect="plain" :type="abnormalCount > 0 ? 'warning' : 'success'">正常 {{ runningCount }}/{{ serviceRows.length }}</el-tag>
        </div>
      </template>

      <el-table v-loading="loading" :data="filteredRows" border>
        <el-table-column label="服务名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="ops-service-cell">
              <b>{{ row.displayName }}</b>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.statusType" effect="plain">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="容器名称" prop="containerName" min-width="170" show-overflow-tooltip />
        <el-table-column label="镜像" prop="image" min-width="220" show-overflow-tooltip />
        <el-table-column label="所在服务器" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="ops-service-cell">
              <b>{{ row.serverName || '-' }}</b>
              <span>{{ row.serverHost || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="依赖" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.dependencies?.length ? row.dependencies.join(' / ') : '无' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="View" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredRows.length === 0" description="暂无业务服务数据" />
    </el-card>

    <el-drawer v-model="drawerVisible" :size="drawerSize" destroy-on-close>
      <template #header>
        <div class="ops-drawer-title">
          <span>{{ selectedRow?.displayName || '服务详情' }}</span>
          <el-tag v-if="selectedRow" :type="selectedRow.statusType" effect="plain">{{ selectedRow.statusText }}</el-tag>
        </div>
      </template>

      <el-descriptions v-if="selectedRow" :column="1" border>
        <el-descriptions-item label="服务编码">{{ selectedRow.name }}</el-descriptions-item>
        <el-descriptions-item label="服务名称">{{ selectedRow.displayName }}</el-descriptions-item>
        <el-descriptions-item label="所属层级">{{ selectedRow.layerName || '业务服务' }}</el-descriptions-item>
        <el-descriptions-item label="运行状态">{{ selectedRow.statusText }}</el-descriptions-item>
        <el-descriptions-item label="容器名称">{{ selectedRow.containerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="容器 ID">{{ selectedRow.containerId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="镜像">{{ selectedRow.image || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Docker 状态">{{ selectedRow.containerStatus || '-' }}</el-descriptions-item>
        <el-descriptions-item label="端口">{{ selectedRow.ports || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所在服务器">{{ selectedRow.serverName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="服务器地址">{{ selectedRow.serverHost || '-' }}</el-descriptions-item>
        <el-descriptions-item label="依赖组件">
          <div v-if="selectedRow.dependencies?.length" class="ops-tags">
            <el-tag v-for="dependency in selectedRow.dependencies" :key="dependency" effect="plain">{{ dependency }}</el-tag>
          </div>
          <span v-else>无</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup name="OpsBusinessService" lang="ts">
import { getOpsOverview, getOpsServers } from '@/api/ops';
import type { OpsOverview, OpsServer } from '@/api/ops/types';
import { dateTimeText, flattenComponents, statusTagType, statusText } from '@/views/ops/utils';

interface BusinessServiceRow {
  name: string;
  displayName: string;
  layerName?: string;
  dependencies: string[];
  running: boolean;
  statusKey: 'running' | 'abnormal';
  statusText: string;
  statusType: ReturnType<typeof statusTagType>;
  containerName?: string;
  containerId?: string;
  image?: string;
  containerStatus?: string;
  ports?: string;
  serverName?: string;
  serverHost?: string;
}

const BUSINESS_SERVICES = [
  { name: 'liuzx-ca', displayName: '证书认证中心' },
  { name: 'liuzx-ra', displayName: '注册认证中心' },
  { name: 'liuzx-kmc', displayName: '密钥管理中心' },
  { name: 'liuzx-ocsp', displayName: '在线证书状态服务' }
] as const;

const loading = ref(false);
const overview = ref<OpsOverview>();
const servers = ref<OpsServer[]>([]);
const drawerVisible = ref(false);
const selectedRow = ref<BusinessServiceRow>();
const query = ref({
  serviceName: '',
  status: ''
});

const businessComponentMap = computed(() => new Map(flattenComponents(overview.value).map((component) => [component.name, component] as const)));
const serviceOptions = BUSINESS_SERVICES;

const findServerByContainerName = (containerName?: string) => {
  if (!containerName) {
    return undefined;
  }
  return servers.value.find((server) => server.containers?.some((container) => container.name === containerName));
};

const serviceRows = computed<BusinessServiceRow[]>(() =>
  BUSINESS_SERVICES.map((service) => {
    const component = businessComponentMap.value.get(service.name);
    const container = component?.container;
    const server = findServerByContainerName(container?.name);
    const running = Boolean(container?.running);
    const statusKey = running ? 'running' : 'abnormal';
    return {
      name: service.name,
      displayName: component?.displayName || service.displayName,
      layerName: component?.layerName,
      dependencies: component?.dependencies || [],
      running,
      statusKey,
      statusText: statusText(container?.state, container?.running, container?.present),
      statusType: statusTagType(container?.state, container?.running, container?.present),
      containerName: container?.name,
      containerId: container?.containerId,
      image: container?.image,
      containerStatus: container?.status || container?.state,
      ports: container?.ports,
      serverName: server?.name,
      serverHost: server?.host
    };
  })
);

const filteredRows = computed(() =>
  serviceRows.value.filter((row) => {
    const hitService = !query.value.serviceName || row.name === query.value.serviceName;
    const hitStatus = !query.value.status || row.statusKey === query.value.status;
    return hitService && hitStatus;
  })
);
const runningCount = computed(() => serviceRows.value.filter((row) => row.running).length);
const abnormalCount = computed(() => serviceRows.value.length - runningCount.value);
const drawerSize = computed(() => (window.innerWidth < 768 ? '92%' : '560px'));

const handleQuery = () => {};

const resetQuery = () => {
  query.value.serviceName = '';
  query.value.status = '';
};

const openDetail = (row: BusinessServiceRow) => {
  selectedRow.value = row;
  drawerVisible.value = true;
};

const loadData = async () => {
  loading.value = true;
  try {
    const [overviewRes, serverRes] = await Promise.all([getOpsOverview(), getOpsServers()]);
    overview.value = overviewRes;
    servers.value = serverRes || [];
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
  background:
    radial-gradient(circle at 12% 8%, rgb(168 237 234 / 48%), transparent 30%),
    radial-gradient(circle at 88% 16%, rgb(254 214 227 / 62%), transparent 36%), linear-gradient(135deg, #a8edea 0%, #f4f6fb 48%, #fed6e3 100%);
  color: #1d3557;
}

.ops-toolbar,
.ops-panel-header,
.ops-drawer-title {
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

.ops-query,
.ops-panel,
.ops-metrics {
  max-width: 1420px;
  margin-right: auto;
  margin-left: auto;
}

.ops-query,
.ops-panel {
  margin-bottom: 14px;
  border: 1px solid rgb(255 255 255 / 56%);
  border-radius: 12px;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 12px 28px rgb(29 53 87 / 10%);
  backdrop-filter: blur(10px);
}

.ops-query :deep(.el-card__body) {
  padding-bottom: 0;
}

.ops-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.ops-metric {
  min-height: 86px;
  padding: 16px;
  border: 1px solid rgb(255 255 255 / 56%);
  border-radius: 12px;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 12px 28px rgb(29 53 87 / 10%);

  span,
  strong {
    display: block;
  }

  span {
    color: #5f6d7a;
    font-size: 13px;
  }

  strong {
    margin-top: 6px;
    color: #1d3557;
    font-size: 28px;
    font-weight: 800;
  }

  &.success strong {
    color: #2a9d8f;
  }

  &.warning strong {
    color: #e76f51;
  }
}

.ops-panel-header {
  font-weight: 700;
  color: #1d3557;
}

.ops-service-cell {
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

.ops-drawer-title {
  width: 100%;

  span {
    overflow: hidden;
    color: #1d3557;
    font-size: 16px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ops-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 768px) {
  .ops-page {
    padding: 14px;
  }

  .ops-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ops-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
