<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import logo from '../src/assets/brand/csp-logo.svg';
import mark from '../src/assets/brand/csp-mark-inverse.svg';
import brandMark from '../src/assets/brand/csp-mark.svg';
import { User, Lock, OfficeBuilding, CircleCheck } from '@element-plus/icons-vue';

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
  busy.value = true;
  error.value = '';
  try {
    const data = await api('state');
    signedIn.value = true;
    initialized.value = data.initialized;
    checkedAt.value = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    history.replaceState(null, '', data.initialized ? '/csp/overview' : '/csp/setup');
  } catch (failure) {
    initialized.value = null;
    error.value = (failure as Error).message;
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
    await refresh();
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
    password.value = '';
    history.replaceState(null, '', '/login');
    const session = await api('session');
    csrf.value = session.csrf;
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
    if (session.authenticated) {
      await refresh();
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
          <span><User aria-hidden="true" />账号登录</span><small>测试环境</small>
        </div>
        <div v-if="!secure" class="notice" role="status">当前为 HTTP 测试预览，已禁止发送账号密码。请通过 HTTPS 或 localhost SSH 隧道登录。</div>
        <form @submit.prevent="login">
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
        <h1>{{ initialized ? '运行总览' : '初始化状态引导' }}</h1>
        <p class="muted">基于服务端初始化状态，只读展示，不自动执行初始化。</p>
        <section class="status-panel">
          <div>
            <span class="status-tag">{{ stateLabel }}</span>
            <h2>{{ initialized === false ? '登录已完成，等待受控初始化' : initialized ? '平台已完成初始化' : '需要确认平台状态' }}</h2>
            <p>
              {{
                initialized === false
                  ? '请由授权管理员完成既有受控初始化流程，再刷新本页。此版本不接收初始化口令，不提供有副作用的提交操作。'
                  : initialized
                    ? '当前版本仅提供登录和初始化状态引导。设备、资源池和密码能力管理将在后续版本开放。'
                    : '状态读取失败不代表平台已初始化，也不代表密码设备可用。'
              }}
            </p>
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
