<template>
  <el-card shadow="never">
    <template #header>
      <div class="detail-header">
        <div>
          <h2>{{ value.alias }}</h2>
          <span class="muted">密钥详情</span>
        </div>
        <el-tag :type="value.state === 'ENABLED' ? 'success' : 'info'">{{ keyStateLabels[value.state] || value.state }}</el-tag>
      </div>
    </template>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="密钥 ID"
        ><span class="identifier">{{ value.keyId }}</span></el-descriptions-item
      >
      <el-descriptions-item label="ARN"
        ><span class="identifier">{{ value.arn }}</span></el-descriptions-item
      >
      <el-descriptions-item label="算法">{{ value.algorithm === 'SM4_128' ? 'SM4（128 位）' : 'AES（256 位）' }}</el-descriptions-item>
      <el-descriptions-item label="用途">加密 / 解密</el-descriptions-item>
      <el-descriptions-item label="当前版本">v{{ value.currentVersion }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ value.createdAt }}</el-descriptions-item>
      <el-descriptions-item label="计划删除时间">{{ value.pendingDeletionAt || '—' }}</el-descriptions-item>
    </el-descriptions>
    <div class="actions">
      <el-button
        v-for="action in availableActions"
        :key="action"
        :type="action === 'schedule-deletion' ? 'danger' : 'default'"
        :disabled="busy"
        @click="$emit('action', action)"
        >{{ actionLabels[action] }}</el-button
      >
      <el-button v-if="can('kms:key:detail')" :disabled="busy" @click="$emit('refresh')">刷新详情</el-button>
    </div>
    <h3>密钥版本</h3>
    <el-table :data="value.versions" border empty-text="暂无版本信息" class="version-table">
      <el-table-column label="版本" width="85"
        ><template #default="{ row }">v{{ row.version }}</template></el-table-column
      >
      <el-table-column label="状态" min-width="110"
        ><template #default="{ row }">{{ versionLabels[row.state] || row.state }}</template></el-table-column
      >
      <el-table-column prop="provider" label="Provider" min-width="100" />
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column prop="retiredAt" label="退役时间" min-width="170" />
      <el-table-column prop="destroyedAt" label="销毁时间" min-width="170" />
    </el-table>
  </el-card>
</template>
<script setup lang="ts" name="KmsKeyDetail">
import { computed } from 'vue';
import auth from '@/plugins/auth';
import type { KeyAction, KeyDetail } from '@/api/kms/types';
import { actionLabels, canRunAction, keyStateLabels } from '@/utils/kms';
const props = defineProps<{ value: KeyDetail; busy: boolean }>();
defineEmits<{ action: [action: KeyAction]; refresh: [] }>();
const can = auth.hasPermi;
const availableActions = computed(() =>
  (Object.keys(actionLabels) as KeyAction[]).filter((action) => can(`kms:key:${action}`) && canRunAction(props.value.state, action))
);
const versionLabels: Record<string, string> = { PRE_ACTIVE: '待激活', ACTIVE: '使用中', RETIRED: '已退役', DESTROYED: '已销毁' };
</script>
<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  margin: 0 0 6px;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.identifier {
  font-family: monospace;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
}
.actions .el-button {
  margin-left: 0;
}
:deep(.el-descriptions__label) {
  min-width: 90px;
  white-space: nowrap;
}
.version-table {
  width: 100%;
}
</style>
