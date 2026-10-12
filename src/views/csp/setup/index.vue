<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import Agreement from '@/components/Agreement/index.vue';
import { CSP_AGREEMENT_VERSION } from '@/products/csp/agreement';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const store = useCspConsoleStore();
const router = useRouter();
const {
  initialized,
  completion,
  setupStep,
  setup,
  initializationAttempted,
  busy,
  error,
  httpTestMode,
  environmentReady,
  confirmed,
  accountTransport,
  checkedAt
} = storeToRefs(store);
const accepted = ref(false);
const roleNames = { SYSTEM_ADMIN: '系统管理员', SECURITY_ADMIN: '安全管理员', AUDIT_ADMIN: '审计管理员' };
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
  <div class="app-container csp-page">
    <p v-if="httpTestMode" class="notice" role="status">128 HTTP 测试入口 · 不用于生产，网络传输未加密。</p>
    <p class="eyebrow">CSP CONSOLE</p>
    <h1>CSP 初始化向导</h1>
    <p class="muted">确认使用协议、核验运行环境与三类管理身份，保存 CSP 初始化结果。</p>
    <ol class="setup-steps" aria-label="初始化进度">
      <li
        v-for="(title, index) in ['协议', '环境检查', '账号初始化', '完成']"
        :key="title"
        :class="{ current: setupStep === index, done: setupStep > index || initialized }"
        :aria-current="setupStep === index ? 'step' : undefined"
      >
        <span aria-hidden="true">{{ index + 1 }}</span
        >{{ title }}
      </li>
    </ol>
    <section v-if="initialized" class="wizard-panel" aria-live="polite">
      <span class="status-tag">已完成初始化</span>
      <h2>{{ completion ? '初始化成功，请重新登录' : 'CSP 已完成初始化' }}</h2>
      <p class="muted">一次性初始化入口已锁定。设备、资源池、业务密钥、设备证书、应用接入和信任策略在管理功能中配置。</p>
      <el-button v-if="completion" type="primary" :loading="busy" @click="logout">退出并重新登录</el-button>
      <el-button v-else :disabled="busy" @click="router.replace('/csp/overview')">进入管理首页</el-button>
    </section>
    <section v-else-if="initializationAttempted || initialized === null || !setup" class="wizard-panel">
      <h2>{{ initializationAttempted ? '提交结果需要核查' : '需要确认初始化状态' }}</h2>
      <p>已有提交尝试时只查询结果。未确认成功前，请联系运维核查，不能重新提交或重置。</p>
      <el-button :loading="busy" @click="refresh">刷新状态</el-button>
    </section>
    <section v-else class="wizard-panel" :aria-busy="busy">
      <template v-if="setupStep === 0">
        <h2>公共用户协议</h2>
        <div v-if="agreementAvailable" class="agreement-scroll" tabindex="0" aria-label="公共用户协议正文">
          <Agreement tenant-code="csp" tenant-name="密码服务平台" :company-name="setup.companyName" />
        </div>
        <p v-else class="notice" role="status">协议版本或权利主体尚未配置，请联系运维。</p>
        <p v-if="agreementAvailable" class="muted">协议版本：{{ setup.agreementVersion }}</p>
        <label class="setup-confirm"
          ><input v-model="accepted" type="checkbox" :disabled="busy || !agreementAvailable" />我已阅读并同意公共用户协议</label
        >
        <el-button type="primary" :disabled="busy || !accepted || !agreementAvailable || !accountTransport" @click="store.advanceSetup('AGREE')"
          >同意并继续</el-button
        >
      </template>
      <template v-else-if="setupStep === 1">
        <h2>环境检查</h2>
        <p class="muted">检查平台连接、CSP 业务库、已发布的授权策略和三类管理身份。必要检查通过后才可继续。</p>
        <ul class="environment-list" aria-label="环境检测结果">
          <li><strong>平台及 CSP 业务库</strong><span>待检测，执行检测成功后确认</span></li>
          <li v-for="account in setup.accounts" :key="account.role">
            <strong>{{ roleNames[account.role] }}</strong
            ><span :class="account.valid ? 'check-ok' : 'check-failed'">{{ account.valid ? '核验通过' : '未通过，请核查账号、权限及互斥策略' }}</span>
          </li>
          <li><strong>密码设备</strong><span>未核验，初始化后配置并执行真实自测</span></li>
        </ul>
        <p class="notice">设备状态未核验，不表示设备检查通过。本向导不创建业务密钥或设备配置。</p>
        <el-button type="primary" :loading="busy" :disabled="busy || !accountTransport" @click="store.advanceSetup('CHECK_ENV')"
          >检测并继续</el-button
        >
      </template>
      <template v-else-if="setupStep === 2">
        <h2>账号初始化</h2>
        <p class="muted">绑定现有平台身份，系统管理、安全管理与审计分别由不同人员承担。账号与密码由统一平台管理。</p>
        <ul class="environment-list" aria-label="三角色核验结果">
          <li v-for="account in setup.accounts" :key="account.role">
            <strong>{{ roleNames[account.role] }}</strong
            ><span :class="account.valid ? 'check-ok' : 'check-failed'">{{ account.valid ? '身份与权限核验通过' : '核验未通过' }}</span>
          </li>
        </ul>
        <div class="wizard-actions">
          <el-button :disabled="busy" @click="store.advanceSetup('CHECK_ENV')">重新检测</el-button
          ><el-button type="primary" :loading="busy" :disabled="busy || !environmentReady" @click="store.advanceSetup('VERIFY_ACCOUNTS')"
            >核验并继续</el-button
          >
        </div>
      </template>
      <template v-else>
        <h2>确认初始化结果</h2>
        <dl class="setup-summary">
          <dt>服务版本</dt>
          <dd>{{ setup.serviceVersion }}</dd>
          <dt>运行环境</dt>
          <dd>{{ setup.environment }}</dd>
          <dt>管理身份</dt>
          <dd>系统管理员、安全管理员、审计管理员，分别绑定</dd>
          <dt>核验时间</dt>
          <dd>{{ checkedAt }}</dd>
        </dl>
        <p class="notice">确认后原子保存协议、账号绑定、初始化结果及成功审计，锁定初始化入口。配置或权限变化、核验过期时需要重新检测。</p>
        <label class="setup-confirm"><input v-model="confirmed" type="checkbox" :disabled="busy" />我确认以上结果并完成 CSP 初始化</label>
        <div class="wizard-actions">
          <el-button :disabled="busy" @click="store.advanceSetup('CHECK_ENV')">重新检测</el-button
          ><el-button
            type="primary"
            :loading="busy"
            :disabled="busy || !confirmed || !environmentReady || !accountTransport"
            @click="store.initialize"
            >确认并完成初始化</el-button
          >
        </div>
      </template>
    </section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="muted">最近核验：{{ checkedAt || '尚无有效核验' }} · Asia/Shanghai</p>
  </div>
</template>
<style scoped>
.agreement-scroll {
  max-height: 22rem;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.setup-steps {
  flex-wrap: wrap;
}
.muted {
  overflow-wrap: anywhere;
}
.setup-summary dd {
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .environment-list li {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .wizard-actions {
    flex-wrap: wrap;
  }
}
</style>
