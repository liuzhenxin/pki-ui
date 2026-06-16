<template>
  <div class="app-container license-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading">
        <div>
          <p class="heading-label">授权签发中心</p>
          <h1>License 初始化向导</h1>
        </div>
        <el-tag effect="plain" size="large">租户 {{ tenantCode.toUpperCase() || 'LICENSE' }}</el-tag>
      </div>

      <el-steps :active="activeStep" finish-status="success" simple class="init-steps">
        <el-step title="协议" />
        <el-step title="环境检查" />
        <el-step title="基础数据" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <div v-if="activeStep === 0" class="step-content">
          <div class="step-title">
            <h2>欢迎使用 {{ tenantName || '授权系统' }}</h2>
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
              <p>确认授权业务库、平台租户、管理员账号和签名私钥配置可用。</p>
            </div>
            <div class="header-actions">
              <el-button type="info" text circle class="help-button" :icon="QuestionFilled" @click="showEnvHelp = true" />
              <el-button type="primary" plain :icon="Refresh" :loading="envLoading" @click="loadEnvInfo">重新检测</el-button>
            </div>
          </div>

          <el-drawer v-model="showEnvHelp" title="License环境检查说明" direction="rtl" size="450px">
            <div class="env-help-container">
              <el-alert title="为什么要进行环境检查？" type="info" :closable="false" show-icon class="help-header-alert">
                <p>License 初始化前需要确认业务表、租户、管理员和 RSA 签名私钥已经准备完成，避免签发时出现无法入库或无法签名的问题。</p>
              </el-alert>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="danger" effect="dark" round size="small">必选</el-tag>
                  <span class="help-card-title">License业务库</span>
                </div>
                <div class="help-card-body">检查客户、产品、授权主表和绑定数据表是否存在。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="warning" effect="light" round size="small">必选</el-tag>
                  <span class="help-card-title">签名私钥</span>
                </div>
                <div class="help-card-body">签发服务通过运行配置读取 RSA 私钥，页面不会保存私钥内容。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="success" effect="light" round size="small">必选</el-tag>
                  <span class="help-card-title">默认业务数据</span>
                </div>
                <div class="help-card-body">初始化会写入默认客户和 ZX-TrustReader 产品，便于后续创建授权文件。</div>
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
              <el-table-column prop="message" label="说明" min-width="240" show-overflow-tooltip />
              <el-table-column label="状态" width="120" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.ok ? 'success' : 'danger'" effect="light">{{ row.ok ? '正常' : '异常' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div v-if="activeStep === 2" class="step-content">
          <div class="step-title">
            <h2>基础数据</h2>
            <p>设置授权系统管理员密码，并初始化默认客户与产品。</p>
          </div>
          <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="init-form">
            <div class="form-section">
              <div class="form-section-title">管理员账号</div>
              <el-form-item label="用户名" prop="adminUsername">
                <el-input v-model="form.adminUsername" />
              </el-form-item>
              <el-form-item label="登录密码" prop="adminPassword">
                <el-input v-model="form.adminPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="证书 PEM" prop="adminCertPem">
                <el-input v-model="form.adminCertPem" type="textarea" :rows="4" placeholder="可粘贴管理员证书 PEM，后端未强制时可留空" />
              </el-form-item>
            </div>

            <div class="form-section">
              <div class="form-section-title">默认授权数据</div>
              <el-form-item label="默认客户" prop="customerName">
                <el-input v-model="form.customerName" />
              </el-form-item>
              <el-form-item label="联系人" prop="contact">
                <el-input v-model="form.contact" />
              </el-form-item>
              <el-form-item label="产品名称" prop="product">
                <el-input v-model="form.product" />
              </el-form-item>
              <el-form-item label="产品版本" prop="productVersion">
                <el-input v-model="form.productVersion" />
              </el-form-item>
            </div>
          </el-form>
        </div>

        <div v-if="activeStep === 3" class="step-content">
          <el-result icon="success" title="初始化流程已完成" sub-title="请重新登录后进入 License 授权管理功能。" />
        </div>
      </div>

      <div class="wizard-actions">
        <el-button :disabled="activeStep === 0 || activeStep === 3 || loading" @click="prev">上一步</el-button>
        <el-button v-if="activeStep < 2" type="primary" :disabled="!canGoNext" @click="next">下一步</el-button>
        <el-button v-else-if="activeStep === 2" type="primary" :loading="loading" @click="submitInit">提交初始化</el-button>
        <el-button v-else type="primary" :loading="loading" @click="enterSystem">进入系统</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="LicenseInit" lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { QuestionFilled, Refresh } from '@element-plus/icons-vue';
import { getEnvInfo, getInitStatus, initAdmin } from '@/api/license/init';
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
const showEnvHelp = ref(false);
const envRows = ref<EnvRow[]>([]);
const tenantCode = ref('');
const tenantName = ref('');
const companyName = ref('');

const form = reactive({
  adminUsername: 'admin',
  adminPassword: '',
  adminCertPem: '',
  customerName: '示例单位',
  contact: '授权管理员',
  product: 'ZX-TrustReader',
  productVersion: '4.1.2'
});

const rules = reactive<FormRules>({
  adminUsername: [{ required: true, message: '请输入管理员用户名', trigger: 'blur' }],
  adminPassword: [{ required: true, message: '请输入管理员密码', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入默认客户', trigger: 'blur' }],
  contact: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  product: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  productVersion: [{ required: true, message: '请输入产品版本', trigger: 'blur' }]
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
    await getInitStatus();
  } catch (error) {}
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
        name: 'License 初始化接口',
        value: '/license/v1/init/env',
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
      defaults: {
        customerName: form.customerName,
        contact: form.contact,
        product: form.product,
        productVersion: form.productVersion
      }
    });
    ElMessage.success('初始化提交成功');
    activeStep.value = 3;
    userStore.setTenantInitStatus(-1);
  } finally {
    loading.value = false;
  }
};

const enterSystem = async () => {
  loading.value = true;
  try {
    ElMessage.success('初始化完成，请重新登录');
    await userStore.logout();
    await router.replace({
      path: '/login',
      query: {
        redirect: encodeURIComponent('/index')
      }
    });
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
        tenantCode.value = tenantInfo.code || 'license';
        tenantName.value = tenantInfo.name || '授权系统';
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
.license-init-page {
  min-height: calc(100vh - 84px);
  padding: 20px;
  background: var(--el-fill-color-lighter);
}

.init-card {
  max-width: 1180px;
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
  min-height: 520px;
  padding: 28px 0 24px;
}

.step-content {
  max-width: 960px;
  margin: 0 auto;
}

.env-step {
  max-width: 1000px;
}

.step-title {
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

.agreement-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.agree-checkbox {
  height: auto;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
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

.help-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
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

.table-panel {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.env-table {
  :deep(.el-table__cell) {
    padding: 12px 0;
  }
}

.empty-state {
  padding: 20px 0;
}

.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.init-form {
  max-width: 720px;
  margin: 0 auto;
}

.form-section {
  padding: 18px 20px 4px;
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.form-section-title {
  margin-bottom: 18px;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1;
}

@media (max-width: 768px) {
  .license-init-page {
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

  .init-form {
    :deep(.el-form-item) {
      display: block;
    }

    :deep(.el-form-item__label) {
      justify-content: flex-start;
      width: auto !important;
      margin-bottom: 6px;
    }

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }
  }
}
</style>
