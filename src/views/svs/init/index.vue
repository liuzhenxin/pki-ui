<template>
  <main class="svs-init-page">
    <el-card v-loading="loading" shadow="never">
      <h1>签名验签服务器初始化向导</h1>
      <p class="intro">检查运行环境，绑定平台账号，确认后完成初始化。</p>
      <el-steps :active="step" finish-status="success" align-center>
        <el-step title="环境检查" /><el-step title="账号绑定" /><el-step title="确认初始化" /><el-step title="完成" />
      </el-steps>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="notice" />
      <section v-if="step === 0" class="step-content">
        <h2>运行环境</h2>
        <p>产品租户：{{ state?.tenantId ?? 9 }} / {{ state?.code ?? 'svs' }}</p>
        <div v-for="check in environment" :key="check.name" class="check-row">
          <div><strong>{{ check.name }}</strong><p>{{ check.message }}</p></div>
          <el-tag :type="check.ok ? 'success' : 'danger'">{{ state ? (check.ok ? '通过' : '未通过') : '待检查' }}</el-tag>
        </div>
        <el-alert v-if="state && !state.canInitialize" title="当前账号可查看状态；请使用具有初始化权限的系统管理员完成账号绑定。" type="info" :closable="false" class="notice" />
        <div class="actions"><el-button :loading="loading" @click="load">重新检查</el-button><el-button type="primary" :disabled="!environmentReady || !state?.canInitialize" @click="openAccounts">下一步</el-button></div>
      </section>
      <section v-else-if="step === 1" class="step-content">
        <h2>绑定已有平台账号</h2>
        <el-alert title="两名安全管理员权限相同，每笔操作由不同账号申请和审批，禁止自审批。" type="info" :closable="false" show-icon />
        <p>候选账号来自平台当前身份状态。若账号未列出，可填写用户名；请先让该账号登录平台刷新状态，再校验。</p>
        <el-form label-width="140px" @submit.prevent="validate">
          <el-form-item v-for="(label, index) in labels" :key="label" :label="label">
            <el-select v-model="users[index]" filterable allow-create default-first-option placeholder="选择或填写平台用户名" @change="validation = undefined">
              <el-option v-for="name in options(index)" :key="name" :label="name" :value="name" />
            </el-select>
          </el-form-item>
        </el-form>
        <div v-for="row in validation?.rows" :key="row.username" class="check-row">
          <div><strong>{{ row.username }}</strong><p>{{ row.message }}</p></div><el-tag :type="row.valid ? 'success' : 'danger'">{{ row.valid ? '通过' : '未通过' }}</el-tag>
        </div>
        <div class="actions"><el-button @click="step = 0">上一步</el-button><el-button :loading="loading" @click="refreshAccounts">刷新候选</el-button><el-button type="primary" :loading="saving" @click="validate">校验并继续</el-button></div>
      </section>
      <section v-else-if="step === 2" class="step-content">
        <h2>确认初始化</h2>
        <p>平台租户、业务数据库及密码设备检查通过，四个独立账号角色校验通过。</p>
        <el-descriptions :column="1" border><el-descriptions-item v-for="(label, index) in labels" :key="label" :label="label">{{ users[index] }}</el-descriptions-item></el-descriptions>
        <el-alert title="提交后将绑定这些账号并锁定初始化。系统会再次校验环境和账号状态；本向导不修改平台密码、不创建或导入私钥。" type="warning" :closable="false" show-icon class="notice" />
        <el-checkbox v-model="confirmed">我已核对账号及角色，确认完成初始化</el-checkbox>
        <div class="actions"><el-button :disabled="saving" @click="confirmed = false; step = 1">上一步</el-button><el-button type="primary" :loading="saving" :disabled="!confirmed" @click="complete">确认并完成初始化</el-button></div>
      </section>
      <section v-else class="step-content">
        <el-result icon="success" title="初始化已完成" sub-title="平台账号已绑定，初始化已锁定。" />
        <p>后续请由安全管理员配置设备内密钥引用和签名证书，再完成应用接入与独立审批。</p>
        <p>签名私钥始终保留在 SDF/HSM 中，证书配置只导入公钥证书。</p>
        <div class="actions"><el-button type="primary" @click="router.replace('/svs/runtime')">进入管理台</el-button></div>
      </section>
    </el-card>
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getSvsInitialization, completeSvsInitialization, getSvsInitAccounts, validateSvsInitAccounts, type Initialization, type InitRole, type AccountValidation } from '@/api/svs/init';
const router = useRouter();
const state = ref<Initialization>();
const step = ref(0), loading = ref(false), saving = ref(false), confirmed = ref(false), error = ref('');
const labels = ['系统管理员', '安全管理员 1', '安全管理员 2', '审计员'];
const roles: InitRole[] = ['SYSADMIN', 'SECADMIN', 'SECADMIN', 'AUDITOR'];
const users = ref(['', '', '', '']);
const candidates = ref<Record<string, InitRole>>({});
const validation = ref<AccountValidation>();
const environment = computed(() => [
  { name: '平台连接与产品租户', ok: !!state.value?.platformTenantValid, message: state.value?.platformTenantValid ? '平台可访问，租户 9 / svs 校验通过。' : '请检查平台连接及 SVS 产品租户配置，然后重新检查。' },
  { name: '业务数据库', ok: !!state.value?.databaseReady, message: state.value?.databaseReady ? '初始化记录可正常读取。' : '请检查业务数据库连接及初始化表是否就绪。' },
  { name: '密码设备', ok: !!state.value?.deviceReady, message: state.value?.deviceReady ? '密码设备已就绪。' : '请检查设备连接及服务运行状态，然后重新检查。' }
]);
const environmentReady = computed(() => !!state.value && environment.value.every((check) => check.ok));
function message(e: any) { return e?.response?.data?.Status?.Msg || e?.response?.data?.msg || e?.message || '操作未完成，请重试或检查服务状态'; }
function options(index: number) { return Object.keys(candidates.value).filter((name) => candidates.value[name] === roles[index]).sort(); }
function subjects() { return Object.fromEntries(users.value.map((name, index) => [name.trim(), roles[index]])); }
async function load() {
  loading.value = true; error.value = '';
  try { state.value = await getSvsInitialization(); if (state.value.locked) step.value = 3; }
  catch (e) { state.value = undefined; error.value = message(e); }
  finally { loading.value = false; }
}
async function refreshAccounts() {
  loading.value = true; error.value = '';
  try { candidates.value = await getSvsInitAccounts(); }
  catch (e) { error.value = message(e); }
  finally { loading.value = false; }
}
async function openAccounts() { step.value = 1; await refreshAccounts(); }
async function validate() {
  error.value = ''; validation.value = undefined;
  const names = users.value.map((name) => name.trim());
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
.svs-init-page { padding: 24px; max-width: 960px; margin: 0 auto; }
h1 { font-size: 24px; margin-top: 0; } h2 { font-size: 18px; }
.intro, .check-row p { color: var(--el-text-color-secondary); }
.el-steps { margin: 28px 0; } .step-content { margin-top: 24px; min-height: 300px; }
.check-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.check-row p { margin: 6px 0 0; } .el-select { width: 100%; } .el-form { margin-top: 24px; }
.notice { margin: 20px 0; } .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; flex-wrap: wrap; }
@media (max-width: 600px) { .svs-init-page { padding: 12px; } h1 { font-size: 20px; } }
</style>
