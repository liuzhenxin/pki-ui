<template>
  <el-card shadow="hover" class="panel">
    <template #header
      ><div class="header"><b>路由预览与配置历史</b><el-tag type="info">只读诊断，不切换权威</el-tag></div></template
    >
    <el-tabs>
      <el-tab-pane label="路由预览">
        <el-form :inline="true" :model="previewForm">
          <el-form-item label="CA ID"><el-input-number v-model="previewForm.caId" :min="1" /></el-form-item>
          <el-form-item label="客户端 IP（可选）"><el-input v-model="previewForm.clientIp" placeholder="用于 Canary 范围预览" /></el-form-item>
          <el-form-item
            ><el-button v-hasPermi="['ocsp:source:probe']" type="primary" :loading="previewing" @click="preview">预览</el-button></el-form-item
          >
        </el-form>
        <el-descriptions v-if="previewResult" :column="3" border>
          <el-descriptions-item label="权威模式">{{ previewResult.authorityMode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="数据源">{{ previewResult.sourceType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="数据源版本">{{ previewResult.sourceRevision || '-' }}</el-descriptions-item>
          <el-descriptions-item label="响应者">{{ previewResult.responderName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="签名算法">{{ previewResult.algorithm || '-' }}</el-descriptions-item>
          <el-descriptions-item label="可激活"
            ><el-tag :type="previewResult.wouldActivate ? 'success' : 'danger'">{{
              previewResult.wouldActivate ? '是' : '否'
            }}</el-tag></el-descriptions-item
          >
          <el-descriptions-item label="安全结果" :span="3">{{
            previewResult.safeMessage || previewResult.rejectionCode || '-'
          }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="输入 CA ID 后执行只读预览" />
      </el-tab-pane>
      <el-tab-pane label="配置历史">
        <div class="toolbar">
          <el-input v-model="historyQry.targetKey" clearable placeholder="目标标识" class="filter" /><el-button @click="loadHistory">查询</el-button>
        </div>
        <el-table v-loading="historyLoading" :data="historyRows" border>
          <el-table-column prop="createTime" label="时间" width="170" />
          <el-table-column prop="targetType" label="类型" width="150" />
          <el-table-column prop="targetKey" label="目标" min-width="160" show-overflow-tooltip />
          <el-table-column prop="action" label="动作" width="100" />
          <el-table-column prop="revision" label="版本" width="80" />
          <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="80"
            ><template #default="{ row }"><el-button link type="primary" @click="detail(row.id)">详情</el-button></template></el-table-column
          >
        </el-table>
        <pagination
          v-show="historyTotal > 0"
          v-model:page="historyQry.pageNum"
          v-model:limit="historyQry.pageSize"
          :total="historyTotal"
          @pagination="loadHistory"
        />
      </el-tab-pane>
    </el-tabs>
    <el-drawer v-model="detailVisible" title="脱敏配置历史" size="720px">
      <el-descriptions v-if="selected" :column="2" border
        ><el-descriptions-item label="目标">{{ selected.targetKey }}</el-descriptions-item
        ><el-descriptions-item label="版本">{{ selected.revision }}</el-descriptions-item
        ><el-descriptions-item label="回滚自">{{ selected.rollbackOf || '-' }}</el-descriptions-item
        ><el-descriptions-item label="被回滚记录">{{ selected.rolledBackBy?.join(', ') || '-' }}</el-descriptions-item></el-descriptions
      >
      <h4>变更前</h4>
      <pre class="safe-json">{{ formatSafe(selected?.beforeJson) }}</pre>
      <h4>变更后</h4>
      <pre class="safe-json">{{ formatSafe(selected?.afterJson) }}</pre>
      <h4>验证证据</h4>
      <pre class="safe-json">{{ formatSafe(selected?.validationEvidence) }}</pre>
    </el-drawer>
  </el-card>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getOcspConfigHistory, pageOcspConfigHistory, previewOcspRouting } from '@/api/ocsp/operations';
import type { OcspConfigHistory, OcspConfigHistoryQry, OcspRoutingPreview } from '@/api/ocsp/types';
const previewForm = reactive({ caId: undefined as number | undefined, clientIp: '' });
const previewing = ref(false);
const previewResult = ref<OcspRoutingPreview>();
const historyLoading = ref(false);
const historyRows = ref<OcspConfigHistory[]>([]);
const historyTotal = ref(0);
const historyQry = reactive<OcspConfigHistoryQry>({ pageNum: 1, pageSize: 20, targetKey: '' });
const detailVisible = ref(false);
const selected = ref<OcspConfigHistory>();
const preview = async () => {
  if (!previewForm.caId) return ElMessage.warning('请输入 CA ID');
  previewing.value = true;
  try {
    previewResult.value = await previewOcspRouting({ caId: previewForm.caId, clientIp: previewForm.clientIp || undefined });
  } finally {
    previewing.value = false;
  }
};
const loadHistory = async () => {
  historyLoading.value = true;
  try {
    const page = await pageOcspConfigHistory(historyQry);
    historyRows.value = page.records || [];
    historyTotal.value = page.total || 0;
  } finally {
    historyLoading.value = false;
  }
};
const detail = async (id: number) => {
  selected.value = await getOcspConfigHistory(id);
  detailVisible.value = true;
};
const formatSafe = (value?: string) => {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};
loadHistory();
</script>
<style scoped>
.panel {
  margin-bottom: 16px;
}
.header,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filter {
  max-width: 260px;
}
.safe-json {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  max-height: 320px;
  overflow: auto;
}
</style>
