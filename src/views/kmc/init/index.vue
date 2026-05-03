<template>
  <div class="app-container">
    <el-card v-loading="loading">
      <el-steps :active="activeStep" finish-status="success" simple>
        <el-step title="协议" />
        <el-step title="环境检查" />
        <el-step title="账号初始化" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <div v-if="activeStep === 0" class="step-content">
          <h2>欢迎使用 {{ tenantCode.toUpperCase() || 'KMC' }}</h2>
          <div class="agreement-text">
            <Agreement :tenant-code="tenantCode" :tenant-name="tenantName" :company-name="companyName" />
          </div>
          <el-checkbox v-model="agree" class="agree-checkbox">我已阅读并同意用户协议</el-checkbox>
        </div>

        <div v-if="activeStep === 1" class="step-content" style="width: 80%; margin: auto">
          <div class="step-header">
            <h2>环境检查</h2>
            <div>
              <el-button type="info" text circle class="help-button" :icon="QuestionFilled" @click="showEnvHelp = true" />
              <el-button type="primary" plain :icon="Refresh" :loading="envLoading" @click="loadEnvInfo">重新检测</el-button>
            </div>
          </div>

          <el-drawer v-model="showEnvHelp" title="KMC环境检查说明" direction="rtl" size="450px">
            <div class="env-help-container">
              <el-alert title="为什么要进行环境检查？" type="info" :closable="false" show-icon class="help-header-alert">
                <p>KMC 初始化前需要确认业务库、平台租户、默认管理员和审计员账号已经准备完成，避免初始化过程中产生不完整数据。</p>
              </el-alert>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="danger" effect="dark" round size="small">必选</el-tag>
                  <span class="help-card-title">KMC业务库</span>
                </div>
                <div class="help-card-body">检查密钥管理中心业务表是否存在，包括 CA 机构、密钥池策略等初始化依赖表。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="warning" effect="light" round size="small">必选</el-tag>
                  <span class="help-card-title">平台租户</span>
                </div>
                <div class="help-card-body">检查平台库中是否存在 KMC 租户，初始化流程会根据租户状态恢复当前步骤。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="success" effect="light" round size="small">必选</el-tag>
                  <span class="help-card-title">管理员/审计员</span>
                </div>
                <div class="help-card-body">检查默认管理员和审计员账号是否存在，后续步骤会更新账号密码和证书信息。</div>
              </div>
            </div>
          </el-drawer>

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
            <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="row.ok ? 'success' : 'danger'">{{ row.ok ? '正常' : '异常' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="activeStep === 2" class="step-content">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="init-form">
            <el-divider content-position="left">管理员账号</el-divider>
            <el-form-item label="用户名" prop="adminUsername">
              <el-input v-model="form.adminUsername" />
            </el-form-item>
            <el-form-item label="登录密码" prop="adminPassword">
              <el-input v-model="form.adminPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="证书 PEM" prop="adminCertPem">
              <el-input v-model="form.adminCertPem" type="textarea" :rows="4" placeholder="可粘贴管理员证书 PEM，后端未强制时可留空" />
            </el-form-item>

            <el-divider content-position="left">审计员账号</el-divider>
            <el-form-item label="用户名" prop="auditorUsername">
              <el-input v-model="form.auditorUsername" />
            </el-form-item>
            <el-form-item label="登录密码" prop="auditorPassword">
              <el-input v-model="form.auditorPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="证书 PEM" prop="auditorCertPem">
              <el-input v-model="form.auditorCertPem" type="textarea" :rows="4" placeholder="可粘贴审计员证书 PEM，后端未强制时可留空" />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="activeStep === 3" class="step-content">
          <el-result icon="success" title="初始化流程已完成" sub-title="请重新登录后进入 KMC 管理功能。" />
        </div>
      </div>

      <div class="wizard-actions">
        <el-button :disabled="activeStep === 0 || activeStep === 3 || loading" @click="prev">上一步</el-button>
        <el-button v-if="activeStep < 2" type="primary" :disabled="!canGoNext" @click="next">下一步</el-button>
        <el-button v-else-if="activeStep === 2" type="primary" :loading="loading" @click="submitInit">提交初始化</el-button>
        <el-button v-else type="primary" @click="router.push('/')">进入系统</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="KmcInit" lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { QuestionFilled, Refresh } from '@element-plus/icons-vue';
import { getEnvInfo, getInitStatus, initAdmin } from '@/api/kmc/init';
import { unwrapKmcData } from '@/api/kmc/common';
import { getTenant, updateTenant } from '@/api/system/tenant';
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
const formRef = ref<FormInstance>();
const activeStep = ref(0);
const agree = ref(false);
const loading = ref(false);
const envLoading = ref(false);
const initialized = ref(false);
const showEnvHelp = ref(false);
const envRows = ref<EnvRow[]>([]);
const tenantCode = ref('');
const tenantName = ref('');
const companyName = ref('');

const form = reactive({
  adminUsername: 'admin',
  adminPassword: '',
  adminCertPem: '',
  auditorUsername: 'auditor',
  auditorPassword: '',
  auditorCertPem: ''
});

const rules = reactive<FormRules>({
  adminUsername: [{ required: true, message: '请输入管理员用户名', trigger: 'blur' }],
  adminPassword: [{ required: true, message: '请输入管理员密码', trigger: 'blur' }],
  auditorUsername: [{ required: true, message: '请输入审计员用户名', trigger: 'blur' }],
  auditorPassword: [{ required: true, message: '请输入审计员密码', trigger: 'blur' }]
});

const normalizeEnvRows = (data: any): EnvRow[] => {
  if (Array.isArray(data)) {
    return data.map((item, index) => ({
      name: item.name ?? item.item ?? `检测项 ${index + 1}`,
      value: String(item.value ?? '-'),
      message: item.message ?? item.remark,
      ok: item.ok ?? item.status === 'success' ?? item.status === true
    }));
  }
  return Object.entries(data ?? {}).map(([name, value]: [string, any]) => ({
    name,
    value: String(value?.value ?? value ?? '-'),
    message: value?.message ?? value?.remark,
    ok: value?.ok ?? value?.status === 'success' ?? value === true
  }));
};

const allEnvOk = computed(() => envRows.value.length === 0 || envRows.value.every((item) => item.ok));
const canGoNext = computed(() => (activeStep.value === 0 ? agree.value : allEnvOk.value));

const saveTenantStatus = async (statusValue: number) => {
  const tenantId = userStore.tenantId || localStorage.getItem('tenantId') || '';
  if (!tenantId) {
    return;
  }
  const tenantRes = await getTenant(tenantId);
  if (tenantRes.data) {
    const tenantInfo: any = tenantRes.data;
    await updateTenant({
      co: {
        id: tenantInfo.id,
        tenantId: tenantInfo.tenantId,
        name: tenantInfo.name,
        code: tenantInfo.code,
        status: statusValue as any,
        sourceId: tenantInfo.sourceId,
        packageId: tenantInfo.packageId,
        companyName: tenantInfo.companyName
      }
    } as any);
    userStore.setTenantInitStatus(statusValue);
  }
};

const loadInitInfo = async () => {
  try {
    const res = await getInitStatus();
    const data: any = unwrapKmcData(res);
    initialized.value = Boolean(data?.initialized ?? data?.init ?? data);
  } catch (error) {
    initialized.value = false;
  }
  await loadEnvInfo();
};

const loadEnvInfo = async () => {
  envLoading.value = true;
  try {
    const res = await getEnvInfo();
    envRows.value = normalizeEnvRows(unwrapKmcData(res));
  } catch (error) {
    envRows.value = [
      {
        name: 'KMC 初始化接口',
        value: '/kmc/v1/init/env',
        message: '接口暂不可用，请确认后端是否已启用初始化控制器。',
        ok: false
      }
    ];
  } finally {
    envLoading.value = false;
  }
};

const next = async () => {
  if (!canGoNext.value) {
    return;
  }
  loading.value = true;
  try {
    activeStep.value++;
    await saveTenantStatus(activeStep.value);
    if (activeStep.value === 1) {
      await loadEnvInfo();
    }
  } finally {
    loading.value = false;
  }
};

const prev = async () => {
  if (activeStep.value > 0) {
    loading.value = true;
    try {
      activeStep.value--;
      await saveTenantStatus(activeStep.value);
    } finally {
      loading.value = false;
    }
  }
};

const submitInit = async () => {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  loading.value = true;
  try {
    await initAdmin({
      admin: {
        username: form.adminUsername,
        password: form.adminPassword,
        certPem: form.adminCertPem
      },
      auditor: {
        username: form.auditorUsername,
        password: form.auditorPassword,
        certPem: form.auditorCertPem
      }
    });
    ElMessage.success('初始化提交成功');
    activeStep.value = 3;
    userStore.setTenantInitStatus(-1);
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
        const tenantInfo: any = tenantRes.data;
        tenantCode.value = tenantInfo.code || 'kmc';
        tenantName.value = tenantInfo.name || '密钥管理中心';
        companyName.value = tenantInfo.companyName || '';
        userStore.setTenantInitStatus(Number(tenantInfo.status));

        if (Number(tenantInfo.status) === -1) {
          router.replace('/index');
          return;
        }

        const parsedStatus = Number(tenantInfo.status);
        if (!Number.isNaN(parsedStatus) && parsedStatus >= 0 && parsedStatus <= 3) {
          activeStep.value = parsedStatus;
        }
      }
    }
  } catch (error) {}
  await loadInitInfo();
});
</script>

<style scoped lang="scss">
.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wizard-content {
  min-height: 520px;
  padding: 24px 0;
}

.step-content {
  max-width: 960px;
  margin: 0 auto;
}

.agreement-text {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 16px;
  background: var(--el-fill-color-blank);
}

.agree-checkbox {
  margin-top: 16px;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
}

.step-header h2 {
  margin: 0;
}

.help-button {
  font-size: 24px;
  padding: 12px;
  margin-right: 8px;
}

.env-help-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help-header-alert {
  margin-bottom: 4px;
}

.help-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  padding: 14px;
  background: var(--el-fill-color-blank);
}

.help-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.help-card-title {
  font-weight: 600;
}

.help-card-body {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.wizard-actions {
  justify-content: center;
  gap: 12px;
}

.init-form {
  max-width: 720px;
  margin: 0 auto;
}
</style>
