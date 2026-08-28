<template>
  <div class="app-container ocsp-page">
    <el-card v-loading="loading" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>证书状态验证数据源</span>
          <div>
            <el-button v-hasPermi="['ocsp:source:probe']" :loading="probing" @click="probe">探测连通性</el-button>
            <el-button v-hasPermi="['ocsp:source:save']" type="primary" :loading="saving" @click="save">保存</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="probeResult"
        :title="probeResult.ok ? '探测成功' : '探测失败（仍可保存）'"
        :type="probeResult.ok ? 'success' : 'error'"
        :description="probeResult.message"
        show-icon
        :closable="false"
        class="mb16"
      />

      <el-form :model="form" label-width="150px" class="source-form">
        <el-form-item label="数据源类型">
          <el-segmented v-model="form.type" :options="['DB', 'LDAP']" />
        </el-form-item>
        <template v-if="form.type === 'DB'">
          <el-form-item label="数据库地址"><el-input v-model="form.db!.url" /></el-form-item>
          <el-form-item label="用户名"><el-input v-model="form.db!.username" /></el-form-item>
          <el-form-item label="密码引用"><el-input v-model="form.db!.passwordRef" placeholder="只保存引用，不回显明文" /></el-form-item>
          <el-form-item label="证书表"><el-input v-model="form.db!.certTable" /></el-form-item>
          <el-form-item label="序列号字段"><el-input v-model="form.db!.serialNumberColumn" /></el-form-item>
          <el-form-item label="CA 字段"><el-input v-model="form.db!.caIdColumn" /></el-form-item>
          <el-form-item label="状态字段"><el-input v-model="form.db!.statusColumn" /></el-form-item>
          <el-form-item label="吊销时间字段"><el-input v-model="form.db!.revocationTimeColumn" /></el-form-item>
          <el-form-item label="吊销原因字段"><el-input v-model="form.db!.revocationReasonColumn" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="LDAP 地址"><el-input v-model="form.ldap!.url" /></el-form-item>
          <el-form-item label="Base DN"><el-input v-model="form.ldap!.baseDn" /></el-form-item>
          <el-form-item label="Bind DN"><el-input v-model="form.ldap!.bindDn" /></el-form-item>
          <el-form-item label="密码引用"><el-input v-model="form.ldap!.passwordRef" /></el-form-item>
          <el-form-item label="搜索过滤器"><el-input v-model="form.ldap!.searchFilter" /></el-form-item>
          <el-form-item label="序列号属性"><el-input v-model="form.ldap!.serialNumberAttribute" /></el-form-item>
          <el-form-item label="CA 属性"><el-input v-model="form.ldap!.caIdAttribute" /></el-form-item>
          <el-form-item label="状态属性"><el-input v-model="form.ldap!.statusAttribute" /></el-form-item>
        </template>
      </el-form>
    </el-card>
  </div>
</template>

<script setup name="OcspSource" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getOcspStatusSource, probeOcspStatusSource, saveOcspStatusSource } from '@/api/ocsp/config';
import type { OcspProbe, OcspStatusSource } from '@/api/ocsp/types';

const loading = ref(false);
const saving = ref(false);
const probing = ref(false);
const probeResult = ref<OcspProbe | null>(null);
const form = reactive<OcspStatusSource>({
  type: 'DB',
  db: {},
  ldap: {}
});

const load = async () => {
  loading.value = true;
  try {
    const data = await getOcspStatusSource();
    form.type = data.type || 'DB';
    form.db = data.db || {};
    form.ldap = data.ldap || {};
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    await saveOcspStatusSource(form);
    ElMessage.success('已保存');
    probeResult.value = await probeOcspStatusSource();
    if (!probeResult.value.ok) {
      ElMessage.warning('已保存，但探测失败');
    }
  } finally {
    saving.value = false;
  }
};

const probe = async () => {
  probing.value = true;
  try {
    probeResult.value = await probeOcspStatusSource();
  } finally {
    probing.value = false;
  }
};

onMounted(load);
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
.source-form {
  max-width: 720px;
}
.mb16 {
  margin-bottom: 16px;
}
</style>
