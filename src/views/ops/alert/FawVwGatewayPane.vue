<template>
  <div class="enterprise-gateway">
    <el-card shadow="never">
      <template #header><strong>共享网关配置</strong></template>
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
        <template v-if="loaded">
          <div class="gateway-help">共享凭据{{ credentialsConfigured ? '已配置' : '未配置' }}</div>
          <template v-if="editable">
            <el-form-item label="Access Key" :required="credentialsRequired">
              <el-input
                v-model="accessKey"
                type="password"
                autocomplete="new-password"
                maxlength="1024"
                :disabled="saving || stale"
                :placeholder="credentialPlaceholder"
              />
            </el-form-item>
            <el-form-item label="Secret Key" :required="credentialsRequired">
              <el-input
                v-model="secretKey"
                type="password"
                autocomplete="new-password"
                maxlength="1024"
                :disabled="saving || stale"
                :placeholder="credentialPlaceholder"
              />
            </el-form-item>
          </template>
        </template>
        <el-button v-if="loaded && editable" type="primary" native-type="submit" :loading="saving" :disabled="!origin || stale">保存配置</el-button>
        <el-button v-if="loadFailed || stale" :disabled="loading || saving" @click="load">刷新配置</el-button>
      </el-form>
    </el-card>
    <template v-if="loaded">
      <FawVwChannelPane :key="'ding-' + revision" kind="FAW_VW_DINGTALK" :editable="editable && !stale" :gateway-configured="credentialsConfigured" />
      <FawVwChannelPane :key="'mail-' + revision" kind="FAW_VW_EMAIL" :editable="editable && !stale" :gateway-configured="credentialsConfigured" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getFawVwGateway, saveFawVwGateway } from '@/api/ops';
import type { FawVwGatewaySettings } from '@/api/ops/types';
import FawVwChannelPane from './FawVwChannelPane.vue';

const origin = ref('');
const accessKey = ref('');
const secretKey = ref('');
const credentialsConfigured = ref(false);
const configuredOrigin = ref<string | null>(null);
const revision = ref<string | null>(null);
const loaded = ref(false);
const editable = ref(false);
const loading = ref(false);
const saving = ref(false);
const loadFailed = ref(false);
const stale = ref(false);
const credentialsRequired = computed(() => credentialsConfigured.value && origin.value !== configuredOrigin.value);
const credentialPlaceholder = computed(() =>
  credentialsConfigured.value && !credentialsRequired.value ? '已配置，成对输入可更新' : '填写企业网关共享凭据'
);

function apply(data: { settings: FawVwGatewaySettings; editable: boolean }) {
  configuredOrigin.value = data.settings.origin;
  origin.value = data.settings.origin ?? '';
  revision.value = data.settings.revision;
  credentialsConfigured.value = data.settings.credentialsConfigured;
  accessKey.value = '';
  secretKey.value = '';
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
  if (!!accessKey.value !== !!secretKey.value || (credentialsRequired.value && !accessKey.value)) {
    ElMessage.warning('请同时填写 Access Key 和 Secret Key');
    return;
  }
  saving.value = true;
  try {
    apply(
      await saveFawVwGateway({
        origin: origin.value,
        revision: revision.value,
        accessKey: accessKey.value || undefined,
        secretKey: secretKey.value || undefined
      })
    );
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
.enterprise-gateway {
  display: grid;
  gap: 16px;
}

.gateway-form {
  max-width: 640px;
}

.gateway-help {
  color: var(--el-text-color-secondary);
  width: 100%;
}
</style>
