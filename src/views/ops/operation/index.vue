<template>
  <div class="ops-page">
    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <div>
            <span>运维操作</span>
            <small>写操作待后端白名单、二次确认和审计闭环开放</small>
          </div>
          <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新采集</el-button>
        </div>
      </template>

      <el-alert title="容器启动、停止、重启暂未开放执行，仅展示当前可操作对象。" type="warning" show-icon :closable="false" class="operation-alert" />

      <el-table v-loading="loading" :data="containers" border>
        <el-table-column label="容器名称" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column label="所在服务器" prop="serverName" min-width="160" show-overflow-tooltip />
        <el-table-column label="镜像" prop="image" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.state, row.running, row.present)" effect="plain">
              {{ statusText(row.state, row.running, row.present) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default>
            <el-button link type="primary" icon="RefreshRight" disabled>重启</el-button>
            <el-button link type="success" icon="VideoPlay" disabled>启动</el-button>
            <el-button link type="danger" icon="VideoPause" disabled>停止</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="OpsOperation" lang="ts">
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

.operation-alert {
  margin-bottom: 12px;
}
</style>
