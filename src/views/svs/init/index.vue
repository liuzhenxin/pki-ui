<template>
  <main class="app-container svs-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading"><div><p class="heading-label">签名验签服务器</p><h1>SVS 初始化向导</h1></div></div>
      <el-steps :active="step" finish-status="success" class="init-steps" align-center>
        <el-step v-for="title in titles" :key="title" :title="title" />
      </el-steps>
      <div class="wizard-content">
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="notice" />
        <section v-if="step === 0" class="step-content">
          <div class="step-header"><div><h2>前置检查</h2><p>确认平台租户、业务数据库及密码设备已经准备完成。</p></div><el-button :icon="Refresh" :loading="loading" @click="load">重新检查</el-button></div>
          <div v-for="check in environment" :key="check.name" class="check-row"><div><strong>{{ check.name }}</strong><p>{{ check.message }}</p></div><el-tag :type="check.ok ? 'success' : 'danger'">{{ check.ok ? '正常' : '异常' }}</el-tag></div>
          <el-alert v-if="state && !state.canInitialize" title="请使用具有初始化权限的系统管理员操作。" type="info" :closable="false" class="notice" />
        </section>
        <section v-else-if="step === 1" class="step-content">
          <div class="step-title"><h2>主机类型</h2><p>首期支持独立主机部署。</p></div>
          <el-radio-group model-value="STANDALONE"><el-radio value="STANDALONE">独立主机</el-radio><el-radio value="PRIMARY" disabled>双机热备主节点</el-radio><el-radio value="SECONDARY" disabled>双机热备备节点</el-radio><el-radio value="CLUSTER" disabled>集群节点</el-radio></el-radio-group>
        </section>
        <section v-else-if="step === 2" class="step-content">
          <div class="step-title"><h2>设备初始化</h2><p>核验设备内已有 SM2 密钥，复用密钥完成初始化准备。</p></div>
          <el-form label-width="140px"><el-form-item label="设备签名密钥"><el-select v-model="keyId" placeholder="选择已配置的 SM2 密钥"><el-option v-for="key in plan?.keys || []" :key="key" :label="key" :value="key" /></el-select></el-form-item></el-form>
          <el-alert v-if="!plan?.keys.length" title="尚无启用的 SM2 密钥引用，请先由部署人员配置设备密钥引用，再重新检查。" type="warning" :closable="false" class="notice" />
          <p>私钥始终保留在 SDF/HSM 内。本步骤不生成或覆盖密钥；设备证书在初始化后的管理界面维护。</p>
        </section>
        <section v-else-if="step === 3 || step === 4" class="step-content">
          <div class="step-header"><div><h2>{{ titles[step] }}</h2><p>读取现有部署参数进行核验。</p></div><el-button :loading="loading" @click="refreshPlan">重新读取</el-button></div>
          <el-descriptions :column="1" border><el-descriptions-item v-for="(value, key) in deploymentRows" :key="key" :label="String(key)">{{ value }}</el-descriptions-item></el-descriptions>
          <el-alert title="无法自动核验的项目请由运维确认。此向导不修改网卡、网关、DNS/NTP、白名单或平台会话策略。" type="info" :closable="false" class="notice" />
          <el-checkbox v-model="reviewed">我已核对当前参数及需运维确认的项目</el-checkbox>
        </section>
        <section v-else-if="step === 5" class="step-content">
          <div class="step-title"><h2>管理员绑定</h2><p>固定绑定四个独立平台账号，请确认租户 9 的账号和角色已就绪。</p></div>
          <el-alert title="两名安全管理员权限相同，可审批他人的申请，禁止自审批。" type="info" :closable="false" show-icon />
          <el-form class="init-form" label-width="170px"><el-form-item v-for="(label, index) in labels" :key="label" :label="label"><el-input :model-value="users[index]" readonly /></el-form-item></el-form>
          <div v-for="row in validation?.rows" :key="row.username" class="check-row"><div><strong>{{ row.username }}</strong><p>{{ row.message }}</p></div><el-tag :type="row.valid ? 'success' : 'danger'">{{ row.valid ? '通过' : '未通过' }}</el-tag></div>
        </section>
        <section v-else-if="step === 6" class="step-content">
          <div class="step-title"><h2>初始化验证</h2><p>使用所选设备密钥完成真实 SM2 签名、验签和篡改数据拒绝测试，并记录审计日志。</p></div>
          <el-button type="primary" plain :loading="saving" @click="verify">执行签名验签自测</el-button>
          <el-alert v-if="verified" title="自测通过。结果有效期为 5 分钟，配置或密钥变化后必须重新验证。" type="success" :closable="false" class="notice" />
          <el-descriptions :column="1" border><el-descriptions-item label="主机类型">独立主机</el-descriptions-item><el-descriptions-item label="设备密钥">{{ keyId }}</el-descriptions-item><el-descriptions-item v-for="(label, index) in labels" :key="label" :label="label">{{ users[index] }}</el-descriptions-item></el-descriptions>
          <el-alert title="确认后绑定四个账号并锁定初始化。设备证书后续维护，不作为完成条件。" type="warning" :closable="false" class="notice" />
          <el-checkbox v-model="confirmed">我已核对配置及账号，确认完成初始化</el-checkbox>
        </section>
        <section v-else class="step-content"><el-result icon="success" title="初始化已完成" sub-title="平台账号已绑定，初始化已锁定。" /><p>后续在管理界面维护设备证书及业务应用接入。</p></section>
      </div>
      <div class="wizard-actions">
        <el-button :disabled="step === 0 || step === 7 || loading || saving" @click="back">上一步</el-button>
        <el-button v-if="step < 6" type="primary" :loading="saving" :disabled="!canContinue" @click="next">{{ step === 5 ? '校验并继续' : '下一步' }}</el-button>
        <el-button v-else-if="step === 6" type="primary" :loading="saving" :disabled="!verified || !confirmed" @click="complete">确认并完成初始化</el-button>
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
import { getSvsInitialization, completeSvsInitialization, validateSvsInitAccounts, getSvsInitPlan, reviewSvsInitStep, type Initialization, type AccountValidation, type InitPlan } from '@/api/svs/init';
const router = useRouter();
const titles = ['前置检查', '主机类型', '设备初始化', '网络与服务配置', '安全策略', '管理员绑定', '初始化验证', '完成'];
const labels = ['系统管理员', '安全管理员（申请）', '安全管理员（审批）', '审计员'];
const users = ['admin', 'secadmin', 'secadmin2', 'auditor'] as const;
const subjects = { admin: 'SYSADMIN', secadmin: 'SECADMIN', secadmin2: 'SECADMIN', auditor: 'AUDITOR' };
const state = ref<Initialization>(), plan = ref<InitPlan>(), validation = ref<AccountValidation>();
const step = ref(0), loading = ref(false), saving = ref(false), error = ref(''), keyId = ref('');
const reviewed = ref(false), confirmed = ref(false), verified = ref(false);
const environment = computed(() => [
  { name: '平台连接与产品租户', ok: !!state.value?.platformTenantValid, message: '产品租户须为 9 / svs。' },
  { name: '业务数据库', ok: !!state.value?.databaseReady, message: '初始化记录必须可正常读取。' },
  { name: '密码设备', ok: !!state.value?.deviceReady, message: state.value?.deviceReady ? '密码设备已就绪。' : '请检查设备连接及服务运行状态。' }
]);
const canContinue = computed(() => !!state.value?.canInitialize && !loading.value && environment.value.every(c => c.ok) && (step.value !== 2 || !!keyId.value) && (![3, 4].includes(step.value) || reviewed.value));
const networkFields = ['服务监听地址', '服务监听端口', '后端通信', '管理端口', '网关、DNS、NTP及VLAN', '已启用网卡地址'];
const deploymentRows = computed(() => Object.fromEntries(Object.entries(plan.value?.deployment || {}).filter(([key]) => !['networkReady', 'securityReady'].includes(key) && (step.value === 3 ? networkFields.includes(key) : !networkFields.includes(key)))));
function message(e: any) { return e?.response?.data?.Status?.Msg || e?.response?.data?.msg || e?.message || '操作未完成，请重试或检查服务状态'; }
async function refreshPlan() {
  loading.value = true; error.value = ''; reviewed.value = false; verified.value = false; confirmed.value = false;
  try { plan.value = await getSvsInitPlan(); }
  catch (e) { error.value = message(e); }
  finally { loading.value = false; }
}
async function load() {
  loading.value = true; error.value = '';
  try {
    state.value = await getSvsInitialization();
    if (state.value.locked) step.value = 7;
    else if (state.value.canInitialize) {
      plan.value = await getSvsInitPlan(); keyId.value = plan.value.keyId;
      step.value = Math.min(plan.value.nextStep, 6); verified.value = false; confirmed.value = false;
    }
  } catch (e) { state.value = undefined; plan.value = undefined; error.value = message(e); }
  finally { loading.value = false; }
}
function back() { step.value--; reviewed.value = false; confirmed.value = false; verified.value = false; error.value = ''; }
async function next() {
  if (!canContinue.value || saving.value) return;
  saving.value = true; error.value = '';
  try {
    if (step.value === 5) { validation.value = await validateSvsInitAccounts(subjects); if (!validation.value.ready) return; }
    plan.value = await reviewSvsInitStep(step.value, keyId.value, plan.value?.deploymentRevision); step.value++; reviewed.value = false; verified.value = false;
  } catch (e) { error.value = message(e); }
  finally { saving.value = false; }
}
async function verify() {
  if (saving.value) return;
  saving.value = true; error.value = ''; verified.value = false; confirmed.value = false;
  try { plan.value = await reviewSvsInitStep(6, keyId.value, plan.value?.deploymentRevision); verified.value = true; }
  catch (e) { error.value = message(e); }
  finally { saving.value = false; }
}
async function complete() {
  if (!confirmed.value || !verified.value || saving.value) return;
  saving.value = true; error.value = '';
  try { await completeSvsInitialization(subjects); step.value = 7; }
  catch (e) { error.value = message(e); confirmed.value = false; verified.value = false; }
  finally { saving.value = false; }
}
async function enterManagement() {
  if (saving.value) return;
  saving.value = true; error.value = '';
  try {
    const routes = await usePermissionStore().generateRoutes();
    routes.forEach(route => router.addRoute(route));
    await router.replace('/svs/runtime');
  }
  catch (e) { error.value = message(e); }
  finally { saving.value = false; }
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
.el-select { width: 100%; } .notice { margin: 20px 0; } .check-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--el-border-color-lighter); } .check-row p { color: var(--el-text-color-secondary); margin: 6px 0; }
@media (max-width: 768px) { .svs-init-page { padding: 12px; } .init-heading, .step-header { flex-direction: column; } .header-actions { width: 100%; justify-content: flex-end; } .wizard-content { min-height: 460px; } .wizard-actions { flex-wrap: wrap; } }
</style>
