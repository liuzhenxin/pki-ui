<template>
  <div class="ops-page">
    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <div>
            <span>服务器监控</span>
            <small>按已部署 Agent 的上报结果动态展示</small>
          </div>
          <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="servers" border row-key="code" class="server-table">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="server-detail">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="服务器编码">{{ row.code }}</el-descriptions-item>
                <el-descriptions-item label="服务器角色">{{ row.role || '-' }}</el-descriptions-item>
                <el-descriptions-item label="最后心跳">{{ dateTimeText(row.lastHeartbeatAt) }}</el-descriptions-item>
                <el-descriptions-item label="CPU">{{ percentText(row.cpuUsage) }}</el-descriptions-item>
                <el-descriptions-item label="内存">{{ percentText(row.memoryUsage) }}</el-descriptions-item>
                <el-descriptions-item label="磁盘">{{ percentText(row.diskUsage) }}</el-descriptions-item>
              </el-descriptions>

              <el-table :data="row.containers || []" size="small" border class="container-inner-table">
                <el-table-column label="容器名称" prop="name" min-width="170" show-overflow-tooltip />
                <el-table-column label="镜像" prop="image" min-width="180" show-overflow-tooltip />
                <el-table-column label="状态" width="100" align="center">
                  <template #default="scope">
                    <el-tag :type="statusTagType(scope.row.state, scope.row.running, scope.row.present)" effect="plain">
                      {{ statusText(scope.row.state, scope.row.running, scope.row.present) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="端口" prop="ports" min-width="220" show-overflow-tooltip />
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="服务器" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="server-main">
              <b>{{ row.name }}</b>
              <span>{{ row.host }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Agent" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status, row.online)" effect="plain">{{ statusText(row.status, row.online) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="CPU" width="160">
          <template #default="{ row }">
            <el-progress :percentage="safePercent(row.cpuUsage)" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="内存" width="160">
          <template #default="{ row }">
            <el-progress :percentage="safePercent(row.memoryUsage)" :stroke-width="8" :status="row.memoryUsage > 90 ? 'exception' : undefined" />
          </template>
        </el-table-column>
        <el-table-column label="磁盘" width="160">
          <template #default="{ row }">
            <el-progress :percentage="safePercent(row.diskUsage)" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="负载" prop="loadAverage" width="100" align="center" />
        <el-table-column label="运行容器" prop="runningContainerCount" width="100" align="center" />
        <el-table-column label="最后心跳" width="170" align="center">
          <template #default="{ row }">{{ dateTimeText(row.lastHeartbeatAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="OpsServer" lang="ts">
import { getOpsServers } from '@/api/ops';
import type { OpsServer } from '@/api/ops/types';
import { dateTimeText, percentText, statusTagType, statusText } from '@/views/ops/utils';

const loading = ref(false);
const servers = ref<OpsServer[]>([]);

const safePercent = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
};

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

.server-main {
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

.server-detail {
  padding: 12px 18px;
  background: #f9fafb;
}

.container-inner-table {
  margin-top: 12px;
}
</style>
