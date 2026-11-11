<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { CircleCheck, Key, Lock, OfficeBuilding, Postcard, Search, User } from '@element-plus/icons-vue';
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
      <span class="brand-badge">CSP</span>
      <div class="brand-copy">
        <div class="brand-illustration" aria-hidden="true">
          <span class="brand-platform"></span>
          <span class="brand-emblem"><img :src="brandMark" alt="" width="116" height="116" /></span>
          <span class="brand-signal"></span>
        </div>
        <h1>{{ cspProduct.name }}</h1>
        <p>统一管理密码设备、应用接入和密码服务</p>
      </div>
      <footer>版本信息 v{{ cspProduct.version }}</footer>
    </aside>

    <main id="main" class="login-main">
      <div class="login-card">
        <h2>欢迎回来</h2>
        <p class="form-subtitle">请输入您的账户信息以进入{{ cspProduct.name }}</p>
        <div class="login-method" role="group" aria-label="登录方式">
          <button type="button" :aria-pressed="loginMode === 'account'" :disabled="busy" @click="switchMode('account')">
            <User aria-hidden="true" />账号登录
          </button>
          <button type="button" :aria-pressed="loginMode === 'certificate'" :disabled="busy" @click="switchMode('certificate')">
            <Postcard aria-hidden="true" />证书登录
          </button>
        </div>
        <el-input :model-value="cspProduct.name" aria-label="当前系统租户" disabled readonly>
          <template #prefix><OfficeBuilding aria-hidden="true" class="field-icon" /></template>
        </el-input>

        <form v-if="loginMode === 'account'" @submit.prevent="login">
          <el-input v-model="username" aria-label="账号" autocomplete="username" maxlength="100" placeholder="账号" :disabled="busy" required>
            <template #prefix><User aria-hidden="true" class="field-icon" /></template>
          </el-input>
          <el-input
            v-model="password"
            aria-label="密码"
            type="password"
            autocomplete="current-password"
            show-password
            maxlength="128"
            placeholder="密码"
            :disabled="busy"
            required
          >
            <template #prefix><Lock aria-hidden="true" class="field-icon" /></template>
          </el-input>
          <div v-if="captchaEnabled" class="captcha-row">
            <el-input v-model="captcha" aria-label="图形验证码" autocomplete="off" maxlength="16" placeholder="验证码" :disabled="busy" required>
              <template #prefix><CircleCheck aria-hidden="true" class="field-icon" /></template>
            </el-input>
            <button type="button" class="captcha-image" aria-label="刷新图形验证码" title="刷新验证码" :disabled="busy" @click="reloadChallenge">
              <img v-if="image" :src="image" alt="图形验证码" /><span v-else>获取验证码</span>
            </button>
          </div>
          <p v-if="error" class="login-error" role="alert">{{ error }}</p>
          <el-button
            class="submit"
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="!accountTransport || !csrf || (captchaEnabled && !image)"
          >
            登录
          </el-button>
        </form>

        <form v-else @submit.prevent="certificateLogin">
          <div class="certificate-reader">
            <span class="certificate-icon"><Postcard aria-hidden="true" /></span>
            <div>
              <strong>选择本机身份证书</strong>
              <p>请插入已绑定 CSP 账号的 USB Key，并启动本机 SKF 服务。</p>
            </div>
          </div>
          <el-button class="read-certificate" :disabled="busy || !secure || !certificateEnabled" @click="readCertificates">
            <Search aria-hidden="true" class="field-icon" />读取证书列表
          </el-button>
          <select
            v-if="certificates.length"
            v-model="certificateKey"
            aria-label="签名证书"
            class="certificate-select"
            :disabled="busy || !secure"
            required
          >
            <option value="" disabled>请选择签名证书</option>
            <option v-for="item in certificates" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
          <el-input
            v-model="pin"
            aria-label="USB Key PIN"
            type="password"
            autocomplete="off"
            maxlength="64"
            placeholder="请输入 USB Key PIN"
            :disabled="busy || !secure || !certificateEnabled || !certificateKey"
            required
          >
            <template #prefix><Key aria-hidden="true" class="field-icon" /></template>
          </el-input>
          <p v-if="!certificateEnabled" class="transport-note" role="status">当前入口未启用证书登录。</p>
          <p v-if="error" class="login-error" role="alert">{{ error }}</p>
          <el-button
            class="submit"
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="!secure || !csrf || !certificateEnabled || !certificateKey || !pin"
          >
            使用证书登录
          </el-button>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login-layout {
  display: grid;
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  min-height: 100dvh;
}
.brand-panel {
  position: relative;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 64px 24px;
  border-radius: 0;
  background:
    radial-gradient(circle at 72% 24%, #22c55e2e, transparent 32%), radial-gradient(circle at 38% 55%, #178fbe22, transparent 40%),
    linear-gradient(135deg, #f8fffb, #e6f8ef 48%, #dcebf8);
}
.brand-badge {
  position: absolute;
  top: 24px;
  left: 28px;
  display: grid;
  place-items: center;
  width: 42px;
  height: 30px;
  border: 2px solid #26ba72;
  border-radius: 7px;
  background: #ffffffbd;
  color: #137941;
  font-size: 12px;
  font-weight: 800;
}
.brand-copy {
  text-align: center;
}
.brand-illustration {
  position: relative;
  width: 300px;
  height: 246px;
  margin: 0 auto 12px;
}
.brand-platform {
  position: absolute;
  inset: auto 38px 18px;
  height: 136px;
  border-radius: 16px;
  transform: skewX(-19deg);
  background: linear-gradient(135deg, #23c86c, #117dc5);
  box-shadow:
    0 16px 0 #117d57,
    0 32px 44px #097eab47;
}
.brand-emblem {
  position: absolute;
  left: 50%;
  top: 10px;
  display: grid;
  place-items: center;
  width: 150px;
  height: 132px;
  transform: translateX(-50%);
  border: 8px solid #ffffff59;
  border-radius: 22px;
  background: linear-gradient(145deg, #d3f8e9, #99d5f4);
  box-shadow:
    0 12px 0 #157887,
    0 24px 32px #105a8a45;
}
.brand-signal {
  position: absolute;
  top: 55px;
  left: 29px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7568ff, #166cff);
  box-shadow: 160px 135px 0 #465cff;
}
.brand-copy h1 {
  margin: 0;
  color: #344054;
  font-size: 24px;
  line-height: 1.35;
}
.brand-copy p {
  margin: 10px 0 0;
  color: #59697f;
  font-size: 14px;
}
.brand-panel footer {
  position: absolute;
  right: clamp(24px, 4.7vw, 68px);
  bottom: 12px;
  color: #59697f;
  font-size: 12px;
}
.login-main {
  display: grid;
  min-width: 0;
  place-items: center;
  padding: 64px 32px 72px;
  background: white;
  --el-color-primary: #0877e2;
  --el-color-primary-light-3: #176cc0;
  --el-color-primary-dark-2: #085caa;
}
.login-card {
  width: min(388px, 100%);
}
.login-card h2 {
  margin: 0 0 8px;
  color: #202631;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.25;
}
.form-subtitle {
  margin: 0 0 18px;
  color: #59697f;
  font-size: 13px;
}
.login-method {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}
.login-method button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  padding: 4px;
  border: 1px solid #dce3ee;
  border-radius: 6px;
  background: white;
  color: #52627a;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
}
.login-method button[aria-pressed='true'],
.login-method button:hover:not(:disabled) {
  border-color: #aacefd;
  background: #f5faff;
  color: #0966c6;
  box-shadow: 0 0 0 3px #0b7ff314;
}
.login-method svg,
.field-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.login-card form {
  display: grid;
  gap: 14px;
  margin: 14px 0 0;
}
.login-card :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #dce3ee inset;
}
.login-card :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px #1684fc inset,
    0 0 0 3px #1684fc1a;
}
.login-card :deep(.el-input.is-disabled .el-input__wrapper) {
  background: #f9fbfd;
}
.captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 124px;
  gap: 12px;
}
.captcha-image {
  display: grid;
  place-items: center;
  min-width: 0;
  height: 42px;
  padding: 0;
  overflow: hidden;
  border: 1px solid #dce3ee;
  border-radius: 6px;
  background: white;
  color: #52627a;
}
.captcha-image img {
  width: 100%;
  height: 40px;
  object-fit: contain;
}
.transport-note,
.login-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #835214;
  font-size: 13px;
}
.login-error {
  color: #a32d2d;
}
.submit.el-button {
  width: 100%;
  height: 42px;
  margin-top: 4px;
  font-weight: 600;
}
.submit.el-button:not(:disabled) {
  box-shadow: 0 12px 22px #0877e22b;
}
.certificate-reader {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #d5e8ff;
  border-radius: 6px;
  background: #f5faff;
  font-size: 14px;
}
.certificate-reader p {
  margin: 4px 0 0;
  color: #59697f;
  font-size: 13px;
}
.certificate-icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid #cfe6ff;
  border-radius: 6px;
  background: white;
  color: #0877e2;
}
.certificate-icon svg {
  width: 22px;
}
.read-certificate.el-button {
  width: 100%;
  height: 42px;
  border-style: dashed;
}
.read-certificate svg {
  margin-right: 6px;
}
.certificate-select {
  width: 100%;
  min-height: 42px;
  padding: 8px;
  border: 1px solid #dce3ee;
  border-radius: 6px;
  background: white;
  color: #202631;
}
@media (max-width: 900px) {
  .login-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .brand-panel {
    padding: 46px 20px 30px;
  }
  .brand-illustration {
    height: 180px;
    margin-bottom: 0;
    transform: scale(0.74);
  }
  .brand-badge {
    top: 16px;
    left: 18px;
  }
  .brand-panel footer {
    bottom: 5px;
  }
  .login-main {
    padding: 34px 20px 48px;
  }
  .login-card h2 {
    font-size: 26px;
  }
}
@media (max-width: 360px) {
  .brand-illustration {
    width: 252px;
  }
  .captcha-row {
    grid-template-columns: minmax(0, 1fr) 100px;
  }
}
</style>
