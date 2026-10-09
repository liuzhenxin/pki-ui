<template>
  <main class="app-container svs-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading"><div><p class="heading-label">签名验签服务器</p><h1>SVS 初始化向导</h1></div></div>
      <el-steps :active="step" finish-status="success" simple class="init-steps">
        <el-step title="环境检查" /><el-step title="账号绑定" /><el-step title="确认初始化" /><el-step title="完成" />
      </el-steps>
      <div class="wizard-content">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="notice" />
      <section v-if="step === 0" class="step-content env-step">
        <div class="step-header"><div><h2>环境检查</h2><p>确认平台租户、业务数据库及密码设备已经准备完成。</p></div><div class="header-actions"><el-button type="primary" plain :icon="Refresh" :loading="loading" @click="load">重新检查</el-button></div></div>
        <div v-if="state" class="env-summary"><div class="env-summary-card" :class="environmentReady ? 'env-summary-ok' : 'env-summary-fail'">
          <div class="env-summary-icon"><el-icon :size="40"><CircleCheckFilled v-if="environmentReady" /><WarningFilled v-else /></el-icon></div>
          <div class="env-summary-text"><div class="env-summary-title">{{ environmentReady ? '环境检查全部通过' : '环境检查存在异常' }}</div><div class="env-summary-desc">共 {{ environment.length }} 项检测，{{ environment.filter(check => check.ok).length }} 项正常。产品租户：{{ state.tenantId }} / {{ state.code }}</div></div>
        </div></div>
        <div class="env-cards"><div v-for="check in environment" :key="check.name" class="env-card" :class="state ? (check.ok ? 'env-card-ok' : 'env-card-fail') : ''">
          <div class="env-card-icon"><el-icon :size="22"><CircleCheckFilled v-if="check.ok" /><CircleCloseFilled v-else /></el-icon></div>
          <div class="env-card-body"><div class="env-card-header"><span class="env-card-name">{{ check.name }}</span><el-tag :type="state ? (check.ok ? 'success' : 'danger') : 'info'" effect="light" size="small">{{ state ? (check.ok ? '正常' : '异常') : '待检查' }}</el-tag></div><div class="env-card-message">{{ check.message }}</div></div>
        </div></div>
        <el-alert v-if="state && !state.canInitialize" title="当前账号可查看状态；请使用具有初始化权限的系统管理员完成账号绑定。" type="info" :closable="false" class="notice" />

      </section>
      <section v-else-if="step === 1" class="step-content">
<div class="step-title"><h2>绑定已有平台账号</h2><p>绑定一个系统管理员、两名安全管理员和一个审计员。</p></div>
        <el-alert title="两名安全管理员权限相同，每笔操作由不同账号申请和审批，禁止自审批。" type="info" :closable="false" show-icon />
        <p>用户名已固定。请确保四个账号在平台租户 9 中存在并分配对应角色，再进行校验。</p>
        <el-form class="init-form" label-width="140px" @submit.prevent="validate">
          <el-form-item v-for="(label, index) in labels" :key="label" :label="label">
            <el-input :model-value="users[index]" readonly />
          </el-form-item>
        </el-form>
        <div v-for="row in validation?.rows" :key="row.username" class="check-row">
          <div><strong>{{ row.username }}</strong><p>{{ row.message }}</p></div><el-tag :type="row.valid ? 'success' : 'danger'">{{ row.valid ? '通过' : '未通过' }}</el-tag>
        </div>

      </section>
      <section v-else-if="step === 2" class="step-content">
        <div class="step-title"><h2>确认初始化</h2><p>平台租户、业务数据库及密码设备检查通过，四个独立账号角色校验通过。</p></div>
        <el-descriptions :column="1" border><el-descriptions-item v-for="(label, index) in labels" :key="label" :label="label">{{ users[index] }}</el-descriptions-item></el-descriptions>
        <el-alert title="提交后将绑定这些账号并锁定初始化。系统会再次校验环境和账号状态；本向导不修改平台密码、不创建或导入私钥。" type="warning" :closable="false" show-icon class="notice" />
        <el-checkbox v-model="confirmed">我已核对账号及角色，确认完成初始化</el-checkbox>

      </section>
      <section v-else class="step-content">
        <el-result icon="success" title="初始化已完成" sub-title="平台账号已绑定，初始化已锁定。" />
        <p>后续请由安全管理员配置设备内密钥引用和签名证书，再完成应用接入与独立审批。</p>
        <p>签名私钥始终保留在 SDF/HSM 中，证书配置只导入公钥证书。</p>

      </section>
      </div>
      <div class="wizard-actions">
        <el-button :disabled="step === 0 || step === 3 || loading || saving" @click="confirmed = false; error = ''; step--">上一步</el-button>
        <el-button v-if="step === 0" type="primary" :disabled="!environmentReady || !state?.canInitialize" @click="openAccounts">下一步</el-button>
        <el-button v-else-if="step === 1" type="primary" :loading="saving" @click="validate">校验并继续</el-button>
        <el-button v-else-if="step === 2" type="primary" :loading="saving" :disabled="!confirmed" @click="complete">确认并完成初始化</el-button>
        <el-button v-else type="primary" @click="router.replace('/svs/runtime')">进入管理台</el-button>
      </div>
    </el-card>
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Refresh, CircleCheckFilled, CircleCloseFilled, WarningFilled } from '@element-plus/icons-vue';
import { getSvsInitialization, completeSvsInitialization, validateSvsInitAccounts, type Initialization, type InitRole, type AccountValidation } from '@/api/svs/init';
const router = useRouter();
const state = ref<Initialization>();
const step = ref(0), loading = ref(false), saving = ref(false), confirmed = ref(false), error = ref('');
const labels = ['系统管理员', '安全管理员（申请）', '安全管理员（审批）', '审计员'];
const roles: InitRole[] = ['SYSADMIN', 'SECADMIN', 'SECADMIN', 'AUDITOR'];
const users = ['admin', 'secadmin', 'secadmin2', 'auditor'] as const;
const validation = ref<AccountValidation>();
const environment = computed(() => [
  { name: '平台连接与产品租户', ok: !!state.value?.platformTenantValid, message: state.value?.platformTenantValid ? '平台可访问，租户 9 / svs 校验通过。' : '请检查平台连接及 SVS 产品租户配置，然后重新检查。' },
  { name: '业务数据库', ok: !!state.value?.databaseReady, message: state.value?.databaseReady ? '初始化记录可正常读取。' : '请检查业务数据库连接及初始化表是否就绪。' },
  { name: '密码设备', ok: !!state.value?.deviceReady, message: state.value?.deviceReady ? '密码设备已就绪。' : '请检查设备连接及服务运行状态，然后重新检查。' }
]);
const environmentReady = computed(() => !!state.value && environment.value.every((check) => check.ok));
function message(e: any) { return e?.response?.data?.Status?.Msg || e?.response?.data?.msg || e?.message || '操作未完成，请重试或检查服务状态'; }

function subjects() { return Object.fromEntries(users.map((name, index) => [name.trim(), roles[index]])); }
async function load() {
  loading.value = true; error.value = '';
  try { state.value = await getSvsInitialization(); if (state.value.locked) step.value = 3; }
  catch (e) { state.value = undefined; error.value = message(e); }
  finally { loading.value = false; }
}
function openAccounts() { step.value = 1; }
async function validate() {
  error.value = ''; validation.value = undefined;
  const names = users.map((name) => name.trim());
  if (names.some((name) => !/^[A-Za-z0-9_-]{1,100}$/.test(name)) || new Set(names).size !== 4) { error.value = '请填写四个不同的平台用户名'; return; }
  saving.value = true;
  try { validation.value = await validateSvsInitAccounts(subjects()); if (validation.value.ready) { confirmed.value = false; step.value = 2; } }
  catch (e) { error.value = message(e); }
  finally { saving.value = false; }
}
async function complete() {
  if (!confirmed.value || saving.value) return;
  saving.value = true; error.value = '';
  try { await completeSvsInitialization(subjects()); state.value = { ...state.value!, locked: true }; step.value = 3; }
  catch (e) { confirmed.value = false; error.value = message(e); }
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
