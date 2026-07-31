<template>
  <div class="ops-page">
    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <div>
            <span>Agent 管理</span>
            <small>根据服务器上报心跳自动识别部署节点</small>
          </div>
          <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="servers" border>
        <el-table-column label="Agent 编码" prop="code" min-width="150" show-overflow-tooltip />
        <el-table-column label="服务器" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="agent-server">
              <b>{{ row.name }}</b>
              <span>{{ row.host }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" prop="role" width="120" align="center" />
        <el-table-column label="在线状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status, row.online)" effect="plain">{{ statusText(row.status, row.online) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="容器数" prop="runningContainerCount" width="90" align="center" />
        <el-table-column label="CPU" width="110" align="center">
          <template #default="{ row }">{{ percentText(row.cpuUsage) }}</template>
        </el-table-column>
        <el-table-column label="内存" width="110" align="center">
          <template #default="{ row }">{{ percentText(row.memoryUsage) }}</template>
        </el-table-column>
        <el-table-column label="磁盘" width="110" align="center">
          <template #default="{ row }">{{ percentText(row.diskUsage) }}</template>
        </el-table-column>
        <el-table-column label="最后上报时间" width="180" align="center">
          <template #default="{ row }">{{ dateTimeText(row.lastHeartbeatAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="OpsAgent" lang="ts">
import { getOpsServers } from '@/api/ops';
import type { OpsServer } from '@/api/ops/types';
import { dateTimeText, percentText, statusTagType, statusText } from '@/views/ops/utils';

const loading = ref(false);
const servers = ref<OpsServer[]>([]);

const loadData = async () => {
  loading.value = true;
  try {
    servers.value = (await getOpsServers()) || [];
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

.ops-panel {
  border-radius: 8px;
}

.ops-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span,
  small {
    display: block;
  }

  span {
    color: #1f2937;
    font-weight: 600;
  }

  small {
    margin-top: 4px;
    color: #6b7280;
    font-size: 12px;
    font-weight: 400;
  }
}

.agent-server {
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
