<template>
  <div class="ops-page">
    <el-row :gutter="12" class="summary-row">
      <el-col v-for="item in summary" :key="item.label" :xs="12" :sm="8" :md="4">
        <el-card shadow="never" class="summary-card"
          ><span>{{ item.label }}</span
          ><strong :class="item.type">{{ item.value }}</strong></el-card
        >
      </el-col>
    </el-row>

    <el-card shadow="never" class="ops-query">
      <el-form :model="query" :inline="true">
        <el-form-item label="服务器">
          <el-select v-model="query.serverCode" clearable placeholder="全部" style="width: 180px">
            <el-option v-for="server in servers" :key="server.code" :label="server.name" :value="server.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="运行状态">
          <el-select v-model="query.running" clearable placeholder="全部" style="width: 120px">
            <el-option label="运行中" value="true" /><el-option label="已停止" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="健康状态">
          <el-select v-model="query.health" clearable placeholder="全部" style="width: 130px">
            <el-option label="健康" value="healthy" /><el-option label="异常" value="unhealthy" />
            <el-option label="启动中" value="starting" /><el-option label="无检查" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本"><el-checkbox v-model="query.updateOnly">仅可升级</el-checkbox></el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" clearable placeholder="容器 / 镜像 / Compose服务" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item
          ><el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button><el-button @click="resetQuery">重置</el-button></el-form-item
        >
      </el-form>
    </el-card>

    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="panel-header">
          <span>容器管理</span>
          <div>
            <el-button v-hasPermi="['ops:container:check-update']" icon="Download" :loading="checking" @click="checkUpdates">检查新版本</el-button>
            <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>
      <el-table v-loading="loading" :data="pagedContainers" border>
        <el-table-column label="容器" min-width="175" fixed="left"
          ><template #default="{ row }"
            ><b>{{ row.name }}</b
            ><small>{{ row.composeService || '未映射Compose服务' }}</small></template
          ></el-table-column
        >
        <el-table-column label="服务器" min-width="150"
          ><template #default="{ row }"
            >{{ row.serverName }}<small>{{ row.serverHost }}</small></template
          ></el-table-column
        >
        <el-table-column label="当前镜像版本" prop="image" min-width="220" show-overflow-tooltip />
        <el-table-column label="最新稳定版本" width="130"
          ><template #default="{ row }"
            ><el-tag v-if="versionOf(row).updateAvailable" type="warning">{{ versionOf(row).latestTag }}</el-tag
            ><span v-else>{{ versionOf(row).latestTag || '-' }}</span></template
          ></el-table-column
        >
        <el-table-column label="镜像摘要" width="145"
          ><template #default="{ row }"
            ><code>{{ shortDigest(row.imageDigest) }}</code></template
          ></el-table-column
        >
        <el-table-column label="运行" width="90" align="center"
          ><template #default="{ row }"
            ><el-tag :type="row.running ? 'success' : 'info'">{{ row.running ? '运行中' : '已停止' }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="健康" width="90" align="center"
          ><template #default="{ row }"
            ><el-tag :type="healthType(row.health)">{{ healthText(row.health) }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-hasPermi="['ops:container:logs']" link @click="openLogs(row)">日志</el-button>
            <el-button
              v-if="!row.running && manageable(row)"
              v-hasPermi="['ops:container:start']"
              link
              type="success"
              @click="confirmAction(row, 'START')"
              >启动</el-button
            >
            <el-button
              v-if="row.running && manageable(row)"
              v-hasPermi="['ops:container:stop']"
              link
              type="danger"
              @click="confirmAction(row, 'STOP')"
              >停止</el-button
            >
            <el-button
              v-if="row.running && manageable(row)"
              v-hasPermi="['ops:container:restart']"
              link
              type="warning"
              @click="confirmAction(row, 'RESTART')"
              >重启</el-button
            >
            <el-tooltip v-if="manageable(row)" :content="disabledReason(row)" :disabled="canUpgrade(row)"
              ><span
                ><el-button v-hasPermi="['ops:container:upgrade']" link type="primary" :disabled="!canUpgrade(row)" @click="openUpgrade(row)"
                  >升级</el-button
                ></span
              ></el-tooltip
            >
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="filteredContainers.length" v-model:page="page.pageNum" v-model:limit="page.pageSize" :total="filteredContainers.length" />
    </el-card>

    <el-drawer v-model="detailVisible" title="容器详情" size="620px">
      <el-descriptions v-if="selected" :column="1" border>
        <el-descriptions-item label="容器">{{ selected.name }}</el-descriptions-item
        ><el-descriptions-item label="服务器">{{ selected.serverName }}（{{ selected.serverHost }}）</el-descriptions-item>
        <el-descriptions-item label="容器 ID">{{ selected.containerId }}</el-descriptions-item
        ><el-descriptions-item label="镜像">{{ selected.image }}</el-descriptions-item>
        <el-descriptions-item label="镜像 ID / Digest">{{ selected.imageId || '-' }}<br />{{ selected.imageDigest || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Compose">{{ selected.composeProject || '-' }} / {{ selected.composeService || '-' }}</el-descriptions-item>
        <el-descriptions-item label="配置文件">{{ selected.composeConfigFiles || '-' }}</el-descriptions-item
        ><el-descriptions-item label="端口">{{ selected.ports || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider>最近操作</el-divider>
      <el-timeline
        ><el-timeline-item
          v-for="item in selectedOperations"
          :key="item.operationNo"
          :timestamp="dateTimeText(item.createdAt)"
          :type="item.status === 'SUCCESS' ? 'success' : item.status === 'FAILED' ? 'danger' : 'primary'"
          >{{ item.operationType }} · {{ item.status }} · {{ item.currentStep }}</el-timeline-item
        ></el-timeline
      >
    </el-drawer>

    <el-dialog v-model="logsVisible" title="实时日志" width="80%"
      ><div class="log-meta">最近 {{ logs?.tail || 200 }} 行 · {{ dateTimeText(logs?.collectedAt) }}</div>
      <pre class="logs">{{ logs?.lines?.join('\n') || '暂无日志' }}</pre>
    </el-dialog>

    <el-dialog v-model="upgradeVisible" title="确认升级" width="620px">
      <el-alert title="升级只重建目标 Compose 服务；健康检查失败将自动回滚。" type="warning" :closable="false" show-icon />
      <el-descriptions v-if="selected" :column="1" border class="upgrade-info"
        ><el-descriptions-item label="容器">{{ selected.name }}</el-descriptions-item
        ><el-descriptions-item label="当前版本">{{ selected.image }}</el-descriptions-item
        ><el-descriptions-item label="目标版本">{{ targetImage }}</el-descriptions-item
        ><el-descriptions-item label="目标 Digest">{{ versionOf(selected).latestDigest }}</el-descriptions-item></el-descriptions
      >
      <p>
        请输入容器名称 <b>{{ selected?.name }}</b> 确认：
      </p>
      <el-input v-model="confirmText" autocomplete="off" />
      <template #footer
        ><el-button @click="upgradeVisible = false">取消</el-button
        ><el-button type="primary" :disabled="confirmText !== selected?.name" @click="submitAction(selected!, 'UPGRADE')"
          >开始升级</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="progressVisible" title="操作进度" width="620px" :close-on-click-modal="false">
      <el-steps direction="vertical" :active="operationStep" :process-status="operation?.status === 'FAILED' ? 'error' : 'process'">
        <el-step v-for="step in progressSteps" :key="step" :title="step" />
      </el-steps>
      <el-alert v-if="operation?.errorMessage" :title="operation.errorMessage" type="error" :closable="false" />
      <template #footer
        ><el-button :disabled="operation?.status === 'RUNNING' || operation?.status === 'PENDING'" @click="progressVisible = false"
          >关闭</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<script setup name="OpsContainer" lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  checkOpsContainerUpdates,
  getOpsContainerLogs,
  getOpsContainers,
  getOpsOperation,
  getOpsOperations,
  getOpsServers,
  submitOpsContainerAction
} from '@/api/ops';
import type { OpsContainer, OpsContainerAction, OpsContainerLogs, OpsContainerVersion, OpsOperation, OpsServer } from '@/api/ops/types';
import { collectContainers, dateTimeText } from '@/views/ops/utils';

interface Row extends OpsContainer {
  serverCode: string;
  serverName: string;
  serverHost: string;
}
const loading = ref(false);
const checking = ref(false);
const servers = ref<OpsServer[]>([]);
const containers = ref<Row[]>([]);
const versions = ref<Record<string, OpsContainerVersion>>({});
const operations = ref<OpsOperation[]>([]);
const selected = ref<Row>();
const logs = ref<OpsContainerLogs>();
const operation = ref<OpsOperation>();
const detailVisible = ref(false);
const logsVisible = ref(false);
const upgradeVisible = ref(false);
const progressVisible = ref(false);
const confirmText = ref('');
const query = ref({ serverCode: '', running: '', health: '', updateOnly: false, keyword: '' });
const page = ref({ pageNum: 1, pageSize: 10 });
let pollTimer: ReturnType<typeof setTimeout> | undefined;
const keyOf = (row: Row) => `${row.serverCode}/${row.name}`;
const versionOf = (row?: Row) => (row ? versions.value[keyOf(row)] : undefined) || ({} as OpsContainerVersion);
const manageable = (row: Row) => row.manageable === true;
const canUpgrade = (row: Row) => manageable(row) && row.health !== 'none' && row.health !== 'unknown' && versionOf(row).updateAvailable;
const disabledReason = (row: Row) =>
  ['none', 'unknown'].includes(row.health)
    ? '缺少有效 Docker healthcheck'
    : !versionOf(row).updateAvailable
      ? '没有更高的稳定版本'
      : '';
const healthText = (health: string) =>
  ({ healthy: '健康', unhealthy: '异常', starting: '启动中', none: '无检查', unknown: '未知' })[health] || health || '未知';
const healthType = (health: string) => (health === 'healthy' ? 'success' : health === 'starting' ? 'warning' : health === 'none' ? 'info' : 'danger');
const shortDigest = (digest?: string) => (digest ? `${digest.slice(0, 18)}…` : '-');
const filteredContainers = computed(() =>
  containers.value.filter(
    (row) =>
      (!query.value.serverCode || row.serverCode === query.value.serverCode) &&
      (!query.value.running || String(row.running) === query.value.running) &&
      (!query.value.health || row.health === query.value.health) &&
      (!query.value.updateOnly || versionOf(row).updateAvailable) &&
      (!query.value.keyword ||
        [row.name, row.image, row.composeService, row.serverName].some((value) => value?.toLowerCase().includes(query.value.keyword.toLowerCase())))
  )
);
const pagedContainers = computed(() =>
  filteredContainers.value.slice((page.value.pageNum - 1) * page.value.pageSize, page.value.pageNum * page.value.pageSize)
);
const summary = computed(() => [
  { label: '容器总数', value: containers.value.length, type: '' },
  { label: '运行中', value: containers.value.filter((v) => v.running).length, type: 'success' },
  { label: '已停止', value: containers.value.filter((v) => !v.running).length, type: 'muted' },
  { label: '可升级', value: Object.values(versions.value).filter((v) => v.updateAvailable).length, type: 'warning' },
  { label: '执行失败', value: operations.value.filter((v) => v.status === 'FAILED').length, type: 'danger' }
]);
const selectedOperations = computed(() =>
  operations.value.filter((item) => item.serverCode === selected.value?.serverCode && item.containerName === selected.value?.name)
);
const progressSteps = computed(() => (operation.value?.steps?.length ? operation.value.steps : ['排队', '预检', '执行', '健康验证', '完成']));
const operationStep = computed(() =>
  operation.value?.status === 'SUCCESS' ? progressSteps.value.length : Math.max(1, progressSteps.value.length - 1)
);
const targetImage = computed(() => {
  const row = selected.value;
  const v = versionOf(row);
  if (!row || !v.latestTag) return '';
  return `${row.image.slice(0, row.image.lastIndexOf(':'))}:${v.latestTag}`;
});
const handleQuery = () => {
  page.value.pageNum = 1;
};
const resetQuery = () => {
  query.value = { serverCode: '', running: '', health: '', updateOnly: false, keyword: '' };
  handleQuery();
};
const loadData = async () => {
  loading.value = true;
  try {
    const [serverRows, fallback, history] = await Promise.all([getOpsServers(), getOpsContainers(), getOpsOperations().catch(() => [])]);
    servers.value = serverRows || [];
    containers.value = collectContainers(servers.value, fallback || []) as Row[];
    operations.value = history;
  } finally {
    loading.value = false;
  }
};
const checkUpdates = async () => {
  checking.value = true;
  try {
    const result = await checkOpsContainerUpdates();
    const next: Record<string, OpsContainerVersion> = {};
    containers.value.forEach((row) => {
      const match = result.find((v) => row.image.includes(`/${v.repository}:`) || row.image.startsWith(`${v.repository}:`));
      if (match) next[keyOf(row)] = match;
    });
    versions.value = next;
    ElMessage.success('镜像版本检查完成');
  } finally {
    checking.value = false;
  }
};
const openDetail = (row: Row) => {
  selected.value = row;
  detailVisible.value = true;
};
const openLogs = async (row: Row) => {
  selected.value = row;
  logsVisible.value = true;
  logs.value = await getOpsContainerLogs(row.serverCode, row.name, 200);
};
const confirmAction = async (row: Row, action: OpsContainerAction) => {
  await ElMessageBox.confirm(`确认${{ START: '启动', STOP: '停止', RESTART: '重启', UPGRADE: '升级' }[action]}容器 ${row.name}？`, '二次确认', {
    type: 'warning'
  });
  await submitAction(row, action);
};
const openUpgrade = (row: Row) => {
  selected.value = row;
  confirmText.value = '';
  upgradeVisible.value = true;
};
const submitAction = async (row: Row, action: OpsContainerAction) => {
  const version = versionOf(row);
  operation.value = await submitOpsContainerAction(row.serverCode, row.name, {
    action,
    targetImage: action === 'UPGRADE' ? targetImage.value : undefined,
    targetDigest: action === 'UPGRADE' ? version.latestDigest : undefined,
    idempotencyKey: crypto.randomUUID(),
    confirmed: true
  });
  upgradeVisible.value = false;
  progressVisible.value = true;
  pollOperation();
};
const pollOperation = async () => {
  if (!operation.value) return;
  operation.value = await getOpsOperation(operation.value.operationNo);
  if (['PENDING', 'RUNNING'].includes(operation.value.status)) pollTimer = setTimeout(pollOperation, 1500);
  else {
    await loadData();
    ElMessage[operation.value.status === 'SUCCESS' ? 'success' : 'error'](operation.value.status === 'SUCCESS' ? '操作成功' : '操作失败');
  }
};
onMounted(loadData);
onBeforeUnmount(() => pollTimer && clearTimeout(pollTimer));
</script>

<style scoped lang="scss">
.ops-page {
  padding: 12px;
}
.summary-row,
.ops-query,
.ops-panel {
  margin-bottom: 12px;
}
.summary-card :deep(.el-card__body) {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.summary-card strong {
  font-size: 28px;
}
.summary-card .success {
  color: #16a34a;
}
.summary-card .warning {
  color: #d97706;
}
.summary-card .danger {
  color: #dc2626;
}
.summary-card .muted {
  color: #64748b;
}
.ops-query :deep(.el-card__body) {
  padding-bottom: 0;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.panel-header > div {
  display: flex;
  gap: 8px;
}
small {
  display: block;
  color: #64748b;
  margin-top: 4px;
}
.upgrade-info {
  margin-top: 16px;
}
.log-meta {
  color: #64748b;
  margin-bottom: 8px;
}
.logs {
  height: 55vh;
  overflow: auto;
  background: #111827;
  color: #e5e7eb;
  padding: 14px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
}
code {
  font-size: 12px;
}
</style>
