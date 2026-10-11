<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { User, Lock, OfficeBuilding, CircleCheck } from '@element-plus/icons-vue';
import logo from '@/assets/brand/csp-logo.svg';
import brandMark from '@/assets/brand/csp-mark.svg';
import { closeSkf } from '@/services/csp/skf';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
import { cspProduct } from '@/config/csp';
const store = useCspConsoleStore();
const router = useRouter();
const {
  loginMode,
  certificateEnabled,
  pin,
  certificates,
  certificateKey,
  username,
  password,
  captcha,
  image,
  csrf,
  captchaEnabled,
  busy,
  error,
  secure,
  httpTestMode,
  accountTransport
} = storeToRefs(store);
const { switchMode, readCertificates, reloadChallenge } = store;
async function login() {
  await store.login();
  if (store.signedIn) await router.replace(store.destination);
}
async function certificateLogin() {
  await store.certificateLogin();
  if (store.signedIn) await router.replace(store.destination);
}
onMounted(() => {
  if (store.csrf && !store.image && !store.error) void store.reloadChallenge();
});
onUnmounted(() => {
  password.value = '';
  pin.value = '';
  captcha.value = '';
  certificates.value = [];
  certificateKey.value = '';
  closeSkf();
});
</script>
<template>
  <div class="login-layout">
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
      <footer>
        <span>LIUZX · CSP</span><span>测试环境 · {{ cspProduct.version }}</span>
      </footer>
    </aside>
    <main id="main" class="login-main">
      <div class="login-card">
        <h2>欢迎回来</h2>
        <p class="muted form-subtitle">请输入您的账户信息以进入密码服务平台</p>
        <p v-if="httpTestMode" class="notice" role="status">128 HTTP 测试入口 · 不用于生产，网络传输未加密。</p>
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
          <el-button
            class="submit"
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="!accountTransport || !csrf || (captchaEnabled && !image)"
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
</template>
