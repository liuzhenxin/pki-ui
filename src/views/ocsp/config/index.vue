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
import type { OcspRuntimeConfig } from '@/api/ocsp/types';

const loading = ref(false);
const saving = ref(false);
const form = reactive<OcspRuntimeConfig>({
  cacheEnabled: true,
  ttlSeconds: 60,
  responderTtlSeconds: 60,
  maximumSize: 10000,
  protocolPort: '6960',
  keystorePath: ''
});

const load = async () => {
  loading.value = true;
  try {
    Object.assign(form, await getOcspRuntimeConfig());
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
  await ElMessageBox.confirm('清空 Caffeine 状态缓存与响应者缓存？不影响协议正确性。', '清空缓存', { type: 'warning' });
  await clearOcspCache();
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
