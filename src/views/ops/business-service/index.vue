<template>
  <div class="ops-page">
    <div class="ops-toolbar">
      <div>
        <h2>应用服务</h2>
        <span>根据实际应用服务配置展示运行情况 · 最近采集时间：{{ dateTimeText(overview?.collectedAt) }}</span>
      </div>
      <div class="ops-toolbar-actions">
        <el-button v-hasPermi="['ops:business-service:edit']" type="primary" plain icon="Setting" @click="openConfig">配置</el-button>
        <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
      </div>
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
          <span>应用服务列表</span>
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
      <el-empty v-if="!loading && filteredRows.length === 0" description="暂无应用服务数据" />
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
        <el-descriptions-item label="所属层级">{{ selectedRow.layerName || '应用服务' }}</el-descriptions-item>
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

    <el-dialog v-model="configVisible" title="应用服务监控配置" width="900px" destroy-on-close>
      <div class="ops-config-tip">配置了哪些服务就监控哪些 · 停用（关闭开关）后该服务不再出现在监控列表</div>
      <el-form ref="configFormRef" :model="configForm" :rules="configRules">
        <el-table :data="configForm.services" border>
          <el-table-column label="启用" width="70" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" />
            </template>
          </el-table-column>
          <el-table-column label="服务编码" min-width="160">
            <template #default="{ row, $index }">
              <el-form-item :prop="`services.${$index}.code`" :rules="configRules.code">
                <el-input v-model="row.code" placeholder="如 liuzx-crypto" />
              </el-form-item>
            </template>
          </el-table-column>
          <el-table-column label="服务名称" min-width="150">
            <template #default="{ row, $index }">
              <el-form-item :prop="`services.${$index}.name`" :rules="configRules.name">
                <el-input v-model="row.name" placeholder="如 数据加密服务" />
              </el-form-item>
            </template>
          </el-table-column>
          <el-table-column label="容器匹配规则" min-width="190">
            <template #default="{ row }">
              <el-input v-model="row.containerMatchRule" placeholder="如 name:liuzx-crypto" />
            </template>
          </el-table-column>
          <el-table-column label="依赖" min-width="200">
            <template #default="{ row }">
              <el-select v-model="row.dependencies" multiple filterable allow-create default-first-option placeholder="依赖组件" style="width: 100%">
                <el-option v-for="dep in dependencyOptions" :key="dep" :label="dep" :value="dep" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" icon="Delete" @click="removeService($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button type="primary" plain icon="Plus" style="margin-top: 12px" @click="addService">添加服务</el-button>
      </el-form>
      <template #footer>
        <el-button @click="configVisible = false">取消</el-button>
        <el-button type="primary" :loading="configSaving" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OpsBusinessService" lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { getBusinessServiceConfig, getOpsOverview, getOpsServers, saveBusinessServiceConfig } from '@/api/ops';
import type { BusinessServiceConfig, OpsOverview, OpsServer } from '@/api/ops/types';
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

const loading = ref(false);
const overview = ref<OpsOverview>();
const servers = ref<OpsServer[]>([]);
const drawerVisible = ref(false);
const selectedRow = ref<BusinessServiceRow>();
const query = ref({
  serviceName: '',
  status: ''
});
const businessConfig = ref<BusinessServiceConfig>({ services: [] });

const enabledServices = computed(() => businessConfig.value.services.filter((service) => service.enabled));
const businessComponentMap = computed(() => new Map(flattenComponents(overview.value).map((component) => [component.name, component] as const)));
const serviceOptions = computed(() => enabledServices.value.map((service) => ({ name: service.code, displayName: service.name })));

const findServerByContainerName = (containerName?: string) => {
  if (!containerName) {
    return undefined;
  }
  return servers.value.find((server) => server.containers?.some((container) => container.name === containerName));
};

const serviceRows = computed<BusinessServiceRow[]>(() =>
  enabledServices.value.map((service) => {
    const component = businessComponentMap.value.get(service.code);
    const container = component?.container;
    const server = findServerByContainerName(container?.name);
    const running = Boolean(container?.running);
    const statusKey = running ? 'running' : 'abnormal';
    return {
      name: service.code,
      displayName: component?.displayName || service.name,
      layerName: component?.layerName,
      dependencies: component?.dependencies || service.dependencies || [],
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
    const [overviewRes, serverRes, configRes] = await Promise.all([getOpsOverview(), getOpsServers(), getBusinessServiceConfig()]);
    overview.value = overviewRes;
    servers.value = serverRes || [];
    businessConfig.value = configRes?.data || { services: [] };
  } finally {
    loading.value = false;
  }
};

const configVisible = ref(false);
const configSaving = ref(false);
const configFormRef = ref<FormInstance>();
const configForm = reactive<BusinessServiceConfig>({ services: [] });
const configRules: FormRules = {
  code: [{ required: true, message: '请输入服务编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }]
};
const dependencyOptions = ['mysql8', 'redis8', 'kafka', 'liuzx-nacos', 'liuzx-gateway', 'liuzx-auth', 'liuzx-admin', 'liuzx-crypto', 'liuzx-ca', 'liuzx-kmc', 'liuzx-ra', 'liuzx-ocsp', 'liuzx-ops'];

const openConfig = () => {
  configForm.services = businessConfig.value.services.map((service) => ({
    code: service.code,
    name: service.name,
    layerCode: service.layerCode,
    layerName: service.layerName,
    layerOrder: service.layerOrder,
    componentOrder: service.componentOrder,
    containerMatchRule: service.containerMatchRule,
    description: service.description,
    enabled: service.enabled,
    dependencies: [...(service.dependencies || [])]
  }));
  configVisible.value = true;
};

const addService = () => {
  configForm.services.push({
    code: '',
    name: '',
    layerCode: 'app',
    layerName: '第四层 - 应用服务',
    layerOrder: 4,
    componentOrder: configForm.services.length * 10 + 100,
    containerMatchRule: '',
    description: '',
    enabled: true,
    dependencies: []
  });
};

const removeService = (index: number) => {
  configForm.services.splice(index, 1);
};

const saveConfig = async () => {
  await configFormRef.value?.validate();
  configSaving.value = true;
  try {
    await saveBusinessServiceConfig(JSON.parse(JSON.stringify(configForm)));
    ElMessage.success('应用服务监控配置已保存');
    configVisible.value = false;
    await loadData();
  } finally {
    configSaving.value = false;
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

.ops-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ops-config-tip {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgb(69 123 157 / 10%);
  color: #457b9d;
  font-size: 13px;
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
