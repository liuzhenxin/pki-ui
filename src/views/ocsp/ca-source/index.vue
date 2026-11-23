<template>
  <div class="app-container ocsp-page">
    <OcspPageHeader title="按 CA 配置" description="为签发 CA 关联响应者和证书状态来源。" />

    <el-tabs v-model="activeTab"
      ><el-tab-pane label="服务 CA" name="serviceCas">
        <el-card shadow="never">
          <div class="ca-toolbar">
            <el-input v-model="caSearch" aria-label="搜索服务 CA" placeholder="按 CA 名称、CA ID 或响应者 ID 搜索" clearable class="ca-search" />
            <el-select v-model="progressFilter" aria-label="按草稿进度筛选" class="ca-progress-filter">
              <el-option label="全部草稿进度" value="all" />
              <el-option v-for="(progress, value) in draftProgress" :key="value" :label="progress.label" :value="value" />
            </el-select>
            <div class="ca-toolbar-actions">
              <el-button icon="Refresh" :loading="managedLoading" @click="refresh">刷新列表</el-button>
              <el-button v-hasPermi="['ocsp:source:save']" type="primary" icon="Plus" @click="openWizard()">添加服务 CA</el-button>
            </div>
          </div>
          <el-table v-loading="managedLoading" :data="filteredRows" border>
            <template #empty>
              <OcspEmptyState
                v-if="!managedLoading"
                :error="managedError"
                :title="managedError ? '服务 CA 读取失败' : managedRows.length ? '未找到匹配的服务 CA' : '暂无服务 CA'"
                :description="
                  managedError ? '请重新加载配置。' : managedRows.length ? '请调整搜索条件或草稿进度。' : '添加服务 CA 后，先验证草稿，再启用。'
                "
              >
                <el-button v-if="managedError" @click="getManaged">重新加载</el-button>
              </OcspEmptyState>
            </template>
            <el-table-column label="签发 CA" min-width="230">
              <template #default="{ row }">
                <div>{{ caNames[row.caId] || '名称不可用' }}</div>
                <div class="ca-id">{{ row.caId }}</div>
              </template>
            </el-table-column>
            <el-table-column label="当前生效版本" min-width="130">
              <template #default="{ row }">
                <el-tag v-if="row.publishedVersion != null" type="success">版本 {{ row.publishedVersion }}</el-tag>
                <span v-else class="ca-detail">未启用</span>
              </template>
            </el-table-column>
            <el-table-column label="草稿进度" min-width="150">
              <template #default="{ row }">
                <el-tag :type="draftProgress[draftState(row)].type">{{ draftProgress[draftState(row)].label }}</el-tag>
                <div class="ca-detail">版本 {{ row.version }}</div>
              </template>
            </el-table-column>
            <el-table-column label="草稿响应者 ID" min-width="180">
              <template #default="{ row }">{{ row.responderId ?? '未关联' }}</template>
            </el-table-column>
            <el-table-column label="草稿来源" width="110">
              <template #default="{ row }">{{ row.sourceType === 'DB' ? '数据库' : row.sourceType || '未配置' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right"
              ><template #default="{ row }"
                ><el-button v-hasPermi="['ocsp:source:save']" link type="primary" @click="openWizard(row.caId)">{{
                  managedAction(row)
                }}</el-button></template
              ></el-table-column
            >
          </el-table>
        </el-card> </el-tab-pane
      ><el-tab-pane label="签发者证书" name="issuers" lazy><IssuerCertPanel v-if="activeTab === 'issuers'" /></el-tab-pane
      ><el-tab-pane label="路由与配置历史" name="history" lazy><RoutingHistoryPanel v-if="activeTab === 'history'" /></el-tab-pane
    ></el-tabs>
    <ServiceCaWizard v-model="wizardVisible" :initial-ca-id="wizardCaId" @saved="getManaged" />
  </div>
</template>

<script setup name="OcspCaSource" lang="ts">
import { computed, onMounted, ref } from 'vue';
import OcspPageHeader from '@/views/ocsp/components/OcspPageHeader.vue';
import OcspEmptyState from '@/views/ocsp/components/OcspEmptyState.vue';
import RoutingHistoryPanel from '@/views/ocsp/components/RoutingHistoryPanel.vue';
import IssuerCertPanel from '@/views/ocsp/components/IssuerCertPanel.vue';
import ServiceCaWizard from '@/views/ocsp/components/ServiceCaWizard.vue';
import auth from '@/plugins/auth';
import { summarizeOcspCertificate } from '@/utils/ocspPresentation';
import { listServiceCaDrafts } from '@/api/ocsp/serviceCa';
import type { ServiceCaDraft } from '@/api/ocsp/serviceCa';

const activeTab = ref('serviceCas');
const wizardVisible = ref(false);
const wizardCaId = ref('');
const managedLoading = ref(false);
const managedError = ref(false);
const managedRows = ref<ServiceCaDraft[]>([]);

const caSearch = ref('');
const draftProgress = {
  configure: { label: '待配置', type: 'warning' },
  validate: { label: '待验证', type: 'warning' },
  publish: { label: '已验证，待启用', type: 'success' },
  published: { label: '与生效版本一致', type: 'info' }
} as const;
type DraftState = keyof typeof draftProgress;
const progressFilter = ref<DraftState | 'all'>('all');
const caNames = ref<Record<string, string>>({});

const draftState = (item: ServiceCaDraft): DraftState => {
  if (item.publishedVersion != null && String(item.publishedVersion) === String(item.version)) return 'published';
  if (item.verifiedVersion != null && String(item.verifiedVersion) === String(item.version)) return 'publish';
  return item.sourceConfigured && item.sampleConfigured ? 'validate' : 'configure';
};

const filteredRows = computed(() => {
  const query = caSearch.value.trim().toLowerCase();
  return managedRows.value.filter(
    (row) =>
      (progressFilter.value === 'all' || draftState(row) === progressFilter.value) &&
      [String(row.caId), caNames.value[row.caId] ?? '', String(row.responderId ?? '')].some((value) => value.toLowerCase().includes(query))
  );
});

const managedAction = (item: ServiceCaDraft) => {
  const state = draftState(item);
  if (state === 'published') return '查看配置';
  if (state === 'publish') return auth.hasPermi('ocsp:source:probe') ? '启用已验证草稿' : '查看草稿';
  if (state === 'validate') return auth.hasPermi('ocsp:source:probe') ? '验证草稿' : '查看草稿';
  return '继续配置';
};
const openWizard = (caId = '') => {
  wizardCaId.value = caId;
  wizardVisible.value = true;
};
const getManaged = async () => {
  if (managedLoading.value) return;
  managedLoading.value = true;
  managedError.value = false;
  try {
    const rows = (await listServiceCaDrafts()) || [];
    caNames.value = Object.fromEntries(
      rows.map(({ caId, issuerPem }) => {
        const { subject } = summarizeOcspCertificate(issuerPem ?? undefined);
        return [caId, subject === '-' ? '' : subject];
      })
    );
    managedRows.value = rows;
  } catch {
    managedRows.value = [];
    caNames.value = {};
    managedError.value = true;
  } finally {
    managedLoading.value = false;
  }
};
const refresh = () => getManaged();
onMounted(refresh);
</script>

<style scoped>
.ca-toolbar,
.ca-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.ca-toolbar {
  margin-bottom: 12px;
}
.ca-toolbar-actions {
  margin-inline-start: auto;
}
.ca-toolbar-actions :deep(.el-button + .el-button) {
  margin-inline-start: 0;
}
.ca-search {
  width: min(100%, 335px);
}
.ca-progress-filter {
  width: min(100%, 180px);
}
.ca-detail,
.ca-id {
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.ocsp-page {
  padding: 24px;
}
@media (max-width: 760px) {
  .ca-toolbar-actions {
    margin-inline-start: 0;
  }
  .ocsp-page {
    padding: 12px;
  }
}
</style>
