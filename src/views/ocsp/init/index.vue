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
        <el-step title="响应者配置" />
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
              <p>确认 OCSP 业务库、租户、默认响应者和验证数据源配置状态。</p>
            </div>
            <div class="header-actions">
              <el-button type="info" text circle class="help-button" :icon="QuestionFilled" @click="showEnvHelp = true" />
              <el-button type="primary" plain :icon="Refresh" :loading="envLoading" @click="loadEnvInfo">重新检测</el-button>
            </div>
          </div>

          <el-drawer v-model="showEnvHelp" title="OCSP环境检查说明" direction="rtl" size="450px">
            <div class="env-help-container">
              <el-alert title="初始化前检查" type="info" :closable="false" show-icon class="help-header-alert">
                <p>OCSP 初始化需要确认业务表、租户、响应者配置和证书状态验证数据源准备完成。</p>
              </el-alert>
              <div class="help-card">
                <div class="help-card-header"><el-tag type="danger" effect="dark" round size="small">必选</el-tag><span class="help-card-title">OCSP业务库</span></div>
                <div class="help-card-body">检查 `ocsp_responder` 和 `ocsp_request_log` 是否存在。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header"><el-tag type="warning" effect="light" round size="small">必选</el-tag><span class="help-card-title">平台租户</span></div>
                <div class="help-card-body">检查平台库中是否存在租户 6，初始化完成后会标记该租户状态。</div>
              </div>
              <div class="help-card">
                <div class="help-card-header"><el-tag type="success" effect="light" round size="small">必选</el-tag><span class="help-card-title">验证数据源</span></div>
                <div class="help-card-body">支持数据库和 LDAP 两种证书状态验证模式，敏感密码仅保存引用。</div>
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

        <div v-if="activeStep === 2" class="step-content responder-step">
          <div class="step-title">
            <h2>响应者与验证数据源</h2>
            <p>默认使用软件密钥：在 OCSP 内生成 CSR，交由 CA 离线签发后导入证书。私钥不会出现在表单中。HSM 请改为粘贴证书 PEM。</p>
          </div>
          <el-form ref="formRef" :model="form" :rules="rules" label-width="150px" class="init-form">
            <div class="form-grid">
              <div class="form-section">
                <div class="form-section-title">响应者配置</div>
                <el-form-item label="响应者名称" prop="name">
                  <el-input v-model="form.name" />
                </el-form-item>
                <el-form-item label="CA ID" prop="caId">
                  <el-input-number v-model="form.caId" :min="1" controls-position="right" class="full-input" />
                </el-form-item>
                <el-form-item label="签名者类型" prop="signerType">
                  <el-segmented v-model="form.signerType" :options="signerTypeOptions" />
                </el-form-item>
                <el-form-item label="响应有效期(秒)" prop="responseValidity">
                  <el-input-number v-model="form.responseValidity" :min="60" :step="60" controls-position="right" class="full-input" />
                </el-form-item>
                <el-form-item label="响应选项">
                  <el-checkbox v-model="form.includeCerts">包含证书链</el-checkbox>
                  <el-checkbox v-model="form.nonceEnabled">启用 Nonce</el-checkbox>
                </el-form-item>
                <el-form-item label="签名配置" prop="signerConf">
                  <el-input
                    v-model="form.signerConf"
                    type="textarea"
                    :rows="5"
                    placeholder='SOFTWARE CSR 示例 {"keyAlias":"ocsp-responder-key","algorithm":"SM3withSM2","keyStoreRef":"ocsp-db"}'
                  />
                </el-form-item>
              </div>

              <div class="form-section">
                <div class="form-section-title">签名证书</div>
                <ResponderCsrPanel
                  :name="form.name"
                  :signer-type="form.signerType"
                  v-model:signer-cert="form.signerCert"
                  v-model:signer-conf="form.signerConf"
                  v-model:cert-source="certSource"
                />
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">证书状态验证数据源</div>
              <el-form-item label="数据源类型" prop="statusSourceType">
                <el-segmented v-model="form.statusSourceType" :options="statusSourceOptions" />
              </el-form-item>

              <template v-if="form.statusSourceType === 'DB'">
                <div class="source-grid">
                  <el-form-item label="数据库地址" prop="dbUrl">
                    <el-input v-model="form.dbUrl" placeholder="jdbc:mysql://localhost:3306/lcloud_ca" />
                  </el-form-item>
                  <el-form-item label="用户名" prop="dbUsername">
                    <el-input v-model="form.dbUsername" />
                  </el-form-item>
                  <el-form-item label="密码引用" prop="dbPasswordRef">
                    <el-input v-model="form.dbPasswordRef" placeholder="ocsp/db/ca-readonly" />
                  </el-form-item>
                  <el-form-item label="证书表" prop="dbCertTable">
                    <el-input v-model="form.dbCertTable" />
                  </el-form-item>
                  <el-form-item label="序列号字段" prop="dbSerialNumberColumn">
                    <el-input v-model="form.dbSerialNumberColumn" />
                  </el-form-item>
                  <el-form-item label="CA字段" prop="dbCaIdColumn">
                    <el-input v-model="form.dbCaIdColumn" />
                  </el-form-item>
                  <el-form-item label="状态字段" prop="dbStatusColumn">
                    <el-input v-model="form.dbStatusColumn" />
                  </el-form-item>
                  <el-form-item label="吊销时间字段" prop="dbRevocationTimeColumn">
                    <el-input v-model="form.dbRevocationTimeColumn" />
                  </el-form-item>
                  <el-form-item label="吊销原因字段" prop="dbRevocationReasonColumn">
                    <el-input v-model="form.dbRevocationReasonColumn" />
                  </el-form-item>
                </div>
              </template>

              <template v-else>
                <div class="source-grid">
                  <el-form-item label="LDAP地址" prop="ldapUrl">
                    <el-input v-model="form.ldapUrl" placeholder="ldap://ldap.example.com:389" />
                  </el-form-item>
                  <el-form-item label="Base DN" prop="ldapBaseDn">
                    <el-input v-model="form.ldapBaseDn" />
                  </el-form-item>
                  <el-form-item label="Bind DN" prop="ldapBindDn">
                    <el-input v-model="form.ldapBindDn" />
                  </el-form-item>
                  <el-form-item label="密码引用" prop="ldapPasswordRef">
                    <el-input v-model="form.ldapPasswordRef" placeholder="ocsp/ldap/reader" />
                  </el-form-item>
                  <el-form-item label="搜索过滤器" prop="ldapSearchFilter" class="wide-item">
                    <el-input v-model="form.ldapSearchFilter" />
                  </el-form-item>
                  <el-form-item label="序列号属性" prop="ldapSerialNumberAttribute">
                    <el-input v-model="form.ldapSerialNumberAttribute" />
                  </el-form-item>
                  <el-form-item label="CA属性" prop="ldapCaIdAttribute">
                    <el-input v-model="form.ldapCaIdAttribute" />
                  </el-form-item>
                  <el-form-item label="状态属性" prop="ldapStatusAttribute">
                    <el-input v-model="form.ldapStatusAttribute" />
                  </el-form-item>
                  <el-form-item label="连接超时(ms)" prop="ldapConnectTimeout">
                    <el-input-number v-model="form.ldapConnectTimeout" :min="1000" :step="500" controls-position="right" class="full-input" />
                  </el-form-item>
                  <el-form-item label="读取超时(ms)" prop="ldapReadTimeout">
                    <el-input-number v-model="form.ldapReadTimeout" :min="1000" :step="500" controls-position="right" class="full-input" />
                  </el-form-item>
                </div>
              </template>
            </div>
          </el-form>
        </div>

        <div v-if="activeStep === 3" class="step-content">
          <el-result icon="success" title="初始化流程已完成" sub-title="请重新登录后进入 OCSP 服务看板。" />
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

<script setup name="OcspInit" lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { QuestionFilled, Refresh } from '@element-plus/icons-vue';
import { getOcspEnvInfo, getOcspInitStatus, initOcspResponder } from '@/api/ocsp/init';
import { assertSafeSignerCert, assertSafeSignerConf, unwrapOcspData } from '@/api/ocsp/common';
import { getTenant } from '@/api/system/tenant';
import { useUserStore } from '@/store/modules/user';
import Agreement from '@/components/Agreement/index.vue';
import ResponderCsrPanel from '@/views/ocsp/components/ResponderCsrPanel.vue';

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

const signerTypeOptions = ['SOFTWARE', 'HSM'];
const statusSourceOptions = ['DB', 'LDAP'];
const certSource = ref<'CSR' | 'PEM'>('CSR');
const softwareSignerConf =
  '{\n  "keyAlias": "ocsp-responder-key",\n  "algorithm": "SM3withSM2",\n  "keyStoreRef": "ocsp-db"\n}';

const form = reactive({
  name: 'default-ocsp-responder',
  caId: 1,
  signerType: 'SOFTWARE' as 'HSM' | 'SOFTWARE',
  signerConf: softwareSignerConf,
  signerCert: '',
  responseValidity: 3600,
  includeCerts: true,
  nonceEnabled: true,
  statusSourceType: 'DB' as 'DB' | 'LDAP',
  dbUrl: 'jdbc:mysql://localhost:3306/lcloud_ca',
  dbUsername: 'ocsp_readonly',
  dbPasswordRef: 'ocsp/db/ca-readonly',
  dbCertTable: 'ca_cert',
  dbSerialNumberColumn: 'serial_number',
  dbCaIdColumn: 'ca_id',
  dbStatusColumn: 'status',
  dbRevocationTimeColumn: 'revoke_time',
  dbRevocationReasonColumn: 'revoke_reason',
  ldapUrl: 'ldap://ldap.example.com:389',
  ldapBaseDn: 'ou=certificates,dc=example,dc=com',
  ldapBindDn: 'cn=ocsp-reader,ou=system,dc=example,dc=com',
  ldapPasswordRef: 'ocsp/ldap/reader',
  ldapSearchFilter: '(&(objectClass=pkiCertificate)(certificateSerialNumber={serialNumber})(caId={caId}))',
  ldapSerialNumberAttribute: 'certificateSerialNumber',
  ldapCaIdAttribute: 'caId',
  ldapStatusAttribute: 'certificateStatus',
  ldapConnectTimeout: 3000,
  ldapReadTimeout: 5000
});

const rules = reactive<FormRules>({
  name: [{ required: true, message: '请输入响应者名称', trigger: 'blur' }],
  caId: [{ required: true, message: '请输入CA ID', trigger: 'change' }],
  signerType: [{ required: true, message: '请选择签名者类型', trigger: 'change' }],
  signerCert: [
    {
      validator: (_rule, value, callback) => {
        if (certSource.value === 'CSR' && !String(value || '').trim()) {
          callback();
          return;
        }
        try {
          assertSafeSignerCert(value);
          callback();
        } catch (error: any) {
          callback(new Error(error.message || '请粘贴OCSP签名证书PEM'));
        }
      },
      trigger: 'blur'
    }
  ],
  signerConf: [
    { required: true, message: '请输入签名配置', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        try {
          assertSafeSignerConf(value);
          callback();
        } catch (error: any) {
          callback(new Error(error.message || '签名配置不合法'));
        }
      },
      trigger: 'blur'
    }
  ],
  responseValidity: [{ required: true, message: '请输入响应有效期', trigger: 'change' }],
  statusSourceType: [{ required: true, message: '请选择验证数据源', trigger: 'change' }],
  dbUrl: [{ required: true, message: '请输入数据库地址', trigger: 'blur' }],
  dbUsername: [{ required: true, message: '请输入数据库用户名', trigger: 'blur' }],
  dbPasswordRef: [{ required: true, message: '请输入数据库密码引用', trigger: 'blur' }],
  ldapUrl: [{ required: true, message: '请输入LDAP地址', trigger: 'blur' }],
  ldapBaseDn: [{ required: true, message: '请输入Base DN', trigger: 'blur' }],
  ldapBindDn: [{ required: true, message: '请输入Bind DN', trigger: 'blur' }],
  ldapPasswordRef: [{ required: true, message: '请输入LDAP密码引用', trigger: 'blur' }],
  ldapSearchFilter: [{ required: true, message: '请输入搜索过滤器', trigger: 'blur' }]
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

const allEnvOk = computed(() => {
  const requiredRows = envRows.value.filter((item) => item.name === 'OCSP业务库' || item.name === '平台租户');
  return requiredRows.length === 0 || requiredRows.every((item) => item.ok);
});
const canGoNext = computed(() => (activeStep.value === 0 ? agree.value : allEnvOk.value));

// 向导步骤状态仅同步前端内存。完成初始化时由 OCSP InitController.initResponder
// 把 sys_tenant.status 写成 -1。不要调用 admin 的 PUT /v1/tenants
// （该接口要求 write + sys:tenant:modify，引导账号不具备，会返回 Access Denied）。
const syncTenantInitStatus = (statusValue: number) => {
  userStore.setTenantInitStatus(statusValue);
};

const loadInitInfo = async () => {
  try {
    const res = await getOcspInitStatus();
    const data: any = unwrapOcspData(res);
    if (Boolean(data?.initialized ?? data?.init ?? data)) {
      activeStep.value = 3;
    }
  } catch (error) {}
  await loadEnvInfo();
};

const loadEnvInfo = async () => {
  envLoading.value = true;
  try {
    const res = await getOcspEnvInfo();
    envRows.value = normalizeEnvRows(unwrapOcspData(res));
  } catch (error) {
    envRows.value = [
      {
        name: 'OCSP 初始化接口',
        value: '/ocsp/v1/init/env',
        message: '接口暂不可用，请确认后端是否已启用初始化控制器。',
        ok: false
      }
    ];
  } finally {
    envLoading.value = false;
  }
};

const next = async () => {
  if (!canGoNext.value) return;
  loading.value = true;
  try {
    activeStep.value++;
    syncTenantInitStatus(activeStep.value);
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
      syncTenantInitStatus(activeStep.value);
    } finally {
      loading.value = false;
    }
  }
};

watch(
  () => form.signerType,
  (type) => {
    if (type === 'HSM') {
      certSource.value = 'PEM';
      return;
    }
    if (!form.signerCert) {
      certSource.value = 'CSR';
      if (!String(form.signerConf || '').includes('ocsp-db')) {
        form.signerConf = softwareSignerConf;
      }
    }
  }
);

const submitInit = async () => {
  if (!formRef.value) return;
  if (certSource.value === 'CSR' && !form.signerCert.trim()) {
    ElMessage.error('请先导入 CA 签发的响应者证书');
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  try {
    assertSafeSignerCert(form.signerCert);
    assertSafeSignerConf(form.signerConf);
  } catch (error: any) {
    ElMessage.error(error.message || '签名配置不合法');
    return;
  }
  loading.value = true;
  try {
    await initOcspResponder({
      name: form.name,
      caId: form.caId,
      signerCert: form.signerCert,
      signerType: form.signerType,
      signerConf: form.signerConf,
      responseValidity: form.responseValidity,
      includeCerts: form.includeCerts,
      nonceEnabled: form.nonceEnabled,
      statusSource: {
        type: form.statusSourceType,
        db:
          form.statusSourceType === 'DB'
            ? {
                url: form.dbUrl,
                username: form.dbUsername,
                passwordRef: form.dbPasswordRef,
                certTable: form.dbCertTable,
                serialNumberColumn: form.dbSerialNumberColumn,
                caIdColumn: form.dbCaIdColumn,
                statusColumn: form.dbStatusColumn,
                revocationTimeColumn: form.dbRevocationTimeColumn,
                revocationReasonColumn: form.dbRevocationReasonColumn
              }
            : undefined,
        ldap:
          form.statusSourceType === 'LDAP'
            ? {
                url: form.ldapUrl,
                baseDn: form.ldapBaseDn,
                bindDn: form.ldapBindDn,
                passwordRef: form.ldapPasswordRef,
                searchFilter: form.ldapSearchFilter,
                serialNumberAttribute: form.ldapSerialNumberAttribute,
                caIdAttribute: form.ldapCaIdAttribute,
                statusAttribute: form.ldapStatusAttribute,
                connectTimeout: form.ldapConnectTimeout,
                readTimeout: form.ldapReadTimeout
              }
            : undefined
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
    ElMessage.success('初始化完成，请重新登录后进入看板');
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
        const tenantInfo: any = tenantRes.data;
        tenantCode.value = tenantInfo.code || 'ocsp';
        tenantName.value = tenantInfo.name || '在线证书状态服务';
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
