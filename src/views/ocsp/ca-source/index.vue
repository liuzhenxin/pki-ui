<template>
  <div class="app-container ocsp-page">
    <OcspPageHeader title="按 CA 配置" description="登记 CA 签发者证书，配置并启用专属证书状态来源。"
      ><el-button icon="Refresh" @click="refresh">刷新</el-button
      ><el-button v-hasPermi="['ocsp:source:save']" type="primary" icon="Plus" @click="openWizard()">添加服务 CA</el-button></OcspPageHeader
    >

    <el-tabs v-model="activeTab"
      ><el-tab-pane label="服务 CA" name="serviceCas">
        <el-card shadow="never">
          <el-table v-loading="managedLoading" :data="managedRows" border>
            <template #empty>
              <OcspEmptyState
                v-if="!managedLoading"
                :error="managedError"
                :title="managedError ? '服务 CA 读取失败' : '暂无服务 CA'"
                :description="managedError ? '请重新加载配置。' : '添加服务 CA 后，先验证草稿，再启用。'"
              >
                <el-button v-if="managedError" @click="getManaged">重新加载</el-button>
              </OcspEmptyState>
            </template>
            <el-table-column prop="caId" label="CA ID" min-width="190" />
            <el-table-column prop="responderId" label="草稿响应者 ID" min-width="190" />
            <el-table-column label="草稿来源" width="110"
              ><template #default="{ row }">{{ row.sourceType || '-' }}</template></el-table-column
            >
            <el-table-column prop="version" label="草稿版本" width="110" />
            <el-table-column label="已启用版本" width="120"
              ><template #default="{ row }">{{ row.publishedVersion ?? '-' }}</template></el-table-column
            >
            <el-table-column label="状态" min-width="150"
              ><template #default="{ row }"
                ><el-tag :type="managedTag(row)">{{ managedStatus(row) }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="操作" width="130" fixed="right"
              ><template #default="{ row }"
                ><el-button v-hasPermi="['ocsp:source:save']" link type="primary" @click="openWizard(row.caId)">查看 / 继续</el-button></template
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
import { onMounted, ref } from 'vue';
import OcspPageHeader from '@/views/ocsp/components/OcspPageHeader.vue';
import OcspEmptyState from '@/views/ocsp/components/OcspEmptyState.vue';
import RoutingHistoryPanel from '@/views/ocsp/components/RoutingHistoryPanel.vue';
import IssuerCertPanel from '@/views/ocsp/components/IssuerCertPanel.vue';
import ServiceCaWizard from '@/views/ocsp/components/ServiceCaWizard.vue';
import { listServiceCaDrafts } from '@/api/ocsp/serviceCa';
import type { ServiceCaDraft } from '@/api/ocsp/serviceCa';

const activeTab = ref('serviceCas');
const wizardVisible = ref(false);
const wizardCaId = ref('');
const managedLoading = ref(false);
const managedError = ref(false);
const managedRows = ref<ServiceCaDraft[]>([]);

const managedStatus = (item: ServiceCaDraft) => {
  if (item.publishedVersion != null && String(item.publishedVersion) === String(item.version)) return '已启用';
  if (item.verifiedVersion != null && String(item.verifiedVersion) === String(item.version)) return '已验证，待启用';
  return item.publishedVersion != null ? '已启用，有未发布草稿' : '草稿待配置';
};
const managedTag = (item: ServiceCaDraft) => (managedStatus(item) === '已启用' ? 'success' : 'warning');
const openWizard = (caId = '') => {
  wizardCaId.value = caId;
  wizardVisible.value = true;
};
const getManaged = async () => {
  managedLoading.value = true;
  managedError.value = false;
  try {
    managedRows.value = (await listServiceCaDrafts()) || [];
  } catch {
    managedRows.value = [];
    managedError.value = true;
  } finally {
    managedLoading.value = false;
  }
};
const refresh = () => getManaged();
onMounted(refresh);
</script>

<style scoped>
.ocsp-page {
  padding: 24px;
}
@media (max-width: 760px) {
  .ocsp-page {
    padding: 12px;
  }
}
</style>
