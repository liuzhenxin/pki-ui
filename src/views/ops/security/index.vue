<template>
  <div class="security-page">
    <header class="page-header">
      <div>
        <h2>安全配置</h2>
        <p>统一管理 RADIUS 二次认证与平台 Syslog 安全日志转发。</p>
      </div>
      <div v-if="activeTab === 'radius'" class="header-actions">
        <el-button icon="Connection" :loading="testing" @click="openTestDialog">测试认证</el-button>
        <el-button v-hasPermi="['ops:security:radius:edit']" type="primary" icon="Check" :loading="saving" @click="save"> 保存 </el-button>
      </div>
    </header>

    <el-tabs v-model="activeTab" class="security-tabs">
      <el-tab-pane label="RADIUS 登录认证" name="radius" />
      <el-tab-pane label="Syslog 日志转发" name="syslog" />
    </el-tabs>

    <el-form v-show="activeTab === 'radius'" ref="formRef" v-loading="loading" :model="form" :rules="rules" label-position="top">
      <section class="settings-band status-band">
        <div>
          <h3>RADIUS 登录认证</h3>
          <p>关闭后立即恢复原用户名密码登录，不影响已签发的访问令牌。</p>
        </div>
        <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="关闭" />
      </section>

      <section class="settings-band">
        <div class="section-title">
          <h3>生效范围</h3>
          <el-tag v-if="form.tested" type="success" effect="plain">已完成测试</el-tag>
          <el-tag v-else type="warning" effect="plain">启用前需测试</el-tag>
        </div>
        <el-form-item prop="scopes">
          <el-radio-group v-model="scopeMode" @change="changeScopeMode">
            <el-radio-button value="ALL">全部服务</el-radio-button>
            <el-radio-button value="CUSTOM">指定系统</el-radio-button>
          </el-radio-group>
          <el-checkbox-group v-if="scopeMode === 'CUSTOM'" v-model="form.scopes" class="scope-options">
            <el-checkbox value="CA">CA</el-checkbox>
            <el-checkbox value="KMC">KMC</el-checkbox>
            <el-checkbox value="RA">RA</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </section>

      <section class="settings-band">
        <h3>服务器</h3>
        <div class="server-grid">
          <div class="server-column">
            <div class="server-heading">
              <strong>主 RADIUS 服务器</strong>
              <el-tag size="small">必填</el-tag>
            </div>
            <el-form-item label="服务器地址" prop="primary.host">
              <el-input v-model.trim="form.primary.host" placeholder="radius.example.com 或 IP 地址" />
            </el-form-item>
            <el-form-item label="认证端口" prop="primary.port">
              <el-input-number v-model="form.primary.port" :min="1" :max="65535" controls-position="right" />
            </el-form-item>
            <el-form-item label="共享密钥" prop="primary.secret">
              <el-input v-model="form.primary.secret" type="password" show-password autocomplete="new-password" placeholder="请输入共享密钥" />
            </el-form-item>
          </div>

          <div class="server-column">
            <div class="server-heading">
              <strong>备用 RADIUS 服务器</strong>
              <el-switch v-model="secondaryEnabled" />
            </div>
            <template v-if="secondaryEnabled && form.secondary">
              <el-form-item label="服务器地址" prop="secondary.host">
                <el-input v-model.trim="form.secondary.host" placeholder="radius-backup.example.com 或 IP 地址" />
              </el-form-item>
              <el-form-item label="认证端口" prop="secondary.port">
                <el-input-number v-model="form.secondary.port" :min="1" :max="65535" controls-position="right" />
              </el-form-item>
              <el-form-item label="共享密钥" prop="secondary.secret">
                <el-input v-model="form.secondary.secret" type="password" show-password autocomplete="new-password" placeholder="请输入共享密钥" />
              </el-form-item>
            </template>
            <el-empty v-else :image-size="46" description="未启用备用服务器" />
          </div>
        </div>
      </section>

      <section class="settings-band">
        <h3>认证参数</h3>
        <div class="parameter-grid">
          <el-form-item label="NAS Identifier" prop="nasIdentifier">
            <el-input v-model.trim="form.nasIdentifier" />
          </el-form-item>
          <el-form-item label="认证方式" prop="authMethod">
            <el-segmented v-model="form.authMethod" :options="['PAP', 'CHAP']" />
          </el-form-item>
          <el-form-item label="超时时间（毫秒）" prop="timeoutMillis">
            <el-input-number v-model="form.timeoutMillis" :min="500" :max="30000" :step="500" controls-position="right" />
          </el-form-item>
          <el-form-item label="重试次数" prop="retries">
            <el-input-number v-model="form.retries" :min="0" :max="5" controls-position="right" />
          </el-form-item>
        </div>
      </section>

      <section class="settings-band">
        <h3>救援管理员</h3>
        <p class="section-note">仅允许从本机或指定应急网段绕过 RADIUS，仍需通过本地用户名密码认证。</p>
        <div class="rescue-grid">
          <el-form-item label="救援管理员账号">
            <el-input v-model.trim="form.rescueUsername" placeholder="rescue-admin" />
          </el-form-item>
          <el-form-item label="允许网段">
            <el-select v-model="form.rescueNetworks" multiple filterable allow-create default-first-option>
              <el-option v-for="network in form.rescueNetworks" :key="network" :label="network" :value="network" />
            </el-select>
          </el-form-item>
        </div>
      </section>
    </el-form>

    <SyslogConfigPane v-if="activeTab === 'syslog'" class="syslog-pane" />

    <el-dialog v-if="activeTab === 'radius'" v-model="testVisible" title="测试 RADIUS 认证" width="460px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon> 测试账号和动态口令仅用于本次请求，不会保存。 </el-alert>
      <el-form ref="testFormRef" :model="testForm" :rules="testRules" label-position="top" class="test-form">
        <el-form-item label="测试账号" prop="username">
          <el-input v-model.trim="testForm.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="动态口令" prop="password">
          <el-input v-model="testForm.password" type="password" show-password autocomplete="off" @keyup.enter="runTest" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="testVisible = false">取消</el-button>
        <el-button v-hasPermi="['ops:security:radius:test']" type="primary" :loading="testing" @click="runTest">开始测试</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OpsSecurity" lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { getRadiusConfig, saveRadiusConfig, testRadiusAuthentication } from '@/api/ops';
import type { RadiusConfig } from '@/api/ops/types';
import SyslogConfigPane from './SyslogConfigPane.vue';

const defaultConfig = (): RadiusConfig => ({
  enabled: false,
  scopes: ['ALL'],
  primary: { host: '', port: 1812, secret: '' },
  nasIdentifier: 'liuzx-pki',
  authMethod: 'PAP',
  timeoutMillis: 3000,
  retries: 1,
  rescueUsername: 'rescue-admin',
  rescueNetworks: ['127.0.0.1/32', '::1/128']
});

const loading = ref(false);
const activeTab = ref<'radius' | 'syslog'>('radius');
const saving = ref(false);
const testing = ref(false);
const testVisible = ref(false);
const secondaryEnabled = ref(false);
const scopeMode = ref<'ALL' | 'CUSTOM'>('ALL');
const formRef = ref<FormInstance>();
const testFormRef = ref<FormInstance>();
const form = reactive<RadiusConfig>(defaultConfig());
const testForm = reactive({ username: '', password: '' });
const testedSnapshot = ref('');

const rules: FormRules = {
  scopes: [{ type: 'array', required: true, min: 1, message: '请选择生效范围', trigger: 'change' }],
  'primary.host': [{ required: true, message: '请输入主 RADIUS 服务器地址', trigger: 'blur' }],
  'primary.secret': [{ required: true, message: '请输入主服务器共享密钥', trigger: 'blur' }],
  nasIdentifier: [{ required: true, message: '请输入 NAS Identifier', trigger: 'blur' }]
};

const testRules: FormRules = {
  username: [{ required: true, message: '请输入测试账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入动态口令', trigger: 'blur' }]
};

const normalizeSecondary = () => {
  if (!secondaryEnabled.value) {
    form.secondary = undefined;
  } else if (!form.secondary) {
    form.secondary = { host: '', port: 1812, secret: '' };
  }
};

watch(secondaryEnabled, normalizeSecondary);

const configFingerprint = () =>
  JSON.stringify({
    scopes: form.scopes,
    primary: form.primary,
    secondary: form.secondary,
    nasIdentifier: form.nasIdentifier,
    authMethod: form.authMethod,
    timeoutMillis: form.timeoutMillis,
    retries: form.retries
  });

watch(
  form,
  () => {
    if (testedSnapshot.value && configFingerprint() !== testedSnapshot.value) {
      form.tested = false;
    }
  },
  { deep: true }
);

const changeScopeMode = (mode: string | number | boolean | undefined) => {
  form.scopes = mode === 'ALL' ? ['ALL'] : [];
};

const load = async () => {
  loading.value = true;
  try {
    const response = await getRadiusConfig();
    Object.assign(form, defaultConfig(), response.data || {});
    form.primary.secret = form.primary.secretMask || '';
    if (form.secondary) {
      form.secondary.secret = form.secondary.secretMask || '';
    }
    scopeMode.value = form.scopes.includes('ALL') ? 'ALL' : 'CUSTOM';
    secondaryEnabled.value = Boolean(form.secondary?.host);
    testedSnapshot.value = form.tested ? configFingerprint() : '';
  } finally {
    loading.value = false;
  }
};

const validateConfig = async () => {
  normalizeSecondary();
  return formRef.value?.validate();
};

const openTestDialog = async () => {
  await validateConfig();
  testVisible.value = true;
};

const runTest = async () => {
  await testFormRef.value?.validate();
  testing.value = true;
  try {
    await testRadiusAuthentication({ config: JSON.parse(JSON.stringify(form)), ...testForm });
    form.tested = true;
    form.lastTestTime = new Date().toISOString();
    testedSnapshot.value = configFingerprint();
    testForm.password = '';
    testVisible.value = false;
    ElMessage.success('RADIUS 测试认证成功');
  } finally {
    testing.value = false;
    testForm.password = '';
  }
};

const save = async () => {
  await validateConfig();
  if (form.enabled && !form.tested) {
    ElMessage.warning('启用 RADIUS 前必须测试认证成功');
    return;
  }
  saving.value = true;
  try {
    await saveRadiusConfig(JSON.parse(JSON.stringify(form)));
    ElMessage.success(form.enabled ? 'RADIUS 已启用' : '安全配置已保存');
    await load();
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<style scoped lang="scss">
.security-page {
  min-height: calc(100vh - 84px);
  padding: 16px 20px 32px;
  background: #f5f7fa;
}

.page-header,
.settings-band,
.security-tabs,
.syslog-pane {
  max-width: 1180px;
  margin: 0 auto;
}

.security-tabs {
  padding: 0 24px;
  background: #fff;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 0 18px;
}

.page-header h2,
.settings-band h3 {
  margin: 0;
  color: #1f2937;
  letter-spacing: 0;
}

.page-header h2 {
  font-size: 22px;
}

.page-header p,
.section-note {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
}

.header-actions,
.section-title,
.server-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-band {
  padding: 22px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.settings-band:first-of-type {
  border-top: 1px solid #e5e7eb;
}

.status-band,
.section-title,
.server-heading {
  justify-content: space-between;
}

.status-band {
  display: flex;
  align-items: center;
  gap: 24px;
}

.settings-band h3 {
  margin-bottom: 18px;
  font-size: 16px;
}

.status-band h3,
.section-title h3,
.server-heading strong {
  margin-bottom: 0;
}

.scope-options {
  margin-top: 14px;
}

.server-grid,
.parameter-grid,
.rescue-grid {
  display: grid;
  gap: 24px;
}

.server-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.server-column {
  min-width: 0;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.server-heading {
  min-height: 32px;
  margin-bottom: 12px;
}

.parameter-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.rescue-grid {
  grid-template-columns: minmax(220px, 0.7fr) minmax(320px, 1.3fr);
  margin-top: 18px;
}

.test-form {
  margin-top: 18px;
}

:deep(.el-input-number),
:deep(.el-select),
:deep(.el-segmented) {
  width: 100%;
}

@media (max-width: 900px) {
  .parameter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .security-page {
    padding: 12px;
  }

  .page-header,
  .status-band {
    align-items: flex-start;
  }

  .page-header,
  .status-band,
  .header-actions {
    flex-direction: column;
  }

  .server-grid,
  .parameter-grid,
  .rescue-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }
}
</style>
