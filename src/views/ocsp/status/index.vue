<template>
  <div class="app-container ocsp-page">
    <OcspPageHeader title="诊断工具" description="查询证书状态与缓存命中情况，帮助定位状态来源问题。" />
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>证书状态诊断</span>
          <el-tag type="info" effect="plain">不签名 OCSP，不写请求日志</el-tag>
        </div>
      </template>
      <el-form :model="form" label-width="120px" v-loading="loading" class="query-form">
        <el-form-item label="CA ID">
          <el-input v-model="form.caId" inputmode="numeric" placeholder="完整 CA ID" class="w-full" />
        </el-form-item>
        <el-form-item label="证书序列号">
          <el-input v-model="form.serialNumber" placeholder="十六进制，大小写不敏感" @keyup.enter="queryStatus" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.bypassCache">绕过缓存</el-checkbox>
          <el-button type="primary" class="ml8" :loading="loading" @click="queryStatus">查询</el-button>
        </el-form-item>
      </el-form>

      <OcspEmptyState
        v-if="!result && !loading"
        :error="queryError"
        :title="queryError ? '证书状态查询失败' : '准备查询证书状态'"
        :description="queryError ? '请检查输入与数据源后重试，查询失败不代表证书 UNKNOWN。' : '输入完整 CA ID 和十六进制序列号后，点击查询。'"
      />
      <el-descriptions v-else-if="result" :column="2" border>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(result.status)">{{ result.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="数据源">{{ result.sourceType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="是否命中缓存">{{ result.cacheHit ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ result.serialNumber }}</el-descriptions-item>
        <el-descriptions-item label="notBefore">{{ result.notBefore || '-' }}</el-descriptions-item>
        <el-descriptions-item label="notAfter">{{ result.notAfter || '-' }}</el-descriptions-item>
        <el-descriptions-item label="吊销时间">{{ result.revocationTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="吊销原因">{{ result.revocationReason ?? '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup name="OcspStatus" lang="ts">
import OcspPageHeader from '@/views/ocsp/components/OcspPageHeader.vue';
import OcspEmptyState from '@/views/ocsp/components/OcspEmptyState.vue';
import { reactive, ref, watch } from 'vue';
import { normalizeOcspCaId } from '@/utils/ocspIdentifier';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { queryOcspCertStatus } from '@/api/ocsp/status';
import type { OcspCertStatus } from '@/api/ocsp/types';

const route = useRoute();
const loading = ref(false);
const queryError = ref(false);
const result = ref<OcspCertStatus | null>(null);
const form = reactive({
  caId: '1',
  serialNumber: '',
  bypassCache: false
});

watch(
  () => route.query.caId,
  (value) => {
    if (typeof value !== 'string') return;
    try {
      form.caId = normalizeOcspCaId(value);
      result.value = null;
    } catch {
      ElMessage.warning('CA ID 必须为有效的正整数');
    }
  },
  { immediate: true }
);

const statusType = (status?: string) => {
  if (status === 'GOOD') return 'success';
  if (status === 'REVOKED') return 'danger';
  return 'warning';
};

const queryStatus = async () => {
  if (!form.serialNumber.trim()) {
    ElMessage.warning('请输入证书序列号');
    return;
  }
  try {
    form.caId = normalizeOcspCaId(form.caId);
  } catch {
    ElMessage.warning('CA ID 必须为有效的正整数');
    return;
  }
  result.value = null;
  queryError.value = false;
  loading.value = true;
  try {
    result.value = await queryOcspCertStatus({
      caId: form.caId,
      serialNumber: form.serialNumber.trim(),
      bypassCache: form.bypassCache
    });
  } catch {
    queryError.value = true;
  } finally {
    loading.value = false;
  }
};
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
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.query-form {
  max-width: 640px;
}
.w-full {
  width: 100%;
}
.ml8 {
  margin-left: 8px;
}
</style>
