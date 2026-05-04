<template>
  <div class="app-container kmc-config-page">
    <el-form ref="configFormRef" v-loading="loading" :model="form" :rules="rules" label-width="150px">
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

      <el-row :gutter="16">
        <el-col :lg="8" :md="24">
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><Key /></el-icon>
                <span>密钥生成</span>
              </div>
            </template>
            <el-form-item label="硬件生成" prop="keyGeneration.enableHardwareGeneration">
              <el-switch v-model="form.keyGeneration.enableHardwareGeneration" active-text="启用" inactive-text="停用" />
            </el-form-item>
            <el-form-item label="默认算法" prop="keyGeneration.defaultKeyType">
              <el-select v-model="form.keyGeneration.defaultKeyType" style="width: 100%">
                <el-option label="SM2" value="SM2" />
                <el-option label="RSA" value="RSA" />
                <el-option label="SM4" value="SM4" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认长度" prop="keyGeneration.defaultKeySize">
              <el-select v-model="form.keyGeneration.defaultKeySize" style="width: 100%">
                <el-option label="256" :value="256" />
                <el-option label="2048" :value="2048" />
                <el-option label="3072" :value="3072" />
                <el-option label="4096" :value="4096" />
              </el-select>
            </el-form-item>
            <el-form-item label="批量大小" prop="keyGeneration.batchSize">
              <el-input-number v-model="form.keyGeneration.batchSize" :min="1" :max="1000" controls-position="right" />
            </el-form-item>
          </el-card>
        </el-col>

        <el-col :lg="8" :md="24">
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><Operation /></el-icon>
                <span>备用密钥池</span>
              </div>
            </template>
            <el-form-item label="自动补齐" prop="reservePool.enableAutoReplenish">
              <el-switch v-model="form.reservePool.enableAutoReplenish" active-text="启用" inactive-text="停用" />
            </el-form-item>
            <el-form-item label="检查间隔" prop="reservePool.watermarkCheckInterval">
              <el-input-number v-model="form.reservePool.watermarkCheckInterval" :min="10" :max="86400" controls-position="right" />
              <span class="unit">秒</span>
            </el-form-item>
            <el-form-item label="生成限速" prop="reservePool.generationRateLimit">
              <el-input-number v-model="form.reservePool.generationRateLimit" :min="1" :max="1000" controls-position="right" />
              <span class="unit">个/秒</span>
            </el-form-item>
          </el-card>
        </el-col>

        <el-col :lg="8" :md="24">
          <el-card shadow="never" class="config-section">
            <template #header>
              <div class="section-title">
                <el-icon><DocumentChecked /></el-icon>
                <span>审计</span>
              </div>
            </template>
            <el-form-item label="审计日志" prop="audit.enabled">
              <el-switch v-model="form.audit.enabled" active-text="启用" inactive-text="停用" />
            </el-form-item>
            <el-form-item label="保留天数" prop="audit.retentionDays">
              <el-input-number v-model="form.audit.retentionDays" :min="1" :max="3650" controls-position="right" />
              <span class="unit">天</span>
            </el-form-item>
          </el-card>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup name="KmcPolicyConfig" lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { DocumentChecked, Key, Operation } from '@element-plus/icons-vue';
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
    enableHardwareGeneration: true,
    defaultKeyType: 'SM2',
    defaultKeySize: 256,
    batchSize: 10
  },
  reservePool: {
    enableAutoReplenish: true,
    watermarkCheckInterval: 300,
    generationRateLimit: 5
  },
  audit: {
    enabled: true,
    retentionDays: 90
  }
});

const form = reactive<KmcRuntimeConfig>(defaultConfig());

const assignForm = (config: KmcRuntimeConfig) => {
  Object.assign(form.keyGeneration, config.keyGeneration);
  Object.assign(form.reservePool, config.reservePool);
  Object.assign(form.audit, config.audit);
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
  'keyGeneration.defaultKeyType': [{ required: true, message: '默认算法不能为空', trigger: 'change' }],
  'keyGeneration.defaultKeySize': [{ required: true, message: '默认长度不能为空', trigger: 'change' }],
  'keyGeneration.batchSize': [numberRule(1, '批量大小')],
  'reservePool.watermarkCheckInterval': [numberRule(10, '检查间隔')],
  'reservePool.generationRateLimit': [numberRule(1, '生成限速')],
  'audit.retentionDays': [numberRule(1, '保留天数')]
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
  .config-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;

    h2 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .config-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .config-section {
    min-height: 310px;
    margin-bottom: 16px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .unit {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
  }
}

@media (max-width: 768px) {
  .kmc-config-page {
    .config-header {
      display: block;
    }

    .config-actions {
      justify-content: flex-start;
      margin-top: 12px;
    }
  }
}
</style>
