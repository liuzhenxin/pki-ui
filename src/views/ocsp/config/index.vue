<template>
  <div class="app-container ocsp-page">
    <el-card v-loading="loading" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>运行参数</span>
          <div>
            <el-button v-hasPermi="['ocsp:config:cache-clear']" @click="clearCache">清空状态缓存</el-button>
            <el-button v-hasPermi="['ocsp:config:save']" type="primary" :loading="saving" @click="save">保存</el-button>
          </div>
        </div>
      </template>

      <el-form :model="form" label-width="180px" class="config-form">
        <el-form-item label="状态缓存">
          <el-switch v-model="form.cacheEnabled" />
        </el-form-item>
        <el-form-item label="状态缓存 TTL(秒)">
          <el-input-number v-model="form.ttlSeconds" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="响应者缓存 TTL(秒)">
          <el-input-number v-model="form.responderTtlSeconds" :min="1" controls-position="right" />
        </el-form-item>
        <el-divider content-position="left">已签名响应缓存（默认关闭）</el-divider>
        <el-alert title="仅缓存无 Nonce、单条目且满足安全策略的响应；Canary 和协商请求会绕过。" type="info" :closable="false" class="mb16" />
        <el-form-item label="响应缓存"><el-switch v-model="form.responseCacheEnabled" /></el-form-item>
        <el-form-item label="响应缓存 TTL(秒)"
          ><el-input-number v-model="form.responseCacheTtlSeconds" :min="1" controls-position="right"
        /></el-form-item>
        <el-form-item label="响应缓存最大条目"
          ><el-input-number v-model="form.responseCacheMaximumSize" :min="100" :step="100" controls-position="right"
        /></el-form-item>
        <el-descriptions v-if="cacheStatus" :column="4" border class="mb16"
          ><el-descriptions-item label="当前条目">{{ cacheStatus.size || 0 }}</el-descriptions-item
          ><el-descriptions-item label="命中">{{ cacheStatus.hits || 0 }}</el-descriptions-item
          ><el-descriptions-item label="未命中">{{ cacheStatus.misses || 0 }}</el-descriptions-item
          ><el-descriptions-item label="绕过">{{ cacheStatus.bypasses || 0 }}</el-descriptions-item></el-descriptions
        >
        <el-divider content-position="left">环境参数</el-divider>
        <el-form-item label="缓存最大条目">
          <el-input-number v-model="form.maximumSize" :min="100" :step="100" controls-position="right" />
        </el-form-item>
        <el-form-item label="协议端口">
          <el-input :model-value="form.protocolPort" disabled />
          <div class="hint">来自环境变量，修改后需重启服务</div>
        </el-form-item>
        <el-form-item label="密钥库路径">
          <el-input :model-value="form.keystorePath" disabled />
          <div class="hint">来自环境变量，页面不回显密钥库密码</div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup name="OcspRuntimeConfig" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { clearOcspCache, getOcspRuntimeConfig, saveOcspRuntimeConfig } from '@/api/ocsp/config';
import { getOcspResponseCacheStatus } from '@/api/ocsp/operations';
import type { OcspResponseCacheStatus, OcspRuntimeConfig } from '@/api/ocsp/types';

const loading = ref(false);
const saving = ref(false);
const cacheStatus = ref<OcspResponseCacheStatus>();
const form = reactive<OcspRuntimeConfig>({
  cacheEnabled: true,
  ttlSeconds: 60,
  responderTtlSeconds: 60,
  maximumSize: 10000,
  responseCacheEnabled: false,
  responseCacheTtlSeconds: 300,
  responseCacheMaximumSize: 10000,
  protocolPort: '6960',
  keystorePath: ''
});

const load = async () => {
  loading.value = true;
  try {
    Object.assign(form, await getOcspRuntimeConfig());
    cacheStatus.value = await getOcspResponseCacheStatus();
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    Object.assign(form, await saveOcspRuntimeConfig(form));
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
};

const clearCache = async () => {
  await ElMessageBox.confirm('清空状态、响应者和已签名响应缓存？不会删除配置，但会短暂增加实时查询/签名负载。', '清空缓存', { type: 'warning' });
  await clearOcspCache();
  cacheStatus.value = await getOcspResponseCacheStatus();
  ElMessage.success('缓存已清空');
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
.config-form {
  max-width: 640px;
}
.hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
