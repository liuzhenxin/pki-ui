<template>
  <div v-loading="loading">
    <div class="expiry-toolbar">
      <el-radio-group v-model="closed" @change="changeStatus">
        <el-radio-button :value="false">待到期</el-radio-button>
        <el-radio-button :value="true">已结束</el-radio-button>
      </el-radio-group>
      <el-button :disabled="loading" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="failed" title="证书到期提醒加载失败，请刷新重试" type="error" :closable="false" show-icon />
    <template v-else>
      <el-table :data="items" empty-text="暂无证书到期提醒">
        <el-table-column prop="sourceId" label="RA 来源" min-width="115" show-overflow-tooltip />
        <el-table-column prop="certId" label="证书 ID" min-width="150" show-overflow-tooltip />
        <el-table-column label="到期时间" min-width="170">
          <template #default="{ row }">{{ dateTimeText(row.expiresAt) }}</template>
        </el-table-column>
        <el-table-column label="提醒节点" width="110">
          <template #default="{ row }">{{ row.stageDays }} 天</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">{{ labels[row.status as RaCertificateExpiry['status']] }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170">
          <template #default="{ row }">{{ dateTimeText(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { getRaCertificateExpiry } from '@/api/ops';
import type { RaCertificateExpiry } from '@/api/ops/types';
import { dateTimeText } from '@/views/ops/utils';

const labels: Record<RaCertificateExpiry['status'], string> = {
  OPEN: '待续期',
  RENEWED: '已续期',
  REVOKED: '已吊销',
  EXPIRED: '已到期',
  REPLACED: '期限已更新',
  REMOVED: '已移除'
};
const closed = ref(false);
const loading = ref(false);
const failed = ref(false);
const items = ref<RaCertificateExpiry[]>([]);
const page = ref(1);
const pageSize = 50;
const total = ref(0);
let requestVersion = 0;

async function load() {
  const version = ++requestVersion;
  loading.value = true;
  failed.value = false;
  try {
    const result = await getRaCertificateExpiry(closed.value, (page.value - 1) * pageSize, pageSize);
    if (version === requestVersion) {
      items.value = result.items;
      total.value = result.total;
    }
  } catch {
    if (version === requestVersion) failed.value = true;
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

async function changeStatus() {
  page.value = 1;
  await load();
}

onMounted(load);
</script>

<style scoped>
.expiry-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
</style>
