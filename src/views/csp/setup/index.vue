<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const store = useCspConsoleStore();
const router = useRouter();
const {
  initialized,
  completion,
  setupStep,
  initializationAttempted,
  busy,
  error,
  httpTestMode,
  environment,
  environmentReady,
  confirmed,
  accountTransport,
  checkedAt,
  stateLabel
} = storeToRefs(store);
const { initialize } = store;
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
    <p class="muted">
      {{
        initialized && !completion
          ? '初始化状态来自 CSP 服务端，不代表密码设备及全部服务已验收。'
          : '沿用统一 Auth 身份，完成 CSP 自身初始化；不会修改账号、密码或租户关系。'
      }}
    </p>
    <ol v-if="!initialized || completion" class="setup-steps" aria-label="初始化进度">
      <li
        v-for="(title, index) in ['环境检查', '初始化确认', '完成']"
        :key="title"
        :class="{ current: (completion ? 2 : setupStep) === index, done: (completion ? 2 : setupStep) > index }"
        :aria-current="(completion ? 2 : setupStep) === index ? 'step' : undefined"
      >
        <span aria-hidden="true">{{ index + 1 }}</span
        >{{ title }}
      </li>
    </ol>
    <section v-if="completion" class="wizard-panel" aria-live="polite">
      <span class="status-tag">服务端状态：已完成初始化</span>
      <h2>初始化已完成，请重新登录</h2>
      <p class="muted">一次性初始化执行入口已关闭。请退出当前会话，重新通过 Auth 登录，进入正式管理流程。</p>
      <p class="muted">账号和密码保持不变。本页确认的是 CSP 初始化状态，不代表全套密码服务发布验收通过。</p>
      <el-button type="primary" :loading="busy" @click="logout">退出并重新登录</el-button>
    </section>
    <section v-else-if="initialized === false && !initializationAttempted" class="wizard-panel" :aria-busy="busy">
      <template v-if="setupStep === 0">
        <div class="wizard-heading">
          <div>
            <h2>检查初始化环境</h2>
            <p class="muted">只读核查 CSP 租户及预置身份；不检查密码、不修改统一身份数据。</p>
          </div>
          <el-button :disabled="busy" @click="refresh">重新检测</el-button>
        </div>
        <ul class="environment-list" aria-label="环境检测结果">
          <li v-for="row in environment" :key="row.name">
            <strong>{{ row.name }}</strong
            ><span :class="row.ok ? 'check-ok' : 'check-failed'">{{ row.ok ? '检查通过' : '未通过，请联系运维' }}</span>
          </li>
        </ul>
        <p v-if="!environmentReady" class="notice" role="status">前置检查尚未全部通过，不能继续初始化。</p>
        <el-button type="primary" :disabled="busy || !environmentReady" @click="setupStep = 1">下一步：初始化确认</el-button>
      </template>
      <template v-else>
        <h2>确认 CSP 初始化范围</h2>
        <dl class="setup-summary">
          <dt>初始化对象</dt>
          <dd>CSP · 租户 10</dd>
          <dt>配置来源</dt>
          <dd>服务端已部署的可信版本与环境；页面不可覆盖</dd>
          <dt>身份管理</dt>
          <dd>Auth 负责认证，Admin 管理账号与角色；本次不修改</dd>
          <dt>后续配置</dt>
          <dd>设备、资源池、密钥和业务策略通过各自管理功能配置</dd>
        </dl>
        <p class="notice">这是一次有副作用的确认操作，将记录 CSP 初始化状态与成功审计。完成后关闭一次性执行入口；不提供重置按钮。</p>
        <label class="setup-confirm"
          ><input v-model="confirmed" type="checkbox" :disabled="busy" />我确认仅初始化 CSP 自身状态，并在完成后重新通过 Auth 登录</label
        >
        <div class="wizard-actions">
          <el-button :disabled="busy" @click="setupStep = 0">上一步</el-button
          ><el-button type="primary" :loading="busy" :disabled="busy || !confirmed || !environmentReady || !accountTransport" @click="initialize"
            >确认并初始化 CSP</el-button
          >
        </div>
      </template>
    </section>
    <section v-else-if="!initialized" class="wizard-panel">
      <h2>{{ initializationAttempted ? '提交结果需要核查' : '需要确认平台状态' }}</h2>
      <p class="muted">
        {{
          initializationAttempted
            ? '已有一次提交尝试。本页不会重复写入，请只刷新状态；状态仍未完成时请联系运维核查，再决定是否重新登录。'
            : '状态读取失败不代表平台已初始化。请刷新状态；无有效状态及环境检查时禁止提交。'
        }}
      </p>
      <el-button :loading="busy" @click="refresh">刷新状态</el-button>
    </section>
    <section v-else class="status-panel">
      <div>
        <span class="status-tag">{{ stateLabel }}</span>
        <h2>平台已完成初始化</h2>
        <p>当前版本提供登录、初始化向导和状态引导。设备、资源池和密码能力管理将在后续版本开放。</p>
      </div>
      <el-button :loading="busy" @click="refresh">刷新状态</el-button>
    </section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="muted">最近核查：{{ checkedAt || '尚无成功核查' }} · Asia/Shanghai</p>
    <section class="scope">
      <h2>当前版本边界</h2>
      <p>不展示模拟指标，不提供密钥、设备、路由或审批操作。页面可访问不等于密码服务通过发布验收。</p>
    </section>
  </div>
</template>
