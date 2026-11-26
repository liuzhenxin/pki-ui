<template>
  <el-table v-loading="loading" :data="rows" size="small" row-key="id" empty-text="暂无通知记录">
    <el-table-column label="渠道" width="88">
      <template #default="{ row }">{{ { email: '邮件', dingtalk: '钉钉', suppressed: '过期提醒' }[row.channel] || row.channel }}</template>
    </el-table-column>
    <el-table-column label="通知类型" width="134">
      <template #default="{ row }">{{ labels[row.category] || row.category }}</template>
    </el-table-column>
    <el-table-column label="触发方式" prop="trigger" width="90" />
    <el-table-column label="标题" prop="title" min-width="140" show-overflow-tooltip />
    <el-table-column label="收件人" prop="recipient" min-width="100" show-overflow-tooltip />
    <el-table-column label="状态" width="110">
      <template #default="{ row }"
        ><el-tag :type="row.status === 1 ? 'success' : row.status === 2 ? 'danger' : 'info'">{{ publicNoticeStatus(row.status) }}</el-tag></template
      >
    </el-table-column>
    <el-table-column label="时间" width="170">
      <template #default="{ row }">{{ row.time?.replace('T', ' ').slice(0, 19) || '-' }}</template>
    </el-table-column>
    <el-table-column label="网关追踪 ID" prop="gatewayTraceId" min-width="135" show-overflow-tooltip />
    <el-table-column label="说明" prop="message" min-width="145" show-overflow-tooltip />
    <el-table-column label="操作" width="90" align="center" fixed="right">
      <template #default="{ row }">
        <CertRowAction label="查看通知内容" icon="Document" @click="detail = row" />
        <CertRowAction v-if="!certificateId && module !== 'root'" label="查看证书详情" icon="View" @click="$emit('certificate', row.certificateId)" />
      </template>
    </el-table-column>
  </el-table>
  <el-button v-if="hasMore" :loading="loading" @click="loadMore">加载更早记录</el-button>
  <el-dialog :model-value="!!detail" title="通知详情" width="min(680px, 94vw)" append-to-body @close="detail = undefined">
    <el-descriptions v-if="detail" :column="1" border>
      <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
      <el-descriptions-item label="收件人">{{ detail.recipient || '-' }}</el-descriptions-item>
      <el-descriptions-item label="正文"
        ><div class="notice-content">{{ detail.content || '-' }}</div></el-descriptions-item
      >
      <el-descriptions-item label="发送结果">{{ publicNoticeStatus(detail.status) }} {{ detail.message }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { listBusinessDeliveryLogs, type BusinessDeliveryLog, type NoticeModule } from '@/api/ra/businessNoticeSettings';
import { publicNoticeStatus } from '@/utils/publicCertForm';
import CertRowAction from './CertRowAction.vue';

const props = defineProps<{ module: NoticeModule; certificateId?: string | number }>();
const emit = defineEmits<{ certificate: [id: string | number]; loaded: [logs: BusinessDeliveryLog[]] }>();
const rows = ref<BusinessDeliveryLog[]>([]);
const detail = ref<BusinessDeliveryLog>();
const loading = ref(false);
const hasMore = ref(false);
let requestVersion = 0;
const labels: Record<string, string> = {
  EXPIRY: '证书状态提醒',
  EXPIRY_MANUAL: '证书状态提醒',
  DEPARTURE: '员工离职提醒',
  APPROVAL_RESULT: '审批结果提醒',
  APPROVAL_PENDING: '待审批通知'
};
async function loadLogs(beforeId?: string | number) {
  const version = ++requestVersion;
  loading.value = true;
  try {
    const response = await listBusinessDeliveryLogs(props.module, props.certificateId, beforeId);
    if (version !== requestVersion) return;
    const next: BusinessDeliveryLog[] = response?.data?.data ?? response?.data ?? [];
    rows.value = beforeId == null ? next : [...rows.value, ...next];
    hasMore.value = next.length === 100;
    emit('loaded', rows.value);
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}
function loadMore() {
  const last = rows.value.at(-1);
  if (last && !loading.value) void loadLogs(last.id);
}
watch(
  () => [props.module, props.certificateId],
  () => {
    rows.value = [];
    hasMore.value = false;
    void loadLogs();
  },
  { immediate: true }
);
</script>

<style scoped>
.notice-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
