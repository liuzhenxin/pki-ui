<template>
  <main class="app-container svs-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading">
        <div>
          <p class="heading-label">签名验签服务器</p>
          <h1>SVS 初始化向导</h1>
        </div>
      </div>
      <el-steps :active="step + 1" finish-status="success" class="init-steps" align-center>
        <el-step v-for="title in titles" :key="title" :title="title" />
      </el-steps>
      <div class="wizard-content">
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="notice" />
        <section v-if="step === -1" class="step-content">
          <div class="step-title">
            <h2>欢迎使用 SVS</h2>
            <p>请阅读并确认用户协议后继续初始化。</p>
          </div>
          <div class="agreement-text" tabindex="0" aria-label="SVS 用户协议">
            <Agreement tenant-code="svs" tenant-name="签名验签服务器" />
          </div>
          <el-checkbox v-model="agreed" class="agreement-footer">我已阅读并同意用户协议</el-checkbox>
        </section>
        <section v-else-if="step === 0" class="step-content env-step">
          <div class="step-header">
            <div>
              <h2>环境检查</h2>
              <p>确认初始化所需的平台、业务数据库、管理员账号及密码设备已经准备完成。</p>
            </div>
            <div class="header-actions">
              <el-button :disabled="loading || saving" @click="showEnvHelp = true">检查说明</el-button>
              <el-button :icon="Refresh" :loading="loading" :disabled="saving" @click="load">重新检测</el-button>
            </div>
          </div>
          <el-drawer v-model="showEnvHelp" title="SVS 环境检查说明" size="min(450px, 100vw)">
            <p>初始化前确认平台连接、业务数据库、三个固定管理员账号和密码设备已就绪，避免产生不完整配置。</p>
            <p>检查失败时请根据提示处理后重新检测。此页面不创建账号、不修改口令或设备配置。</p>
            <p>设备密钥选择及真实签名验签自测将在后续步骤完成。</p>
          </el-drawer>
          <div v-if="state && !loading" class="env-summary" role="status">
            <div class="env-summary-card" :class="allEnvOk ? 'env-summary-ok' : 'env-summary-fail'">
              <div class="env-summary-text">
                <div class="env-summary-title">{{ allEnvOk ? '环境检查全部通过' : '环境检查存在异常' }}</div>
                <div class="env-summary-desc">
                  共 {{ environment.length }} 项检测，{{ okCount }} 项正常，{{ environment.length - okCount }} 项异常
                </div>
              </div>
            </div>
          </div>
          <div v-if="state" class="env-cards">
            <div v-for="check in environment" :key="check.name" class="env-card" :class="check.ok ? 'env-card-ok' : 'env-card-fail'">
              <div class="env-card-body">
                <div class="env-card-header">
                  <strong class="env-card-name">{{ check.name }}</strong>
                  <el-tag :type="check.ok ? 'success' : 'danger'">{{ check.ok ? '正常' : '异常' }}</el-tag>
                </div>
                <p class="env-card-message">{{ check.message }}</p>
              </div>
            </div>
          </div>
          <el-empty v-else-if="!loading" description="暂无环境检查结果，请重新检测" />
          <el-alert
            v-if="state && !state.canInitialize"
            title="请使用具有初始化权限的系统管理员操作。"
            type="info"
            :closable="false"
            class="notice"
          />
        </section>
        <section v-else-if="step === 1" class="step-content">
          <div class="step-title">
            <h2>主机类型</h2>
            <p>首期支持独立主机部署。</p>
          </div>
          <el-radio-group model-value="STANDALONE"
            ><el-radio value="STANDALONE">独立主机</el-radio><el-radio value="PRIMARY" disabled>双机热备主节点</el-radio
            ><el-radio value="SECONDARY" disabled>双机热备备节点</el-radio><el-radio value="CLUSTER" disabled>集群节点</el-radio></el-radio-group
          >
        </section>
        <section v-else-if="step === 2" class="step-content">
          <div class="step-title">
            <h2>设备初始化</h2>
            <p>核验设备内已有 SM2 密钥，复用密钥完成初始化准备。</p>
          </div>
          <el-form label-width="140px"
            ><el-form-item label="设备签名密钥"
              ><el-select v-model="keyId" placeholder="选择已配置的 SM2 密钥"
                ><el-option v-for="key in plan?.keys || []" :key="key" :label="key" :value="key" /></el-select></el-form-item
          ></el-form>
          <el-alert
            v-if="!plan?.keys.length"
            title="尚无启用的 SM2 密钥引用，请在下方选择已有设备密钥并登记。"
            type="warning"
            :closable="false"
            class="notice"
          />
          <el-divider>登记已有设备密钥</el-divider>
          <p>选择部署人员已配置的 SM2 密钥，核验公钥后登记引用。初始化完成后由安全管理员维护。</p>
          <el-button :loading="loading" :disabled="saving" @click="readDeviceKeys">读取设备密钥</el-button>
          <el-form label-width="140px">
            <el-form-item label="设备密钥别名">
              <el-select v-model="deviceAlias" placeholder="选择已有 SM2 密钥" :disabled="saving">
                <el-option v-for="(_, alias) in deviceKeys" :key="alias" :label="String(alias)" :value="String(alias)" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="deviceAlias" label="公钥指纹（SHA-256）">
              <span class="device-fingerprint">{{ deviceKeys[deviceAlias] }}</span>
            </el-form-item>
          </el-form>
          <el-button type="primary" :loading="saving" :disabled="loading || !deviceKeys[deviceAlias]" @click="registerDeviceKey">
            核验并登记引用
          </el-button>
          <p v-if="!loading && !Object.keys(deviceKeys).length">未读取到可用 SM2 公钥，请点击读取；仍为空时联系部署人员检查设备配置与连接。</p>
          <p>私钥始终保留在 SDF/HSM 内。本步骤不生成或覆盖密钥；设备证书在初始化后的管理界面维护。</p>
        </section>
        <section v-else-if="step === 3 || step === 4" class="step-content">
          <div class="step-header">
            <div>
              <h2>{{ titles[step + 1] }}</h2>
              <p>读取现有部署参数进行核验。</p>
            </div>
            <el-button :loading="loading" @click="refreshPlan">重新读取</el-button>
          </div>
          <el-descriptions :column="1" border
            ><el-descriptions-item v-for="(value, key) in deploymentRows" :key="key" :label="String(key)">{{
              value
            }}</el-descriptions-item></el-descriptions
          >
          <el-alert
            title="无法自动核验的项目请由运维确认。此向导不修改网卡、网关、DNS/NTP、白名单或平台会话策略。"
            type="info"
            :closable="false"
            class="notice"
          />
          <el-checkbox v-model="reviewed">我已核对当前参数及需运维确认的项目</el-checkbox>
        </section>
        <section v-else-if="step === 5" class="step-content">
          <div class="step-title">
            <h2>管理员绑定</h2>
            <p>固定绑定三个独立平台账号，请确认账号和角色已就绪。</p>
          </div>
          <el-alert title="三个固定账号职责独立；各角色按权限直接执行，操作全程留痕。" type="info" :closable="false" show-icon />
          <el-form class="init-form" label-width="170px"
            ><el-form-item v-for="(label, index) in labels" :key="label" :label="label"
              ><el-input :model-value="users[index]" readonly /></el-form-item
          ></el-form>
          <div v-for="row in validation?.rows" :key="row.username" class="check-row">
            <div>
              <strong>{{ row.username }}</strong>
              <p>{{ row.message }}</p>
            </div>
            <el-tag :type="row.valid ? 'success' : 'danger'">{{ row.valid ? '通过' : '未通过' }}</el-tag>
          </div>
        </section>
        <section v-else-if="step === 6" class="step-content">
          <div class="step-title">
            <h2>初始化验证</h2>
            <p>使用所选设备密钥完成真实 SM2 签名、验签和篡改数据拒绝测试，并记录审计日志。</p>
          </div>
          <el-button type="primary" plain :loading="saving" @click="verify">执行签名验签自测</el-button>
          <el-alert
            v-if="verified"
            title="自测通过。结果有效期为 5 分钟，配置或密钥变化后必须重新验证。"
            type="success"
            :closable="false"
            class="notice"
          />
          <el-descriptions :column="1" border
            ><el-descriptions-item label="主机类型">独立主机</el-descriptions-item
            ><el-descriptions-item label="设备密钥">{{ keyId }}</el-descriptions-item
            ><el-descriptions-item v-for="(label, index) in labels" :key="label" :label="label">{{
              users[index]
            }}</el-descriptions-item></el-descriptions
          >
          <el-alert title="确认后绑定三个账号并锁定初始化。设备证书后续维护，不作为完成条件。" type="warning" :closable="false" class="notice" />
          <el-checkbox v-model="confirmed">我已核对配置及账号，确认完成初始化</el-checkbox>
        </section>
        <section v-else class="step-content">
          <el-result icon="success" title="初始化已完成" sub-title="平台账号已绑定，初始化已锁定。" />
          <p>后续在管理界面维护设备证书及业务应用接入。</p>
        </section>
      </div>
      <div class="wizard-actions">
        <el-button :disabled="step === -1 || step === 7 || loading || saving" @click="back">上一步</el-button>
        <el-button v-if="step < 6" type="primary" :loading="saving" :disabled="!canContinue" @click="next">{{
          step === 5 ? '校验并继续' : '下一步'
        }}</el-button>
        <el-button v-else-if="step === 6" type="primary" :loading="saving" :disabled="!verified || !confirmed" @click="complete"
          >确认并完成初始化</el-button
        >
        <el-button v-else type="primary" :loading="saving" @click="enterManagement">进入管理台</el-button>
      </div>
    </el-card>
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissionStore } from '@/store/modules/permission';
import { Refresh } from '@element-plus/icons-vue';
import Agreement from '@/components/Agreement/index.vue';
import {
  getSvsInitialization,
  completeSvsInitialization,
  validateSvsInitAccounts,
  getSvsInitPlan,
  getSvsInitDeviceKeys,
  registerSvsInitDeviceKey,
  reviewSvsInitStep,
  type Initialization,
  type AccountValidation,
  type InitPlan
} from '@/api/svs/init';
const router = useRouter();
const titles = ['协议', '环境检查', '主机类型', '设备初始化', '网络与服务配置', '安全策略', '管理员绑定', '初始化验证', '完成'];
const labels = ['系统管理员', '安全管理员', '审计管理员'];
const users = ['admin', 'secadmin', 'auditor'] as const;
const subjects = { admin: 'SYSADMIN', secadmin: 'SECADMIN', auditor: 'AUDITOR' };
const state = ref<Initialization>(),
  plan = ref<InitPlan>(),
  validation = ref<AccountValidation>();
// The agreement is page-only; business steps retain the existing server indices 0–6.
const step = ref(-1),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  keyId = ref('');
const deviceKeys = ref<Record<string, string>>({}),
  deviceAlias = ref('');
const reviewed = ref(false),
  confirmed = ref(false),
  verified = ref(false);
const agreed = ref(false),
  showEnvHelp = ref(false),
  resumeStep = ref(0);
const environment = computed(() => [
  {
    name: '平台连接',
    ok: !!state.value?.platformTenantValid,
    message: state.value?.platformTenantValid ? '平台连接与应用配置核验通过。' : '平台连接或应用配置异常，请联系部署人员检查。'
  },
  { name: '业务数据库', ok: !!state.value?.databaseReady, message: '初始化记录必须可正常读取。' },
  {
    name: '管理员账号',
    ok: !!validation.value?.ready,
    message: validation.value?.ready ? '三个固定管理员账号与角色已就绪。' : '请确认 admin、secadmin、auditor 账号及对应角色已就绪后重新检测。'
  },
  { name: '密码设备', ok: !!state.value?.deviceReady, message: state.value?.deviceReady ? '密码设备已就绪。' : '请检查设备连接及服务运行状态。' }
]);
const okCount = computed(() => environment.value.filter((check) => check.ok).length);
const allEnvOk = computed(() => !!state.value && environment.value.every((check) => check.ok));
const canContinue = computed(() =>
  step.value === -1
    ? agreed.value && !loading.value && !saving.value
    : agreed.value &&
      !!state.value?.canInitialize &&
      !loading.value &&
      !saving.value &&
      allEnvOk.value &&
      (step.value !== 2 || !!keyId.value) &&
      (![3, 4].includes(step.value) || reviewed.value)
);
const networkFields = ['服务监听地址', '服务监听端口', '后端通信', '管理端口', '网关、DNS、NTP及VLAN', '已启用网卡地址'];
const deploymentRows = computed(() =>
  Object.fromEntries(
    Object.entries(plan.value?.deployment || {}).filter(
      ([key]) => !['networkReady', 'securityReady'].includes(key) && (step.value === 3 ? networkFields.includes(key) : !networkFields.includes(key))
    )
  )
);
function message(e: any) {
  return e?.response?.data?.Status?.Msg || e?.response?.data?.msg || e?.message || '操作未完成，请重试或检查服务状态';
}
async function refreshPlan() {
  loading.value = true;
  error.value = '';
  reviewed.value = false;
  verified.value = false;
  confirmed.value = false;
  try {
    plan.value = await getSvsInitPlan();
  } catch (e) {
    error.value = message(e);
  } finally {
    loading.value = false;
  }
}
async function readDeviceKeys() {
  loading.value = true;
  error.value = '';
  deviceKeys.value = {};
  deviceAlias.value = '';
  try {
    deviceKeys.value = await getSvsInitDeviceKeys();
  } catch (e) {
    error.value = message(e);
  } finally {
    loading.value = false;
  }
}
async function registerDeviceKey() {
  if (saving.value || loading.value || !deviceKeys.value[deviceAlias.value]) return;
  saving.value = true;
  error.value = '';
  verified.value = false;
  confirmed.value = false;
  try {
    const registered = await registerSvsInitDeviceKey(deviceAlias.value, deviceKeys.value[deviceAlias.value]);
    keyId.value = registered.keyId;
    plan.value = await getSvsInitPlan();
    deviceKeys.value = {};
    deviceAlias.value = '';
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function load() {
  loading.value = true;
  error.value = '';
  validation.value = undefined;
  verified.value = false;
  confirmed.value = false;
  try {
    state.value = await getSvsInitialization();
    if (state.value.locked) step.value = 7;
    else if (state.value.canInitialize) {
      plan.value = await getSvsInitPlan();
      keyId.value = plan.value.keyId;
      resumeStep.value = Math.min(plan.value.nextStep, 6);
      validation.value = await validateSvsInitAccounts(subjects);
    }
  } catch (e) {
    state.value = undefined;
    plan.value = undefined;
    error.value = message(e);
  } finally {
    loading.value = false;
  }
}
function back() {
  step.value--;
  reviewed.value = false;
  confirmed.value = false;
  verified.value = false;
  error.value = '';
}
async function next() {
  if (!canContinue.value || saving.value) return;
  if (step.value === -1) {
    step.value = 0;
    if (!state.value) await load();
    return;
  }
  // A resumed draft has already passed preflight; inspecting it must not rewind the server draft.
  if (step.value === 0 && resumeStep.value > 0) {
    step.value = resumeStep.value;
    resumeStep.value = 0;
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    if (step.value === 5) {
      validation.value = await validateSvsInitAccounts(subjects);
      if (!validation.value.ready) return;
    }
    plan.value = await reviewSvsInitStep(step.value, keyId.value, plan.value?.deploymentRevision);
    step.value++;
    reviewed.value = false;
    verified.value = false;
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function verify() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  verified.value = false;
  confirmed.value = false;
  try {
    plan.value = await reviewSvsInitStep(6, keyId.value, plan.value?.deploymentRevision);
    verified.value = true;
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function complete() {
  if (!confirmed.value || !verified.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await completeSvsInitialization(subjects);
    step.value = 7;
  } catch (e) {
    error.value = message(e);
    confirmed.value = false;
    verified.value = false;
  } finally {
    saving.value = false;
  }
}
async function enterManagement() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const routes = await usePermissionStore().generateRoutes();
    routes.forEach((route) => router.addRoute(route));
    await router.replace('/svs/home');
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.svs-init-page {
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

.agreement-text {
  max-height: 420px;
  overflow-y: auto;
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.agreement-footer {
  margin-top: 20px;
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

.env-card-message {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.el-select {
  width: 100%;
}
.notice {
  margin: 20px 0;
}
.check-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.check-row p {
  color: var(--el-text-color-secondary);
  margin: 6px 0;
}
@media (max-width: 768px) {
  .init-steps {
    flex-wrap: wrap;
    gap: 12px 0;
  }
  .init-steps :deep(.el-step) {
    flex-basis: 33.333% !important;
    min-width: 0;
  }
  .svs-init-page {
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
  .wizard-actions {
    flex-wrap: wrap;
  }
}
</style>

<style scoped>
.device-fingerprint {
  overflow-wrap: anywhere;
}
</style>
