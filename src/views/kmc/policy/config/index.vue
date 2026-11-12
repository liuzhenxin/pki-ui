<template>
  <div class="app-container kmc-config-page">
    <el-form ref="configFormRef" v-loading="loading" :model="form" :rules="rules" label-position="top" size="default">
      <div class="config-header">
        <div>
          <h2>KMC 系统配置</h2>
          <p>维护密钥管理中心运行参数，保存后立即生效。</p>
        </div>
        <div class="config-actions">
          <el-button icon="Refresh" :loading="refreshing" v-hasPermi="['kmc:config:refresh']" @click="handleRefresh">刷新缓存</el-button>
          <el-button icon="RefreshLeft" @click="handleReset">重置</el-button>
          <el-button type="primary" icon="Check" :loading="saving" v-hasPermi="['kmc:config:edit']" @click="handleSave">保存</el-button>
        </div>
      </div>

      <div class="config-grid">
        <div class="config-column">
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><Key /></el-icon>
                <h3>密钥生成</h3>
              </div>
            </template>
            <el-form-item label="单批生成数量" prop="keyGeneration.batchSize">
              <el-input-number v-model="form.keyGeneration.batchSize" :min="1" :max="1000" controls-position="right" />
              <p class="form-tip">备用密钥池补齐时，每批生成并写入数据库的密钥数量。算法和长度由密钥池策略决定。</p>
            </el-form-item>
          </el-card>
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><Operation /></el-icon>
                <h3>备用密钥池</h3>
              </div>
            </template>
            <el-form-item label="自动补齐" prop="reservePool.enableAutoReplenish">
              <el-switch v-model="form.reservePool.enableAutoReplenish" active-text="启用" inactive-text="停用" />
            </el-form-item>
            <div class="config-fields">
              <el-form-item label="检查间隔（秒）" prop="reservePool.watermarkCheckInterval">
                <el-input-number v-model="form.reservePool.watermarkCheckInterval" :min="10" :max="86400" controls-position="right" />
              </el-form-item>
              <el-form-item label="生成限速（个/秒）" prop="reservePool.generationRateLimit">
                <el-input-number v-model="form.reservePool.generationRateLimit" :min="1" :max="1000" controls-position="right" />
              </el-form-item>
            </div>
          </el-card>
        </div>

        <div class="config-column">
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><Lock /></el-icon>
                <h3>密钥恢复</h3>
              </div>
            </template>
            <el-form-item label="密钥恢复" prop="keyRecovery.enabled">
              <el-switch v-model="form.keyRecovery.enabled" active-text="启用" inactive-text="停用" />
            </el-form-item>
            <div class="config-fields">
              <el-form-item label="取证员总数" prop="keyRecovery.totalApprovers">
                <el-input-number v-model="form.keyRecovery.totalApprovers" :min="1" :max="100" controls-position="right" />
              </el-form-item>
              <el-form-item label="必需审批人数" prop="keyRecovery.requiredApprovers">
                <el-input-number
                  v-model="form.keyRecovery.requiredApprovers"
                  :min="1"
                  :max="form.keyRecovery.totalApprovers || 1"
                  controls-position="right"
                />
              </el-form-item>
            </div>
          </el-card>
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><DocumentChecked /></el-icon>
                <h3>审计</h3>
              </div>
            </template>
            <el-alert class="audit-status" title="安全审计始终启用" type="success" :closable="false" show-icon>
              <template #default>KMC 安全事件由平台统一记录并集中保留，不能在本系统中停用或单独清理。</template>
            </el-alert>
          </el-card>
        </div>
      </div>
    </el-form>
  </div>
</template>

<script setup name="KmcPolicyConfig" lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { DocumentChecked, Key, Lock, Operation } from '@element-plus/icons-vue';
import { getKmcRuntimeConfig, refreshKmcRuntimeConfig, updateKmcRuntimeConfig } from '@/api/kmc/config';
import { KmcRuntimeConfig } from '@/api/kmc/config/types';
import { unwrapKmcData } from '@/api/kmc/common';

const configFormRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const refreshing = ref(false);
const original = ref<KmcRuntimeConfig>();

const defaultConfig = (): KmcRuntimeConfig => ({
  keyGeneration: {
    batchSize: 10
  },
  reservePool: {
    enableAutoReplenish: true,
    watermarkCheckInterval: 300,
    generationRateLimit: 5
  },
  keyRecovery: {
    enabled: true,
    totalApprovers: 5,
    requiredApprovers: 3
  }
});

const form = reactive<KmcRuntimeConfig>(defaultConfig());

const assignForm = (config: KmcRuntimeConfig) => {
  const normalized = {
    ...defaultConfig(),
    ...config,
    keyGeneration: { ...defaultConfig().keyGeneration, ...config.keyGeneration },
    reservePool: { ...defaultConfig().reservePool, ...config.reservePool },
    keyRecovery: { ...defaultConfig().keyRecovery, ...config.keyRecovery }
  };
  Object.assign(form.keyGeneration, normalized.keyGeneration);
  Object.assign(form.reservePool, normalized.reservePool);
  Object.assign(form.keyRecovery, normalized.keyRecovery);
};

const numberRule = (min: number, label: string) => ({
  validator: (_rule: unknown, value: number, callback: (error?: Error) => void) => {
    if (!Number.isInteger(value) || value < min) {
      callback(new Error(`${label}不能小于 ${min}`));
      return;
    }
    callback();
  },
  trigger: 'blur'
});

const rules = reactive<FormRules<KmcRuntimeConfig>>({
  'keyGeneration.batchSize': [numberRule(1, '单批生成数量')],
  'reservePool.watermarkCheckInterval': [numberRule(10, '检查间隔')],
  'reservePool.generationRateLimit': [numberRule(1, '生成限速')],
  'keyRecovery.totalApprovers': [numberRule(1, '取证员总数')],
  'keyRecovery.requiredApprovers': [
    numberRule(1, '必需审批人数'),
    {
      validator: (_rule: unknown, value: number, callback: (error?: Error) => void) => {
        if (Number.isInteger(value) && value > form.keyRecovery.totalApprovers) {
          callback(new Error('必需审批人数不能大于取证员总数'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ]
});

const loadConfig = async () => {
  loading.value = true;
  try {
    const res = await getKmcRuntimeConfig();
    const data = unwrapKmcData<KmcRuntimeConfig>(res);
    original.value = JSON.parse(JSON.stringify(data));
    assignForm(data);
  } finally {
    loading.value = false;
  }
};

const handleSave = async () => {
  await configFormRef.value?.validate();
  saving.value = true;
  try {
    const res = await updateKmcRuntimeConfig(JSON.parse(JSON.stringify(form)));
    const data = unwrapKmcData<KmcRuntimeConfig>(res);
    original.value = JSON.parse(JSON.stringify(data));
    assignForm(data);
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
};

const handleReset = () => {
  if (original.value) {
    assignForm(original.value);
  }
};

const handleRefresh = async () => {
  refreshing.value = true;
  try {
    const res = await refreshKmcRuntimeConfig();
    const data = unwrapKmcData<KmcRuntimeConfig>(res);
    original.value = JSON.parse(JSON.stringify(data));
    assignForm(data);
    ElMessage.success('刷新成功');
  } finally {
    refreshing.value = false;
  }
};

loadConfig();
</script>

<style scoped lang="scss">
.kmc-config-page {
  max-width: 1120px;
  margin-inline: auto;

  .config-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;

    h2 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    p {
      margin: 0;
      color: var(--el-text-color-regular);
      line-height: 1.5;
    }
  }

  .config-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .el-button + .el-button {
      margin-left: 0;
    }
  }

  .config-grid,
  .config-fields {
    display: grid;
    gap: 16px;
  }

  .config-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    align-items: start;
  }

  .config-column {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .config-fields {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
  }

  .config-section {
    border-radius: 8px;

    :deep(.el-card__header) {
      padding: 14px 16px;
      background-color: var(--el-fill-color-lighter);
    }

    :deep(.el-card__body) {
      padding: 16px;
    }

    :deep(.el-form-item:last-child),
    .config-fields :deep(.el-form-item) {
      margin-bottom: 0;
    }

    :deep(.el-form-item__label) {
      margin-bottom: 6px;
      font-weight: 600;
    }

    :deep(.el-input-number) {
      width: 100%;
      max-width: 192px;
    }

    :deep(.el-form-item__error) {
      position: static;
      flex-basis: 100%;
      line-height: 1.5;
    }
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-primary);

    .el-icon {
      font-size: 16px;
      color: var(--el-color-primary);
    }

    h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.5;
    }
  }

  .form-tip {
    flex-basis: 100%;
    margin: 8px 0 0;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.5;
  }

  .audit-status {
    :deep(.el-alert__title) {
      color: var(--el-text-color-primary);
      font-weight: 600;
    }

    :deep(.el-alert__description) {
      color: var(--el-text-color-regular);
      line-height: 1.5;
    }
  }
}
</style>
