<template>
  <div class="app-container kmc-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading">
        <div>
          <p class="heading-label">密钥管理中心</p>
          <h1>KMC 初始化向导</h1>
        </div>
      </div>

      <el-steps :active="activeStep" finish-status="success" simple class="init-steps">
        <el-step title="协议" />
        <el-step title="环境检查" />
        <el-step title="服务身份" />
        <el-step title="账号初始化" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <div v-if="activeStep === 0" class="step-content">
          <div class="step-title">
            <h2>欢迎使用 {{ tenantCode.toUpperCase() || 'KMC' }}</h2>
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
              <p>确认初始化所需的业务库、平台租户和默认账号状态。</p>
            </div>
            <div class="header-actions">
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
              <div class="help-card">
                <div class="help-card-header">
                  <el-tag type="info" effect="plain" round size="small">下一步</el-tag>
                  <span class="help-card-title">KMP服务身份</span>
                </div>
                <div class="help-card-body">用于签署 KMP 响应的 KMC 自身身份证书。环境检查不阻断；未配置时请在下一步生成或导入 PKCS12。</div>
              </div>
            </div>
          </el-drawer>

          <!-- 环境检测结果摘要 -->
          <div v-if="envRows.length > 0 && !envLoading" class="env-summary">
            <div class="env-summary-card" :class="allEnvOk ? 'env-summary-ok' : 'env-summary-fail'">
              <div class="env-summary-icon">
                <el-icon :size="40"><CircleCheckFilled v-if="allEnvOk" /><WarningFilled v-else /></el-icon>
              </div>
              <div class="env-summary-text">
                <div class="env-summary-title">{{ allEnvOk ? '环境检查全部通过' : '环境检查存在异常' }}</div>
                <div class="env-summary-desc">
                  共 {{ envRows.length }} 项检测，
                  <span class="env-count-ok">{{ okCount }} 项正常</span>
                  <template v-if="failCount > 0">
                    ，<span class="env-count-fail">{{ failCount }} 项异常</span>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- 环境检测卡片列表 -->
          <div v-loading="envLoading" class="env-cards">
            <div v-for="(row, index) in envRows" :key="index" class="env-card" :class="{ 'env-card-ok': row.ok, 'env-card-fail': !row.ok }">
              <div class="env-card-icon">
                <el-icon :size="22"><CircleCheckFilled v-if="row.ok" /><CircleCloseFilled v-else /></el-icon>
              </div>
              <div class="env-card-body">
                <div class="env-card-header">
                  <span class="env-card-name">{{ row.name }}</span>
                  <el-tag :type="row.ok ? 'success' : 'danger'" effect="light" size="small">{{ row.ok ? '正常' : '异常' }}</el-tag>
                </div>
                <div class="env-card-value" v-if="row.value && row.value !== '-'">
                  <span class="env-card-label">当前值：</span>{{ row.value }}
                </div>
                <div class="env-card-message" v-if="row.message">{{ row.message }}</div>
              </div>
            </div>
            <div v-if="envRows.length === 0 && !envLoading" class="empty-state">
              <el-empty description="暂无环境检查结果" :image-size="80" />
            </div>
          </div>
        </div>

        <div v-if="activeStep === 2" class="step-content">
          <div class="step-title">
            <h2>KMC 服务身份</h2>
            <p>配置用于签署 KMP 响应的软件身份证书。这不是对端 CA 通信证书。</p>
          </div>
          <el-alert
            class="step-alert"
            type="info"
            :closable="false"
            show-icon
            title="KMC 使用该身份签署 KSRespond。若部署时已挂载 PKCS12，将直接显示当前证书；否则请生成自签名 SM2 身份或导入已有密钥库。"
          />

          <div v-if="identityConfigured" class="identity-preview">
            <div class="form-section-title">当前身份</div>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="来源">{{ identitySourceLabel }}</el-descriptions-item>
              <el-descriptions-item label="主题">{{ identity.subject || '-' }}</el-descriptions-item>
              <el-descriptions-item label="算法">{{ identity.algorithm || '-' }}</el-descriptions-item>
              <el-descriptions-item label="别名">{{ identity.alias || '-' }}</el-descriptions-item>
              <el-descriptions-item label="有效期至">{{ identity.notAfter || '-' }}</el-descriptions-item>
              <el-descriptions-item label="指纹">{{ identity.fingerprintSha256 || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <el-form
            v-if="identity.source !== 'FILE'"
            ref="identityFormRef"
            :model="identityForm"
            :rules="identityRules"
            label-width="120px"
            class="init-form"
          >
            <el-form-item label="配置方式">
              <el-radio-group v-model="identityForm.mode">
                <el-radio-button value="GENERATE">生成自签名</el-radio-button>
                <el-radio-button value="IMPORT">导入 PKCS12</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <template v-if="identityForm.mode === 'GENERATE'">
              <el-form-item label="通用名称" prop="commonName">
                <el-input v-model="identityForm.commonName" placeholder="例如：KMC KMP Signer" />
              </el-form-item>
              <el-form-item label="组织名称" prop="organization">
                <el-input v-model="identityForm.organization" placeholder="例如：LiuZX" />
              </el-form-item>
              <el-form-item label="国家代码" prop="country">
                <el-input v-model="identityForm.country" maxlength="2" placeholder="CN" />
              </el-form-item>
              <el-form-item label="有效年数" prop="validityYears">
                <el-input-number v-model="identityForm.validityYears" :min="1" :max="30" />
              </el-form-item>
              <el-form-item label="密钥别名" prop="alias">
                <el-input v-model="identityForm.alias" placeholder="main" />
              </el-form-item>
              <el-form-item label="密钥库口令" prop="password">
                <el-input v-model="identityForm.password" type="password" show-password placeholder="可留空，由服务端生成" />
              </el-form-item>
            </template>
            <template v-else>
              <el-form-item label="PKCS12 文件" prop="keystoreBase64">
                <el-upload :auto-upload="false" :limit="1" accept=".p12,.pfx,.pkcs12" :on-change="onKeystoreChange" :on-remove="onKeystoreRemove">
                  <el-button>选择文件</el-button>
                </el-upload>
              </el-form-item>
              <el-form-item label="密钥别名" prop="alias">
                <el-input v-model="identityForm.alias" placeholder="main" />
              </el-form-item>
              <el-form-item label="密钥库口令" prop="password">
                <el-input v-model="identityForm.password" type="password" show-password />
              </el-form-item>
            </template>
            <el-form-item>
              <el-button type="primary" :loading="identityLoading" @click="submitIdentity">
                {{ identityConfigured ? '重新配置并保存' : '保存服务身份' }}
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div v-if="activeStep === 3" class="step-content">
          <div class="step-title">
            <h2>账号初始化</h2>
            <p>设置管理员和审计员的初始登录凭据。</p>
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
              <div class="form-section-title">审计员账号</div>
              <el-form-item label="用户名" prop="auditorUsername">
                <el-input v-model="form.auditorUsername" />
              </el-form-item>
              <el-form-item label="登录密码" prop="auditorPassword">
                <el-input v-model="form.auditorPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="证书 PEM" prop="auditorCertPem">
                <el-input v-model="form.auditorCertPem" type="textarea" :rows="4" placeholder="可粘贴审计员证书 PEM，后端未强制时可留空" />
              </el-form-item>
            </div>
          </el-form>
        </div>

        <div v-if="activeStep === 4" class="step-content">
          <el-result icon="success" title="初始化流程已完成" sub-title="请重新登录后进入 KMC 管理功能。" />
        </div>
      </div>

      <div class="wizard-actions">
        <el-button :disabled="activeStep === 0 || activeStep === 4 || loading" @click="prev">上一步</el-button>
        <el-button v-if="activeStep < 3" type="primary" :disabled="!canGoNext" @click="next">下一步</el-button>
        <el-button v-else-if="activeStep === 3" type="primary" :loading="loading" @click="submitInit">提交初始化</el-button>
        <el-button v-else type="primary" :loading="loading" @click="enterSystem">进入系统</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="KmcInit" lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules, UploadFile } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { QuestionFilled, Refresh, CircleCheckFilled, CircleCloseFilled, WarningFilled } from '@element-plus/icons-vue';
import { getEnvInfo, getIdentity, getInitStatus, initAdmin, initIdentity } from '@/api/kmc/init';
import { unwrapKmcData } from '@/api/kmc/common';
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
const formRef = ref<FormInstance>();
const identityFormRef = ref<FormInstance>();
const activeStep = ref(0);
const agree = ref(false);
const loading = ref(true);
const envLoading = ref(false);
const identityLoading = ref(false);
const initialized = ref(false);
const showEnvHelp = ref(false);
const envRows = ref<EnvRow[]>([]);
const tenantCode = ref('');
const tenantName = ref('');
const companyName = ref('');
const identity = reactive({
  configured: false,
  source: 'NONE',
  subject: '',
  issuer: '',
  serialNumber: '',
  notBefore: '',
  notAfter: '',
  fingerprintSha256: '',
  algorithm: '',
  alias: '',
  certPem: ''
});

const identityForm = reactive({
  mode: 'GENERATE',
  commonName: 'KMC KMP Signer',
  organization: 'LiuZX',
  country: 'CN',
  validityYears: 10,
  alias: 'main',
  password: '',
  keystoreBase64: ''
});

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

const identityRules = reactive<FormRules>({
  commonName: [{ required: true, message: '请输入通用名称', trigger: 'blur' }],
  country: [{ required: true, message: '请输入国家代码', trigger: 'blur' }],
  alias: [{ required: true, message: '请输入密钥别名', trigger: 'blur' }],
  password: [
    {
      validator: (_rule, value, callback) => {
        if (identityForm.mode === 'IMPORT' && !String(value || '').trim()) {
          callback(new Error('导入 PKCS12 时必须填写密钥库口令'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  keystoreBase64: [
    {
      validator: (_rule, value, callback) => {
        if (identityForm.mode === 'IMPORT' && !String(value || '').trim()) {
          callback(new Error('请选择 PKCS12 文件'));
          return;
        }
        callback();
      },
      trigger: 'change'
    }
  ]
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

const allEnvOk = computed(() => envRows.value.length > 0 && envRows.value.every((item) => item.ok));
const okCount = computed(() => envRows.value.filter((item) => item.ok).length);
const failCount = computed(() => envRows.value.filter((item) => !item.ok).length);
const identityConfigured = computed(() => Boolean(identity.configured));
const identitySourceLabel = computed(() => {
  if (identity.source === 'FILE') {
    return '部署密钥库';
  }
  if (identity.source === 'INIT') {
    return '初始化向导';
  }
  return '未配置';
});
const canGoNext = computed(() => {
  if (activeStep.value === 0) {
    return agree.value;
  }
  if (activeStep.value === 1) {
    return allEnvOk.value;
  }
  if (activeStep.value === 2) {
    return identityConfigured.value;
  }
  return false;
});

// 向导步骤状态仅同步前端内存。完成初始化时由 KMC InitController.initAdmin
// 把 sys_tenant.status 写成 -1。不要调用 admin 的 PUT /v1/tenants
// （该接口要求 write + sys:tenant:modify，引导账号不具备，会返回 Access Denied）。
const syncTenantInitStatus = (statusValue: number) => {
  userStore.setTenantInitStatus(statusValue);
};

const applyIdentity = (data: any) => {
  identity.configured = Boolean(data?.configured);
  identity.source = data?.source || 'NONE';
  identity.subject = data?.subject || '';
  identity.issuer = data?.issuer || '';
  identity.serialNumber = data?.serialNumber || '';
  identity.notBefore = data?.notBefore || '';
  identity.notAfter = data?.notAfter || '';
  identity.fingerprintSha256 = data?.fingerprintSha256 || '';
  identity.algorithm = data?.algorithm || '';
  identity.alias = data?.alias || '';
  identity.certPem = data?.certPem || '';
};

const loadIdentityInfo = async () => {
  try {
    const res = await getIdentity();
    applyIdentity(unwrapKmcData(res));
  } catch (error) {
    applyIdentity({ configured: false, source: 'NONE' });
  }
};

const loadInitInfo = async () => {
  try {
    const res = await getInitStatus();
    const data: any = unwrapKmcData(res);
    initialized.value = Boolean(data?.initialized ?? data?.init ?? data);
    if (data?.identity) {
      applyIdentity(data.identity);
    } else {
      await loadIdentityInfo();
    }
  } catch (error) {
    initialized.value = false;
    await loadIdentityInfo();
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
    syncTenantInitStatus(activeStep.value);
    if (activeStep.value === 1) {
      await loadEnvInfo();
    }
    if (activeStep.value === 2) {
      await loadIdentityInfo();
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
      syncTenantInitStatus(activeStep.value);
    } finally {
      loading.value = false;
    }
  }
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const onKeystoreChange = async (file: UploadFile) => {
  if (!file.raw) {
    return;
  }
  identityForm.keystoreBase64 = await readFileAsBase64(file.raw);
};

const onKeystoreRemove = () => {
  identityForm.keystoreBase64 = '';
};

const submitIdentity = async () => {
  if (identity.source === 'FILE') {
    return;
  }
  const valid = await identityFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  identityLoading.value = true;
  try {
    const payload: Record<string, unknown> = {
      mode: identityForm.mode,
      alias: identityForm.alias,
      password: identityForm.password
    };
    if (identityForm.mode === 'GENERATE') {
      payload.commonName = identityForm.commonName;
      payload.organization = identityForm.organization;
      payload.country = identityForm.country;
      payload.validityYears = identityForm.validityYears;
    } else {
      payload.keystoreBase64 = identityForm.keystoreBase64;
      payload.storeType = 'PKCS12';
    }
    const res = await initIdentity(payload);
    applyIdentity(unwrapKmcData(res));
    ElMessage.success('服务身份已保存');
  } finally {
    identityLoading.value = false;
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
    activeStep.value = 4;
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
  // 优先使用后端 InitController 状态判断是否已完成初始化
  try {
    const statusRes = await getInitStatus();
    if (statusRes && (statusRes as any).data?.tenantStatus === -1) {
      router.replace('/index');
      return;
    }
  } catch (e) {}

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
        if (!Number.isNaN(parsedStatus) && parsedStatus >= 0 && parsedStatus <= 4) {
          activeStep.value = parsedStatus;
        }
      }
    }
  } catch (error) {}
  loading.value = false;
  await loadInitInfo();
});
</script>

<style scoped lang="scss">
.kmc-init-page {
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

.env-summary {
  margin-bottom: 20px;
}

.env-summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
}

.env-summary-ok {
  background: linear-gradient(135deg, #f0fdf4 0%, #f0faf3 100%);
  border-color: #b7ebc9;
}

.env-summary-fail {
  background: linear-gradient(135deg, #fef2f2 0%, #fef5f5 100%);
  border-color: #fecaca;
}

.env-summary-icon {
  flex-shrink: 0;
}

.env-summary-ok .env-summary-icon {
  color: var(--el-color-success);
}

.env-summary-fail .env-summary-icon {
  color: var(--el-color-danger);
}

.env-summary-text {
  min-width: 0;
}

.env-summary-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.env-summary-desc {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.env-count-ok {
  color: var(--el-color-success);
  font-weight: 600;
}

.env-count-fail {
  color: var(--el-color-danger);
  font-weight: 600;
}

.env-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.env-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  transition: box-shadow 0.2s;
}

.env-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.env-card-ok {
  border-left: 4px solid var(--el-color-success);
}

.env-card-fail {
  border-left: 4px solid var(--el-color-danger);
  background: #fffbfb;
}

.env-card-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.env-card-ok .env-card-icon {
  color: var(--el-color-success);
}

.env-card-fail .env-card-icon {
  color: var(--el-color-danger);
}

.env-card-body {
  min-width: 0;
  flex: 1;
}

.env-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.env-card-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.env-card-value {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 4px;
  word-break: break-all;
}

.env-card-label {
  color: var(--el-text-color-placeholder);
}

.env-card-message {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.empty-state {
  padding: 40px 0;
}

.step-alert {
  margin-bottom: 18px;
}

.identity-preview {
  max-width: 720px;
  margin: 0 auto 18px;
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
  .kmc-init-page {
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
