<template>
  <div class="ops-page">
    <el-card shadow="never" class="ops-query">
      <el-form :model="query" :inline="true">
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" placeholder="容器名称 / 镜像 / 服务器" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.running" placeholder="全部" clearable style="width: 120px">
            <el-option label="运行中" value="true" />
            <el-option label="未运行" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <span>容器监控</span>
          <div>
            <el-tag effect="plain" type="success">运行 {{ runningCount }}</el-tag>
            <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="pagedContainers" border>
        <el-table-column label="容器名称" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column label="所在服务器" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="server-cell">
              <b>{{ row.serverName }}</b>
              <span>{{ row.serverHost }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="镜像" prop="image" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.state, row.running, row.present)" effect="plain">
              {{ statusText(row.state, row.running, row.present) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Docker 状态" prop="status" min-width="190" show-overflow-tooltip />
        <el-table-column label="端口映射" prop="ports" min-width="260" show-overflow-tooltip />
      </el-table>

      <pagination v-show="filteredContainers.length > 0" v-model:page="page.pageNum" v-model:limit="page.pageSize" :total="filteredContainers.length" />
    </el-card>
  </div>
</template>

<script setup name="OpsContainer" lang="ts">
import { getOpsContainers, getOpsServers } from '@/api/ops';
import type { OpsContainer, OpsServer } from '@/api/ops/types';
import { collectContainers, statusTagType, statusText } from '@/views/ops/utils';

interface OpsContainerRow extends OpsContainer {
  serverCode?: string;
  serverName?: string;
  serverHost?: string;
}

const loading = ref(false);
const containers = ref<OpsContainerRow[]>([]);
const query = ref({
  keyword: '',
  running: ''
});
const page = ref({
  pageNum: 1,
  pageSize: 10
});

const filteredContainers = computed(() => {
  const keyword = query.value.keyword.trim().toLowerCase();
  return containers.value.filter((item) => {
    const hitKeyword =
      !keyword ||
      [item.name, item.image, item.serverName, item.serverHost, item.status, item.ports].some((value) => String(value || '').toLowerCase().includes(keyword));
    const hitStatus = query.value.running === '' || String(item.running) === query.value.running;
    return hitKeyword && hitStatus;
  });
});

const pagedContainers = computed(() => {
  const start = (page.value.pageNum - 1) * page.value.pageSize;
  return filteredContainers.value.slice(start, start + page.value.pageSize);
});

const runningCount = computed(() => containers.value.filter((item) => item.running).length);

const handleQuery = () => {
  page.value.pageNum = 1;
};

const resetQuery = () => {
  query.value.keyword = '';
  query.value.running = '';
  handleQuery();
};

const loadData = async () => {
  loading.value = true;
  try {
    const [servers, fallbackContainers] = await Promise.all([getOpsServers(), getOpsContainers()]);
    containers.value = collectContainers((servers || []) as OpsServer[], fallbackContainers || []) as OpsContainerRow[];
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped lang="scss">
.ops-page {
  padding: 12px;
}

.ops-query,
.ops-panel {
  margin-bottom: 12px;
  border-radius: 8px;
}

.ops-query :deep(.el-card__body) {
  padding-bottom: 0;
}

.ops-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    font-weight: 600;
    color: #1f2937;
  }

  > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.server-cell {
  b,
  span {
    display: block;
  }

  span {
    margin-top: 3px;
    color: #6b7280;
    font-size: 12px;
  }
}
</style>
