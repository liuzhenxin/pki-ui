<template>
  <div class="app-container ocsp-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading">
        <div>
          <p class="heading-label">在线证书状态服务</p>
          <h1>OCSP 初始化向导</h1>
        </div>
        <el-tag effect="plain" size="large">租户 {{ tenantCode.toUpperCase() || 'OCSP' }}</el-tag>
      </div>

      <el-steps :active="activeStep" finish-status="success" simple class="init-steps">
        <el-step title="协议" />
        <el-step title="环境检查" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <div v-if="activeStep === 0" class="step-content">
          <div class="step-title">
            <h2>欢迎使用 {{ tenantCode.toUpperCase() || 'OCSP' }}</h2>
            <p>请阅读并确认用户协议后继续初始化。</p>
          </div>
          <div class="agreement-text">
            <Agreement :tenant-code="tenantCode" :tenant-name="tenantName" :company-name="companyName" />
          </div>
          <div class="agreement-footer">
            <el-checkbox v-model="agree" class="agree-checkbox">我已阅读并同意用户协议</el-checkbox>
          </div>
        </div>

        <div v-if="activeStep === 1" class="step-content env-step">
          <div class="step-header">
            <div>
              <h2>环境检查</h2>
              <p>确认 OCSP 业务库和平台租户已准备完成。</p>
            </div>
            <div class="header-actions">
              <el-button type="info" text circle class="help-button" :icon="QuestionFilled" @click="showEnvHelp = true" />
              <el-button type="primary" plain :icon="Refresh" :loading="envLoading" @click="loadEnvInfo">重新检测</el-button>
            </div>
          </div>

          <el-drawer v-model="showEnvHelp" title="OCSP环境检查说明" direction="rtl" size="450px">
            <div class="env-help-container">
              <el-alert title="初始化前检查" type="info" :closable="false" show-icon class="help-header-alert">
                <p>系统初始化需要确认业务表和平台租户准备完成。响应者与 CA 在初始化后配置。</p>
              </el-alert>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="danger" effect="dark" round size="small">必选</el-tag><span class="help-card-title">OCSP业务库</span>
                </div>
                <div class="help-card-body">检查 `ocsp_responder` 和 `ocsp_request_log` 是否存在。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="warning" effect="light" round size="small">必选</el-tag><span class="help-card-title">平台租户</span>
                </div>
                <div class="help-card-body">检查平台库中是否存在租户 6，初始化完成后会标记该租户状态。</div>
              </div>
            </div>
          </el-drawer>

          <div class="table-panel">
            <el-table
              v-loading="envLoading"
              :data="envRows"
              border
              style="width: 100%"
              class="env-table"
              :header-cell-style="{ background: '#f8f9fa', color: '#606266', fontWeight: 600 }"
            >
              <template #empty>
                <div class="empty-state">
                  <el-empty description="暂无环境检查结果" :image-size="120" />
                </div>
              </template>
              <el-table-column prop="name" label="检测项" min-width="160" />
              <el-table-column prop="value" label="当前值" min-width="220" show-overflow-tooltip />
              <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
              <el-table-column label="状态" width="120" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.ok ? 'success' : 'danger'" effect="light">{{ row.ok ? '正常' : '异常' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div v-if="activeStep === 2" class="step-content">
          <el-result icon="success" title="系统初始化已完成" sub-title="请重新登录，然后分别配置响应者和服务 CA。" />
        </div>
      </div>

      <div class="wizard-actions">
        <el-button :disabled="activeStep !== 1 || loading" @click="activeStep = 0">上一步</el-button>
        <el-button v-if="activeStep === 0" type="primary" :disabled="!agree" @click="next">下一步</el-button>
        <el-button v-else-if="activeStep === 1" type="primary" :disabled="!allEnvOk || envLoading" :loading="loading" @click="complete"
          >完成初始化</el-button
        >
        <el-button v-else type="primary" :loading="loading" @click="enterSystem">进入系统</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { QuestionFilled, Refresh } from '@element-plus/icons-vue';
import { completeOcspInitialization, getOcspEnvInfo, getOcspInitStatus } from '@/api/ocsp/init';
import { unwrapOcspData } from '@/api/ocsp/common';
import { getTenant } from '@/api/system/tenant';
import { useUserStore } from '@/store/modules/user';
import Agreement from '@/components/Agreement/index.vue';

interface EnvRow {
  name: string;
  value: string;
  message?: string;
  ok: boolean;
}
const router = useRouter();
const userStore = useUserStore();
const activeStep = ref(0);
const agree = ref(false);
const loading = ref(false);
const envLoading = ref(false);
const showEnvHelp = ref(false);
const envRows = ref<EnvRow[]>([]);
const tenantCode = ref('');
const tenantName = ref('');
const companyName = ref('');
const allEnvOk = computed(() => ['OCSP业务库', '平台租户'].every((name) => envRows.value.some((row) => row.name === name && row.ok)));

const loadEnvInfo = async () => {
  envLoading.value = true;
  try {
    const rows = unwrapOcspData<any[]>(await getOcspEnvInfo());
    envRows.value = Array.isArray(rows)
      ? rows.map((row) => ({ name: row.name, value: String(row.value ?? '-'), message: row.message, ok: row.ok === true }))
      : [];
  } catch {
    envRows.value = [{ name: 'OCSP 初始化接口', value: '/ocsp/v1/init/env', message: '环境检查失败，请重试。', ok: false }];
  } finally {
    envLoading.value = false;
  }
};
const next = async () => {
  if (!agree.value) return;
  activeStep.value = 1;
  await loadEnvInfo();
};
const complete = async () => {
  if (!allEnvOk.value || envLoading.value || loading.value) return;
  loading.value = true;
  try {
    const result = unwrapOcspData<{ initialized: boolean }>(await completeOcspInitialization());
    if (!result?.initialized) throw new Error('初始化未完成，请重新检查环境');
    userStore.setTenantInitStatus(-1);
    activeStep.value = 2;
    ElMessage.success('系统初始化完成，请继续配置响应者和服务 CA');
  } catch (error: any) {
    ElMessage.error(error?.message || '初始化失败，请重试');
  } finally {
    loading.value = false;
  }
};
const enterSystem = async () => {
  loading.value = true;
  try {
    await userStore.logout();
    await router.replace({ path: '/login', query: { redirect: encodeURIComponent('/ocsp-dashboard') } });
  } finally {
    loading.value = false;
  }
};
onMounted(async () => {
  try {
    const tenantId = userStore.tenantId || localStorage.getItem('tenantId') || '';
    if (tenantId) {
      const tenantRes = await getTenant(tenantId);
      if (tenantRes.data) {
        const tenant: any = tenantRes.data;
        tenantCode.value = tenant.code || 'ocsp';
        tenantName.value = tenant.name || '在线证书状态服务';
        companyName.value = tenant.companyName || '';
        userStore.setTenantInitStatus(Number(tenant.status));
        if (Number(tenant.status) === -1) {
          await router.replace('/index');
          return;
        }
      }
    }
    const status = unwrapOcspData<{ initialized: boolean }>(await getOcspInitStatus());
    if (status?.initialized) {
      await router.replace('/index');
      return;
    }
  } catch {
    /* 页面保留在协议步骤，环境检查会在下一步重新执行。 */
  }
});
</script>

<style scoped lang="scss">
.ocsp-init-page {
  min-height: calc(100vh - 84px);
  padding: 20px;
  background: var(--el-fill-color-lighter);
}

.init-card {
  max-width: 1220px;
  margin: 0 auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.init-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.heading-label {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.init-heading h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
}

.init-steps {
  margin-top: 18px;
}

.wizard-content {
  min-height: 560px;
  padding: 28px 0 24px;
}

.step-content {
  max-width: 1040px;
  margin: 0 auto;
}

.responder-step {
  max-width: 1120px;
}

.step-title,
.step-header {
  margin-bottom: 18px;
}

.step-title h2,
.step-header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
}

.step-title p,
.step-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.agreement-text {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 20px;
  background: var(--el-fill-color-blank);
}

.agreement-footer,
.wizard-actions {
  display: flex;
  justify-content: center;
}

.agreement-footer {
  justify-content: flex-end;
  padding-top: 16px;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.help-button {
  margin-right: 8px;
  font-size: 22px;
}

.env-help-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help-header-alert {
  margin-bottom: 4px;
}

.help-card,
.form-section,
.table-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.help-card {
  padding: 16px;
}

.help-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.help-card-title,
.form-section-title {
  font-weight: 600;
}

.help-card-body {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.table-panel {
  overflow: hidden;
}

.env-table :deep(.el-table__cell) {
  padding: 12px 0;
}

.empty-state {
  padding: 20px 0;
}

.wizard-actions {
  align-items: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.init-form {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
  gap: 16px;
}

.form-section {
  padding: 18px 20px 4px;
  margin-bottom: 18px;
}

.form-section-title {
  margin-bottom: 18px;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  line-height: 1;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}

.wide-item {
  grid-column: 1 / -1;
}

.full-input {
  width: 100%;
}

@media (max-width: 900px) {
  .form-grid,
  .source-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ocsp-init-page {
    padding: 12px;
  }

  .init-heading,
  .step-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .wizard-content {
    min-height: 460px;
  }

  .init-form :deep(.el-form-item) {
    display: block;
  }

  .init-form :deep(.el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
    margin-bottom: 6px;
  }

  .init-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
