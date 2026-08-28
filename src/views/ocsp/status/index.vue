<template>
  <div class="app-container ocsp-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>证书状态诊断</span>
          <el-tag type="info" effect="plain">不签名 OCSP，不写请求日志</el-tag>
        </div>
      </template>
      <el-form :model="form" label-width="120px" class="query-form">
        <el-form-item label="CA ID">
          <el-input-number v-model="form.caId" :min="1" controls-position="right" class="w-full" />
        </el-form-item>
        <el-form-item label="证书序列号">
          <el-input v-model="form.serialNumber" placeholder="十六进制，大小写不敏感" @keyup.enter="queryStatus" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.bypassCache">绕过缓存</el-checkbox>
          <el-button type="primary" class="ml8" :loading="loading" @click="queryStatus">查询</el-button>
        </el-form-item>
      </el-form>

      <el-empty v-if="!result" description="输入 CA ID 和序列号后查询" />
      <el-descriptions v-else :column="2" border>
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
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { queryOcspCertStatus } from '@/api/ocsp/status';
import type { OcspCertStatus } from '@/api/ocsp/types';

const loading = ref(false);
const result = ref<OcspCertStatus | null>(null);
const form = reactive({
  caId: 1,
  serialNumber: '',
  bypassCache: false
});

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
  loading.value = true;
  try {
    result.value = await queryOcspCertStatus({
      caId: form.caId,
      serialNumber: form.serialNumber.trim(),
      bypassCache: form.bypassCache
    });
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.ocsp-page {
  padding: 16px;
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
