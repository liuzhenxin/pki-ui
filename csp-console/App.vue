<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import logo from '../src/assets/brand/csp-logo.svg';
import mark from '../src/assets/brand/csp-mark-inverse.svg';
import brandMark from '../src/assets/brand/csp-mark.svg';
import { User, Lock, OfficeBuilding, CircleCheck } from '@element-plus/icons-vue';
import { skfCall, closeSkf, normalizeSkfSignature } from './skf';
import { calculateSm2SignatureDigest } from '../src/utils/sm2SignatureDigest';

const loginMode = ref<'account' | 'certificate'>('account');
const certificateEnabled = ref(false);
const pin = ref('');
const certificates = ref<{ key: string; cert: string; label: string }[]>([]);
const certificateKey = ref('');
function switchMode(mode: 'account' | 'certificate') {
  loginMode.value = mode;
  pin.value = '';
  password.value = '';
  error.value = '';
}
async function readCertificates() {
  if (busy.value || !secure || !certificateEnabled.value) return;
  busy.value = true;
  error.value = '';
  certificates.value = [];
  certificateKey.value = '';
  pin.value = '';
  try {
    const result = await skfCall('FindCertificates', ['Sign']);
    if (!Array.isArray(result)) throw new Error('本机证书列表无效。');
    certificates.value = result
      .filter((item) => item?.type === 'Sign' && typeof item.key === 'string' && typeof item.cert === 'string')
      .map((item, index) => ({
        key: item.key,
        cert: item.cert.replace(/\s+/g, ''),
        label: `签名证书 ${index + 1} · ${String(item.value || item.key).slice(0, 180)}`
      }));
    certificateKey.value = certificates.value[0]?.key || '';
    if (!certificateKey.value) throw new Error('USB Key 中未发现签名证书。');
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    closeSkf();
    busy.value = false;
  }
}
async function certificateLogin() {
  if (busy.value || !secure || !certificateEnabled.value) return;
  const certificate = certificates.value.find((item) => item.key === certificateKey.value);
  if (!certificate || !pin.value) {
    error.value = '请选择签名证书并输入 PIN。';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const challenge = await api('certificate-challenge', { certificate: certificate.cert });
    const verified = await skfCall('CheckPIN', [certificate.key, pin.value]);
    pin.value = '';
    if (verified !== true) throw new Error('PIN 验证未通过；不会自动重试。');
    const digest = calculateSm2SignatureDigest(certificate.cert, challenge.signData, challenge.sm2UserId);
    const rawSignature = await skfCall('SignData', [certificate.key, digest]);
    if (typeof rawSignature !== 'string') throw new Error('USB Key 签名响应无效。');
    await api('certificate-login', { challengeId: challenge.challengeId, signature: normalizeSkfSignature(rawSignature) });
    certificates.value = [];
    certificateKey.value = '';
    signedIn.value = true;
    await readState();
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    closeSkf();
    pin.value = '';
    busy.value = false;
  }
}

const username = ref('');
const password = ref('');
const captcha = ref('');
const image = ref('');
const csrf = ref('');
const captchaEnabled = ref(true);
const busy = ref(false);
const error = ref('');
const signedIn = ref(false);
const initialized = ref<boolean | null>(null);
const checkedAt = ref('');
const setupStep = ref(0);
const environment = ref<{ name: string; ok: boolean }[]>([]);
const confirmed = ref(false);
const initializationAttempted = ref(false);
const completion = ref(false);
const environmentReady = computed(() => environment.value.length === 2 && environment.value.every((row) => row.ok));
const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
const stateLabel = computed(() => (initialized.value === null ? '状态未确认' : initialized.value ? '已完成初始化' : '等待初始化'));

async function api(path: string, body?: object) {
  const response = await fetch('/console-api/' + path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.value },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '请求未完成，请稍后手动重试。');
  return data;
}

async function challenge() {
  image.value = '';
  captcha.value = '';
  const data = await api('challenge');
  csrf.value = data.csrf;
  captchaEnabled.value = data.captchaEnabled;
  image.value = data.image;
}

async function refresh() {
  if (busy.value) return;
  await readState();
}

async function readState() {
  busy.value = true;
  error.value = '';
  environment.value = [];
  confirmed.value = false;
  setupStep.value = 0;
  try {
    const data = await api('state');
    if (typeof data.initialized !== 'boolean') throw new Error('初始化状态无效，请联系运维核查。');
    signedIn.value = true;
    initialized.value = data.initialized;
    completion.value = data.initialized && initializationAttempted.value;
    checkedAt.value = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    history.replaceState(null, '', data.initialized && !completion.value ? '/csp/overview' : '/csp/setup');
    if (!data.initialized && !initializationAttempted.value) {
      const result = await api('environment');
      if (
        !Array.isArray(result.checks) ||
        result.checks.length !== 2 ||
        result.checks.some((row: { name: unknown; ok: unknown }) => typeof row.name !== 'string' || typeof row.ok !== 'boolean')
      )
        throw new Error('环境检查结果无效，请联系运维核查。');
      environment.value = result.checks;
    }
  } catch (failure) {
    initialized.value = null;
    error.value = (failure as Error).message;
  } finally {
    busy.value = false;
  }
}

async function initialize() {
  if (busy.value || !secure || initialized.value !== false || !environmentReady.value || !confirmed.value || initializationAttempted.value) return;
  busy.value = true;
  error.value = '';
  initializationAttempted.value = true;
  try {
    const result = await api('initialize', { confirm: true });
    if (result.initialized !== true || result.reauthenticationRequired !== true) throw new Error('初始化回执无效。');
    initialized.value = true;
    completion.value = true;
    checkedAt.value = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch (failure) {
    error.value = `${(failure as Error).message} 请点击“刷新状态”核查；本页不会再次提交。`;
  } finally {
    busy.value = false;
  }
}

async function login() {
  if (busy.value || !secure) return;
  busy.value = true;
  error.value = '';
  try {
    await api('login', { username: username.value.trim(), password: password.value, captcha: captcha.value });
    password.value = '';
    captcha.value = '';
    image.value = '';
    signedIn.value = true;
    await readState();
  } catch (failure) {
    password.value = '';
    captcha.value = '';
    image.value = '';
    error.value = (failure as Error).message;
  } finally {
    busy.value = false;
  }
}

async function reloadChallenge() {
  busy.value = true;
  error.value = '';
  try {
    await challenge();
  } catch {
    error.value = '认证服务暂不可用，请手动刷新验证码。';
  } finally {
    busy.value = false;
  }
}

async function logout() {
  busy.value = true;
  error.value = '';
  try {
    await api('logout', {});
    signedIn.value = false;
    initialized.value = null;
    environment.value = [];
    confirmed.value = false;
    initializationAttempted.value = false;
    completion.value = false;
    setupStep.value = 0;
    password.value = '';
    history.replaceState(null, '', '/login');
    const session = await api('session');
    csrf.value = session.csrf;
    certificateEnabled.value = session.certificateLoginEnabled === true;
    initializationAttempted.value = session.initializationAttempted === true;
    await reloadChallenge();
  } catch {
    error.value = '退出或新会话状态未确认，请刷新页面核查。';
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    const session = await api('session');
    csrf.value = session.csrf;
    certificateEnabled.value = session.certificateLoginEnabled === true;
    initializationAttempted.value = session.initializationAttempted === true;
    if (session.authenticated) {
      signedIn.value = true;
      await readState();
      return;
    }
    await reloadChallenge();
  } catch {
    error.value = '控制台连接失败，请刷新页面。';
  }
});
</script>

<template>
  <a class="skip" href="#main">跳到主要内容</a>
  <div v-if="!signedIn" class="login-layout">
    <aside class="brand-panel">
      <div class="wordmark"><img :src="logo" alt="LiuZX CSP" width="112" /></div>
      <div class="brand-copy">
        <div class="brand-illustration" aria-hidden="true">
          <div class="brand-platform"></div>
          <div class="brand-emblem"><img :src="brandMark" alt="" width="168" height="168" /></div>
        </div>
        <h1>密码服务平台</h1>
        <p>统一密码能力与设备资源，构建受控、可信的业务服务入口</p>
      </div>
      <footer><span>LIUZX · CSP</span><span>测试环境 · v3.0.0</span></footer>
    </aside>
    <main id="main" class="login-main">
      <div class="login-card">
        <h2>欢迎回来</h2>
        <p class="muted form-subtitle">请输入您的账户信息以进入密码服务平台</p>
        <div class="login-method">
          <button type="button" :aria-pressed="loginMode === 'account'" :disabled="busy" @click="switchMode('account')">账号登录</button>
          <button type="button" :aria-pressed="loginMode === 'certificate'" :disabled="busy" @click="switchMode('certificate')">证书登录</button>
        </div>
        <form v-if="loginMode === 'account'" @submit.prevent="login">
          <el-input class="tenant-field" model-value="密码服务平台（CSP）" aria-label="当前系统租户" disabled readonly
            ><template #prefix><OfficeBuilding aria-hidden="true" class="field-icon" /></template
          ></el-input>
          <label for="username">账号</label
          ><el-input id="username" v-model="username" autocomplete="username" maxlength="100" placeholder="请输入账号" :disabled="busy" required
            ><template #prefix><User aria-hidden="true" class="field-icon" /></template
          ></el-input>
          <label for="password">密码</label
          ><el-input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            show-password
            maxlength="128"
            placeholder="请输入密码"
            :disabled="busy"
            required
            ><template #prefix><Lock aria-hidden="true" class="field-icon" /></template
          ></el-input>
          <template v-if="captchaEnabled"
            ><label for="captcha">图形验证码</label>
            <div class="captcha-row">
              <el-input id="captcha" v-model="captcha" autocomplete="off" maxlength="16" placeholder="请输入图中文字" :disabled="busy" required
                ><template #prefix><CircleCheck aria-hidden="true" class="field-icon" /></template></el-input
              ><button type="button" class="captcha-image" aria-label="刷新图形验证码" :disabled="busy" @click="reloadChallenge">
                <img v-if="image" :src="image" alt="图形验证码，请人工识别" width="130" height="44" /><span v-else>获取验证码</span>
              </button>
            </div></template
          >
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <el-button class="submit" type="primary" native-type="submit" :loading="busy" :disabled="!secure || !csrf || (captchaEnabled && !image)"
            >登录</el-button
          >
        </form>
        <form v-else @submit.prevent="certificateLogin">
          <p class="muted">插入已绑定 CSP 账号的 USB Key，并启动本机 SKF 服务。PIN 仅交本机设备验证。</p>
          <p v-if="!certificateEnabled" class="notice" role="status">证书登录尚待客户端授权、信任链及吊销校验验收，暂未启用。</p>
          <el-button :disabled="busy || !secure || !certificateEnabled" @click="readCertificates">读取 USB Key 证书</el-button>
          <label for="certificate">签名证书</label>
          <select id="certificate" v-model="certificateKey" class="certificate-select" :disabled="busy || !secure" required>
            <option value="" disabled>请选择签名证书</option>
            <option v-for="item in certificates" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
          <label for="pin">USB Key PIN</label>
          <el-input
            id="pin"
            v-model="pin"
            type="password"
            autocomplete="off"
            maxlength="64"
            placeholder="请输入 USB Key PIN"
            :disabled="busy || !secure"
            required
          />
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <el-button
            class="submit"
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="!secure || !csrf || !certificateEnabled || !certificateKey || !pin"
            >证书登录</el-button
          >
        </form>
        <p class="security-note"><Lock aria-hidden="true" class="field-icon" />不保存密码 · 会话受控</p>
      </div>
      <footer class="login-footer">LiuZX 密码服务平台</footer>
    </main>
  </div>
  <div v-else class="console-layout">
    <aside class="sidebar">
      <div class="wordmark"><img :src="mark" alt="CSP" width="40" height="40" /><span>密码服务平台</span></div>
      <nav aria-label="控制台导航">
        <a :href="initialized ? '/csp/overview' : '/csp/setup'" aria-current="page">{{ initialized ? '运行总览' : '初始化引导' }}</a>
      </nav>
      <footer>测试环境<br />无合格资源时拒绝请求</footer>
    </aside>
    <div class="workspace">
      <header>
        <span>密码服务平台 / {{ initialized ? '运行总览' : '初始化引导' }}</span
        ><el-button :disabled="busy" @click="logout">退出登录</el-button>
      </header>
      <main id="main" class="content">
        <p class="eyebrow">CSP CONSOLE</p>
        <h1>{{ initialized && !completion ? '运行总览' : 'CSP 初始化向导' }}</h1>
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
              ><el-button type="primary" :loading="busy" :disabled="busy || !confirmed || !environmentReady || !secure" @click="initialize"
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
      </main>
    </div>
  </div>
</template>
