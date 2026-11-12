<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { ElForm, ElFormItem } from 'element-plus';
import Agreement from '@/components/Agreement/index.vue';
import { CSP_AGREEMENT_VERSION } from '@/products/csp/agreement';
import { useCspInstallationStore } from '@/store/modules/cspInstallation';
const store = useCspInstallationStore();
const router = useRouter();
onMounted(() => store.refresh());
const {
  initialized,
  completion,
  setupStep,
  setup,
  initializationAttempted,
  busy,
  error,
  environmentReady,
  accountTransport,
  secure,
  certificateEnabled,
  checkedAt
} = storeToRefs(store);
const accepted = ref(false);
const accounts = [
  { role: 'SYSTEM_ADMIN', username: 'admin', password: ref(''), repeat: ref(''), certificate: ref('') },
  { role: 'AUDIT_ADMIN', username: 'auditor', password: ref(''), repeat: ref(''), certificate: ref('') }
] as const;
const roleNames = { SYSTEM_ADMIN: '系统管理员', AUDIT_ADMIN: '审计管理员' };
const visibleStep = computed(() => (initialized.value ? 3 : Math.min(setupStep.value, 2)));
const credentialsReady = computed(
  () =>
    accounts[0].password.value !== accounts[1].password.value &&
    accounts.every(
      ({ password, repeat }) =>
        password.value.trim().length > 0 &&
        Array.from(password.value).length >= 12 &&
        new TextEncoder().encode(password.value).length <= 72 &&
        password.value === repeat.value
    )
);
function clearCredentials() {
  for (const account of accounts) {
    account.password.value = '';
    account.repeat.value = '';
    account.certificate.value = '';
  }
}
watch(visibleStep, clearCredentials);
async function finish() {
  if (busy.value || !environmentReady.value || !credentialsReady.value || !secure.value) return;
  const [admin, auditor] = accounts.map((account) => ({
    password: account.password.value,
    ...(certificateEnabled.value && account.certificate.value.trim() ? { certPem: account.certificate.value.trim() } : {})
  }));
  try {
    await store.initialize(admin, auditor);
  } finally {
    clearCredentials();
  }
}
const accountChecks = computed(() =>
  (['SYSTEM_ADMIN', 'AUDIT_ADMIN'] as const).map((role) => ({
    role,
    valid: setup.value?.accounts.find((account) => account.role === role)?.valid
  }))
);
const agreementAvailable = computed(() => Boolean(setup.value?.agreementVersion === CSP_AGREEMENT_VERSION && setup.value?.companyName));
async function refresh() {
  await store.refresh();
  await router.replace(store.destination);
}
async function logout() {
  await store.logout();
  if (!store.signedIn) await router.replace('/login');
}
</script>
<template>
  <div class="app-container csp-page csp-init-page">
    <el-card class="init-card" shadow="never">
      <header class="init-heading">
        <p class="heading-label">密码服务平台</p>
        <h1>安装初始化</h1>
      </header>
      <ol class="setup-steps" aria-label="初始化进度">
        <li
          v-for="(title, index) in ['协议', '环境检查', '账号初始化', '完成']"
          :key="title"
          :class="{ current: visibleStep === index, done: visibleStep > index || initialized }"
          :aria-current="visibleStep === index ? 'step' : undefined"
        >
          <span aria-hidden="true">{{ index + 1 }}</span
          >{{ title }}
        </li>
      </ol>
      <div class="wizard-content">
        <section v-if="initialized" class="step-content" aria-live="polite">
          <span class="status-tag">已完成初始化</span>
          <h2>{{ completion ? '初始化成功，请重新登录' : 'CSP 已完成初始化' }}</h2>
          <p class="muted">一次性初始化入口已锁定。设备、资源池、业务密钥、设备证书、应用接入和信任策略在管理功能中配置。</p>
          <el-button type="primary" :loading="busy" @click="logout">退出并重新登录</el-button>
        </section>
        <section v-else-if="initializationAttempted || initialized === null || !setup" class="step-content">
          <h2>{{ initializationAttempted ? '提交结果需要核查' : '需要确认初始化状态' }}</h2>
          <p>已有提交尝试时只查询结果。未确认成功前，请联系运维核查，不能重新提交或重置。</p>
          <el-button :loading="busy" @click="refresh">刷新状态</el-button>
        </section>
        <section v-else class="step-content" :aria-busy="busy">
          <template v-if="setupStep === 0">
            <header class="step-title">
              <h2>公共用户协议</h2>
              <p>请阅读并确认用户协议后继续初始化。</p>
            </header>
            <div v-if="agreementAvailable" class="agreement-scroll" tabindex="0" aria-label="公共用户协议正文">
              <Agreement tenant-code="csp" tenant-name="密码服务平台" :company-name="setup.companyName" />
            </div>
            <p v-else class="notice" role="status">协议版本或权利主体尚未配置，请联系运维。</p>
            <label class="setup-confirm agreement-confirm"
              ><input v-model="accepted" type="checkbox" :disabled="busy || !agreementAvailable" />我已阅读并同意公共用户协议</label
            >
            <div class="wizard-actions">
              <el-button type="primary" :disabled="busy || !accepted || !agreementAvailable || !accountTransport" @click="store.advanceSetup('AGREE')"
                >同意并继续</el-button
              >
            </div>
          </template>
          <template v-else-if="setupStep === 1">
            <header class="step-title">
              <h2>环境检查</h2>
              <p>确认 CSP 业务库、平台租户和两员预置账号已准备就绪。</p>
            </header>
            <ul class="environment-list" aria-label="环境检测结果">
              <li><strong>平台及 CSP 业务库</strong><span>待检测，执行检测成功后确认</span></li>
              <li v-for="account in accountChecks" :key="account.role">
                <strong>{{ roleNames[account.role] }}</strong>
                <span :class="{ 'check-ok': account.valid === true, 'check-failed': account.valid === false }">{{
                  account.valid === undefined ? '待核验' : account.valid ? '核验通过' : '未通过，请核查预置账号和角色权限'
                }}</span>
              </li>
              <li><strong>密码设备</strong><span>未核验，初始化后配置并执行真实自测</span></li>
            </ul>
            <div class="wizard-actions">
              <el-button type="primary" :loading="busy" :disabled="busy || !accountTransport" @click="store.advanceSetup('CHECK_ENV')"
                >检测并继续</el-button
              >
            </div>
          </template>
          <template v-else>
            <header class="step-title">
              <h2>账号初始化</h2>
              <p>为两个预置账号设置不同的登录密码。每个密码至少 12 个字符，最多 72 个 UTF-8 字节。</p>
            </header>
            <p v-if="!secure" class="notice">请通过 HTTPS 或本机安全入口设置管理员凭据。</p>
            <p v-if="!environmentReady" class="notice" role="status">账号核验未通过，请重新检测环境。</p>
            <el-form
              id="csp-account-form"
              class="account-form"
              label-width="auto"
              :disabled="busy || !secure || !environmentReady"
              @submit.prevent="finish"
            >
              <section v-for="account in accounts" :key="account.role" class="account-section" role="group" :aria-labelledby="account.role">
                <h3 :id="account.role">{{ roleNames[account.role] }}</h3>
                <el-form-item label="用户名">
                  <el-input :model-value="account.username" readonly />
                </el-form-item>
                <el-form-item label="登录密码" required>
                  <el-input v-model="account.password.value" type="password" autocomplete="new-password" show-password />
                </el-form-item>
                <el-form-item
                  label="确认密码"
                  required
                  :error="account.repeat.value && account.repeat.value !== account.password.value ? '两次输入的密码不一致' : ''"
                >
                  <el-input v-model="account.repeat.value" type="password" autocomplete="new-password" show-password />
                </el-form-item>
                <el-form-item v-if="certificateEnabled" label="证书 PEM（可选）">
                  <el-input
                    v-model="account.certificate.value"
                    type="textarea"
                    :rows="4"
                    maxlength="12000"
                    :spellcheck="false"
                    placeholder="可粘贴 SM2 登录证书 PEM"
                  />
                </el-form-item>
              </section>
            </el-form>
            <div class="wizard-actions">
              <el-button :disabled="busy || !accountTransport" @click="store.advanceSetup('CHECK_ENV')">重新检测</el-button>
              <el-button
                type="primary"
                native-type="submit"
                form="csp-account-form"
                :loading="busy"
                :disabled="busy || !environmentReady || !secure || !credentialsReady"
              >
                提交初始化
              </el-button>
            </div>
          </template>
        </section>
        <p v-if="error" class="error step-content" role="alert">{{ error }}</p>
        <p v-if="checkedAt" class="muted step-content check-time">最近核验 {{ checkedAt }} · Asia/Shanghai</p>
      </div>
    </el-card>
  </div>
</template>
<style scoped>
.csp-init-page {
  min-height: calc(100dvh - 96px);
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
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.heading-label,
.step-title p {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
.init-heading h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
}
.wizard-content {
  min-height: 480px;
  padding: 28px 0 8px;
}
.step-content {
  max-width: 960px;
  margin-inline: auto;
}
.step-content h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
}
.step-title {
  margin-bottom: 18px;
}
.agreement-confirm {
  justify-content: flex-end;
  margin: 12px 0;
}
.wizard-actions {
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.check-time {
  margin-top: 14px;
  font-size: 13px;
}
.environment-list li {
  padding: 12px 16px;
  margin-bottom: 8px;
}
.account-form {
  max-width: 720px;
  margin: 0 auto;
}
.account-section {
  padding: 18px 20px 4px;
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}
.account-section h3 {
  margin: 0 0 18px;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
}
.agreement-scroll {
  max-height: 22rem;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.setup-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 14px;
  padding: 12px 18px;
  margin: 18px 0 0;
  border: 0;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.setup-steps li {
  min-width: 0;
  gap: 8px;
  font-size: 14px;
}
.setup-steps li > span {
  width: 24px;
  height: 24px;
}
.setup-steps .done {
  color: var(--el-color-success-dark-2);
}
.setup-steps .current {
  color: var(--el-color-primary);
}
.muted {
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .csp-init-page {
    padding: 12px;
  }
  .setup-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 10px;
  }
  .wizard-content {
    min-height: 0;
    padding-top: 20px;
  }
  .environment-list li {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .account-section {
    padding-inline: 12px;
  }
  .account-section :deep(.el-form-item) {
    display: block;
  }
  .account-section :deep(.el-form-item__label) {
    justify-content: flex-start;
  }
  .wizard-actions {
    flex-wrap: wrap;
  }
}
</style>
