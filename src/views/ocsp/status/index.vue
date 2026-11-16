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
        <el-form-item label="签发 CA">
          <div class="w-full">
            <el-input v-if="manualEntry" v-model="form.caId" inputmode="numeric" placeholder="请输入完整 CA ID" />
            <el-select
              v-else
              v-model="form.caId"
              filterable
              clearable
              :loading="caLoading"
              :no-data-text="caLoadError ? 'CA 列表暂不可用，请手动输入 CA ID' : '暂无可选 CA'"
              placeholder="请选择签发 CA"
              class="w-full"
            >
              <el-option v-for="ca in caOptions" :key="ca.id" :value="ca.id" :label="ca.label" />
            </el-select>
            <el-button link type="primary" @click="toggleManualEntry">
              {{ manualEntry ? '从列表选择' : '手动输入 CA ID' }}
            </el-button>
          </div>
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
        :description="queryError ? '请检查输入与数据源后重试，查询失败不代表证书 UNKNOWN。' : '选择签发 CA 或输入 CA ID，再填写十六进制序列号。'"
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
import { onMounted, reactive, ref, watch } from 'vue';
import { normalizeOcspCaId } from '@/utils/ocspIdentifier';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import auth from '@/plugins/auth';
import { listOcspCaStatusSources } from '@/api/ocsp/caSource';
import { listOcspIssuerCerts } from '@/api/ocsp/issuerCert';
import { pageOcspResponders } from '@/api/ocsp/responder';
import { listServiceCaDrafts } from '@/api/ocsp/serviceCa';
import { queryOcspCertStatus } from '@/api/ocsp/status';
import type { OcspCertStatus } from '@/api/ocsp/types';

const route = useRoute();
const loading = ref(false);
const queryError = ref(false);
const result = ref<OcspCertStatus | null>(null);
const manualEntry = ref(false);
const caLoading = ref(false);
const caLoadError = ref(false);
const caOptions = ref<{ id: string; label: string }[]>([]);
const form = reactive({
  caId: '',
  serialNumber: '',
  bypassCache: false
});

const loadCaOptions = async () => {
  caLoading.value = true;
  caLoadError.value = false;
  try {
    const canReadSources = auth.hasPermi('ocsp:source');
    const sources: Promise<{ caId?: string | number }[]>[] = canReadSources ? [listServiceCaDrafts(), listOcspCaStatusSources()] : [];
    if (auth.hasPermi('ocsp:responder')) {
      sources.push(
        (async () => {
          const responders: { caId: number | string }[] = [];
          const pageSize = 100;
          for (let pageNum = 1; ; pageNum++) {
            const page = await pageOcspResponders({ pageNum, pageSize });
            responders.push(...page.records);
            if (!page.records.length || responders.length >= page.total) return responders;
          }
        })()
      );
    }
    const ids = new Set<string>();
    for (const source of await Promise.allSettled(sources)) {
      if (source.status === 'rejected') {
        caLoadError.value = true;
        continue;
      }
      for (const { caId } of source.value ?? []) {
        if (caId == null) continue;
        try {
          ids.add(normalizeOcspCaId(caId));
        } catch {
          // The API may return legacy IDs that cannot be represented safely.
        }
      }
    }
    const entries = [...ids];
    const options: typeof caOptions.value = [];
    for (let index = 0; index < entries.length; index += 8) {
      const batch = await Promise.all(
        entries.slice(index, index + 8).map(async (id) => {
          const certificates = canReadSources ? await listOcspIssuerCerts(id).catch(() => []) : [];
          const subject = certificates.find((cert) => cert.enabled !== false && cert.subjectDn)?.subjectDn;
          return { id, label: subject ? `${subject} · ${id}` : id };
        })
      );
      options.push(...batch);
    }
    caOptions.value = options;
  } finally {
    caLoading.value = false;
  }
};

const toggleManualEntry = () => {
  manualEntry.value = !manualEntry.value;
  if (!manualEntry.value && !caOptions.value.some(({ id }) => id === form.caId)) form.caId = '';
};

onMounted(loadCaOptions);

watch(
  () => route.query.caId,
  (value) => {
    if (value == null) {
      form.caId = '';
      manualEntry.value = false;
      result.value = null;
      return;
    }
    if (typeof value !== 'string') return;
    try {
      form.caId = normalizeOcspCaId(value);
      manualEntry.value = !caOptions.value.some(({ id }) => id === form.caId);
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
  if (!form.caId) {
    ElMessage.warning('请选择签发 CA 或输入 CA ID');
    return;
  }
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
