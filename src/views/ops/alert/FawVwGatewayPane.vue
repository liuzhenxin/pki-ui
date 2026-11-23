<template>
  <el-form v-loading="loading || saving" label-position="top" class="gateway-form" @submit.prevent="save">
    <el-alert v-if="loadFailed" title="无法读取企业网关配置" type="error" :closable="false" show-icon />
    <el-form-item v-else label="允许的网关地址">
      <el-input
        v-model.trim="origin"
        :readonly="!editable"
        :disabled="!loaded || saving || stale"
        placeholder="https://gateway.example.test"
        maxlength="2048"
      />
      <div v-if="loaded" class="gateway-help">填写协议、主机和可选端口，企业钉钉和企业邮件共用。</div>
      <el-tag v-if="loaded && revision === null && configuredOrigin" size="small" type="info">Compose 默认值</el-tag>
    </el-form-item>
    <el-button v-if="loaded && editable" type="primary" native-type="submit" :loading="saving" :disabled="!origin || stale">保存配置</el-button>
    <el-button v-if="loadFailed || stale" :disabled="loading || saving" @click="load">刷新配置</el-button>
  </el-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getFawVwGateway, saveFawVwGateway } from '@/api/ops';
import type { FawVwGatewaySettings } from '@/api/ops/types';

const origin = ref('');
const configuredOrigin = ref<string | null>(null);
const revision = ref<string | null>(null);
const loaded = ref(false);
const editable = ref(false);
const loading = ref(false);
const saving = ref(false);
const loadFailed = ref(false);
const stale = ref(false);

function apply(data: { settings: FawVwGatewaySettings; editable: boolean }) {
  configuredOrigin.value = data.settings.origin;
  origin.value = data.settings.origin ?? '';
  revision.value = data.settings.revision;
  editable.value = data.editable;
  loaded.value = true;
  stale.value = false;
}

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    apply(await getFawVwGateway());
  } catch {
    loaded.value = false;
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!loaded.value || !editable.value || loading.value || saving.value || stale.value || !origin.value) return;
  saving.value = true;
  try {
    apply(await saveFawVwGateway({ origin: origin.value, revision: revision.value }));
    ElMessage.success('企业网关已保存并生效');
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 409) stale.value = true;
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.gateway-form {
  max-width: 640px;
}

.gateway-help {
  color: var(--el-text-color-secondary);
  width: 100%;
}
</style>
