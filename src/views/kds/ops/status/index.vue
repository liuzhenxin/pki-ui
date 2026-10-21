<template>
  <div class="kds-ops-status">
    <el-card v-loading="loading">
      <template #header><span>KDS 运营状态</span></template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />
      <el-alert
        v-if="status?.maintenance"
        type="warning"
        :closable="false"
        show-icon
        title="服务处于维护模式：仅恢复类与只读运营接口可用。"
        class="mb"
      />
      <el-alert
        v-if="status?.destroyed"
        type="error"
        :closable="false"
        show-icon
        title="服务已进入销毁后安全态：除销毁重试与状态查询外一律拒绝。"
        class="mb"
      />

      <el-descriptions v-if="status" :column="3" border class="mb">
        <el-descriptions-item label="实例标识">{{ status.instanceId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维护模式">{{ status.maintenance ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="销毁态">{{ status.destroyed ? '是' : '否' }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="status" class="section">
        <div class="section-title">依赖健康</div>
        <el-space wrap>
          <el-tag v-for="(state, name) in status.dependencies" :key="name" :type="state === 'UP' ? 'success' : state === 'DOWN' ? 'danger' : 'info'">
            {{ name }}: {{ state }}
          </el-tag>
          <span v-if="Object.keys(status.dependencies).length === 0" class="empty">无依赖数据</span>
        </el-space>
      </div>

      <div v-if="status" class="section">
        <div class="section-title">集群节点</div>
        <el-table :data="status.nodes" border size="small">
          <el-table-column prop="instanceId" label="实例" min-width="160" />
          <el-table-column prop="version" label="版本" width="120" />
          <el-table-column prop="role" label="角色" width="100" />
          <el-table-column prop="lastSeen" label="最近心跳" min-width="180" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.stale ? 'warning' : 'success'">{{ row.stale ? 'stale' : 'ok' }}</el-tag>
            </template>
          </el-table-column>
          <template #empty>暂无节点心跳</template>
        </el-table>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getOpsStatus } from '@/api/kds/ops';
import { toKdsError } from '@/api/kds/client';
import type { OpsStatus } from '@/types/kds';

const status = ref<OpsStatus>();
const loading = ref(false);
const error = ref('');

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    status.value = await getOpsStatus();
  } catch (e) {
    error.value = toKdsError(e).message;
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
</script>
<style scoped>
.kds-ops-status {
  padding: 20px;
}
.mb {
  margin-bottom: 12px;
}
.section {
  margin-top: 16px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.empty {
  color: var(--el-text-color-secondary);
}
</style>
