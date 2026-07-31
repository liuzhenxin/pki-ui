<template>
  <div class="login">
    <div class="cyber-field" aria-hidden="true">
      <div class="pki-backdrop">
        <span class="cert-visual cert-primary">
          <i></i>
          <i></i>
          <i></i>
          <b></b>
        </span>
        <span class="cert-visual cert-secondary">
          <i></i>
          <i></i>
          <b></b>
        </span>
        <span class="key-visual"></span>
        <span class="chip-visual"></span>
        <span class="trust-chain">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </span>
      </div>
      <span class="field-node node-a"></span>
      <span class="field-node node-b"></span>
      <span class="field-node node-c"></span>
      <span class="scan-line"></span>
    </div>
    <div class="login-shell">
      <section class="auth-panel" aria-label="登录">
        <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
          <div class="title-box">
            <div>
              <p class="form-kicker">Secure Access Node</p>
              <h2 class="title">{{ loginTitle }}</h2>
            </div>
            <lang-select />
          </div>
          <p class="form-subtitle">请输入授权账号，进入 PKI 综合管理控制台。</p>
          <div class="auth-mode-switch" role="tablist" aria-label="登录方式">
            <button
              type="button"
              class="auth-mode-button"
              :class="{ active: authMode === 'password' }"
              role="tab"
              :aria-selected="authMode === 'password'"
              @click="authMode = 'password'"
            >
              <svg-icon icon-class="user" />
              账号登录
            </button>
            <button
              type="button"
              class="auth-mode-button"
              :class="{ active: authMode === 'certificate' }"
              role="tab"
              :aria-selected="authMode === 'certificate'"
              @click="authMode = 'certificate'"
            >
              <svg-icon icon-class="cert" />
              证书登录
            </button>
          </div>
          <el-form-item v-if="tenantEnabled" prop="tenantId">
            <el-select
              v-model="loginForm.tenantId"
              filterable
              :placeholder="proxy.$t('login.selectPlaceholder')"
              style="width: 100%"
              @change="handleTenantChange"
            >
              <el-option v-for="item in tenantList" :key="item.tenantId" :label="item.companyName" :value="item.tenantId"></el-option>
              <template #prefix><svg-icon icon-class="company" class="el-input__icon input-icon" /></template>
            </el-select>
          </el-form-item>
          <template v-if="authMode === 'password'">
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                type="text"
                size="large"
                auto-complete="username"
                clearable
                :placeholder="proxy.$t('login.username')"
                :aria-label="proxy.$t('login.username')"
              >
                <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
              </el-input>
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                size="large"
                auto-complete="current-password"
                show-password
                :placeholder="proxy.$t('login.password')"
                :aria-label="proxy.$t('login.password')"
                @keyup.enter="handleLogin"
              >
                <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
              </el-input>
            </el-form-item>
            <el-form-item v-if="radiusRequired" prop="radiusPassword">
              <el-input
                v-model="loginForm.radiusPassword"
                type="password"
                size="large"
                auto-complete="one-time-code"
                show-password
                :placeholder="`RADIUS ${radiusAuthMethod} 动态口令`"
                aria-label="RADIUS 动态口令"
                @keyup.enter="handleLogin"
              >
                <template #prefix><svg-icon icon-class="lock" class="el-input__icon input-icon" /></template>
              </el-input>
            </el-form-item>
            <el-form-item v-if="captchaEnabled" prop="code" class="code-form-item">
              <el-input
                v-model="loginForm.code"
                size="large"
                auto-complete="off"
                :placeholder="proxy.$t('login.code')"
                :aria-label="proxy.$t('login.code')"
                @keyup.enter="handleLogin"
              >
                <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
              </el-input>
              <button class="login-code" type="button" title="刷新验证码" @click="getCode">
                <img :src="codeUrl" class="login-code-img" alt="验证码" />
              </button>
            </el-form-item>
            <div class="form-options">
              <el-checkbox v-model="loginForm.rememberMe">{{ proxy.$t('login.rememberPassword') }}</el-checkbox>
              <span class="secure-note">
                <svg-icon icon-class="lock" />
                加密传输
              </span>
            </div>
            <!--      <el-form-item style="float: right">-->
            <!--        <el-button circle :title="proxy.$t('login.social.wechat')" @click="doSocialLogin('wechat')">-->
            <!--          <svg-icon icon-class="wechat" />-->
            <!--        </el-button>-->
            <!--        <el-button circle :title="proxy.$t('login.social.maxkey')" @click="doSocialLogin('maxkey')">-->
            <!--          <svg-icon icon-class="maxkey" />-->
            <!--        </el-button>-->
            <!--        <el-button circle :title="proxy.$t('login.social.topiam')" @click="doSocialLogin('topiam')">-->
            <!--          <svg-icon icon-class="topiam" />-->
            <!--        </el-button>-->
            <!--        <el-button circle :title="proxy.$t('login.social.gitee')" @click="doSocialLogin('gitee')">-->
            <!--          <svg-icon icon-class="gitee" />-->
            <!--        </el-button>-->
            <!--        <el-button circle :title="proxy.$t('login.social.github')" @click="doSocialLogin('github')">-->
            <!--          <svg-icon icon-class="github" />-->
            <!--        </el-button>-->
            <!--      </el-form-item>-->
            <el-form-item class="login-action">
              <el-button :loading="loading" size="large" type="primary" class="login-button" @click.prevent="handleLogin">
                <span v-if="!loading">{{ proxy.$t('login.login') }}</span>
                <span v-else>{{ proxy.$t('login.logging') }}</span>
              </el-button>
              <div v-if="register" class="register-link">
                <router-link class="link-type" :to="'/register'">{{ proxy.$t('login.switchRegisterPage') }}</router-link>
              </div>
            </el-form-item>
          </template>
          <template v-else>
            <div class="cert-login-panel">
              <div class="cert-reader">
                <span class="cert-reader-icon">
                  <svg-icon icon-class="cert" />
                </span>
                <div>
                  <p class="cert-reader-title">选择本机身份证书</p>
                  <p class="cert-reader-desc">请插入 UKey 等硬件证书介质，后端接口接入后启用。</p>
                </div>
              </div>
              <button class="cert-select-button" type="button" disabled>
                <svg-icon icon-class="search" />
                读取证书列表
              </button>
              <div class="cert-placeholder">
                <div class="cert-placeholder-line">
                  <span>证书主体</span>
                  <strong>等待选择</strong>
                </div>
                <div class="cert-placeholder-line">
                  <span>证书序列号</span>
                  <strong>未读取</strong>
                </div>
                <div class="cert-placeholder-line">
                  <span>有效期</span>
                  <strong>未校验</strong>
                </div>
              </div>
              <div class="cert-flow">
                <span><svg-icon icon-class="cert" /> 选择证书</span>
                <span><svg-icon icon-class="key" /> PIN 签名</span>
                <span><svg-icon icon-class="lock" /> 身份验证</span>
              </div>
              <el-button size="large" type="primary" class="login-button cert-login-button" disabled>证书登录暂未接入</el-button>
            </div>
          </template>
        </el-form>
      </section>
    </div>
    <!--  底部  -->
    <div class="el-login-footer">
      <span>Copyright © 2018-2026 立志报国 All Rights Reserved.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { encryptExt } from '@/utils/jsencrypt';
import { getCodeImg, getSecrets } from '@/api/login';

import { getTenant } from '@/api/system/tenant';
import { getTenantList } from '@/api/login';

import { authBinding } from '@/api/system/social/auth';
import { useUserStore } from '@/store/modules/user';
import { useSettingsStore } from '@/store/modules/settings';
import { LoginData, TenantVO } from '@/api/types';
import { to } from 'await-to-js';
import { HttpStatus } from '@/enums/RespEnum';
import { useI18n } from 'vue-i18n';
import { v4 as uuidv4 } from 'uuid';
import { getRadiusStatus } from '@/api/ops';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const userStore = useUserStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const { t } = useI18n();

const loginForm = ref<LoginData>({
  tenantId: localStorage.getItem('tenantId') || '',
  tenantCode: localStorage.getItem('tenantCode') || '',
  username: localStorage.getItem('username') || 'admin',
  password: '',
  radiusPassword: '',
  rememberMe: localStorage.getItem('rememberMe') === 'true',
  code: '',
  uuid: ''
} as LoginData);

const loginData = ref<LoginData>({
  tenantId: '',
  tenantCode: '',
  username: '',
  password: '',
  radiusPassword: '',
  rememberMe: false,
  code: '',
  uuid: ''
} as LoginData);

const loginRules: ElFormRules = {
  tenantId: [{ required: true, trigger: 'blur', message: t('login.rule.tenantId.required') }],
  username: [{ required: true, trigger: 'blur', message: t('login.rule.username.required') }],
  password: [{ required: true, trigger: 'blur', message: t('login.rule.password.required') }],
  radiusPassword: [{ required: true, trigger: 'blur', message: '请输入 RADIUS 动态口令' }],
  code: [{ required: true, trigger: 'change', message: t('login.rule.code.required') }]
};

const codeUrl = ref('');
const loading = ref(false);
// 验证码开关
const captchaEnabled = ref(true);
// 租户开关
const tenantEnabled = ref(false);
// 租户列表
const tenantList = ref<TenantVO[]>([]);

// 注册开关
const register = ref(false);
const redirect = ref('/');
const loginRef = ref<ElFormInstance>();

// 密钥
const secretKey = ref('');
const loginTitle = ref(proxy.$t('login.title'));
const authMode = ref<'password' | 'certificate'>('password');
const radiusRequired = ref(false);
const radiusAuthMethod = ref<'PAP' | 'CHAP'>('PAP');

watch(
  () => router.currentRoute.value,
  (newRoute: any) => {
    redirect.value = newRoute.query && newRoute.query.redirect && decodeURIComponent(newRoute.query.redirect);
  },
  { immediate: true }
);

const handleLogin = () => {
  loginRef.value?.validate(async (valid: boolean, fields: any) => {
    if (valid) {
      loading.value = true;

      //const encUserName = encodeURIComponent(encryptExt(loginForm.value.username, secretKey.value));
      //const encPassword = encodeURIComponent(encryptExt(loginForm.value.password, secretKey.value));

      // 勾选了需要记住密码设置在 localStorage 中设置记住用户名和密码
      if (loginForm.value.rememberMe) {
        localStorage.setItem('tenantId', String(loginForm.value.tenantId));
        localStorage.setItem('tenantCode', String(loginForm.value.tenantCode));
        localStorage.setItem('username', String(loginForm.value.username));
        localStorage.setItem('password', String(loginForm.value.password));
        localStorage.setItem('rememberMe', String(loginForm.value.rememberMe));
      } else {
        // 租户用于刷新后恢复系统上下文，不随“记住密码”清理。
        localStorage.setItem('tenantId', String(loginForm.value.tenantId));
        localStorage.setItem('tenantCode', String(loginForm.value.tenantCode));
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('rememberMe');
      }
      // 调用action的登录方法
      //const [err] = await to(userStore.login(loginForm.value));
      loginData.value = loginForm.value;

      const [err] = await to(userStore.login(loginData.value));
      if (!err) {
        const redirectUrl = redirect.value || '/';
        await router.push(redirectUrl);
        loading.value = false;
      } else {
        loading.value = false;
        // 重新获取验证码
        if (captchaEnabled.value) {
          await getCode();
        }
      }
    } else {
      console.log('error submit!', fields);
    }
  });
};

/**
 * 获取验证码
 */
const getCode = async () => {
  try {
    // 刷新验证码时清空输入框
    loginForm.value.code = '';
    const uuid = uuidv4();
    const res = await getCodeImg(uuid);
    loginForm.value.uuid = uuid;
    const { data } = res;
    codeUrl.value = data;
  } catch (err) {
    console.error('获取验证码请求异常', err);
    // 例如弹出提示框或设置全局错误状态
  }
};

/**
 * 获取密钥
 */
const getSecretKey = async () => {
  const res = await getSecrets();
  const { data } = res;
  secretKey.value = data.publicKey;
};

const getLoginData = () => {
  const tenantId = localStorage.getItem('tenantId');
  const tenantCode = localStorage.getItem('tenantCode');
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  const rememberMe = localStorage.getItem('rememberMe');
  loginForm.value = {
    tenantId: tenantId === null ? String(loginForm.value.tenantId) : tenantId,
    tenantCode: tenantCode === null ? String(loginForm.value.tenantCode) : tenantCode,
    username: username === null ? String(loginForm.value.username) : username,
    password: password === null ? String(loginForm.value.password) : String(password),
    rememberMe: rememberMe === null ? false : rememberMe === 'true'
  } as LoginData;
};

const isPkiTenant = (item: any) => {
  const tenantText = `${item?.name ?? ''} ${item?.companyName ?? ''} ${item?.code ?? ''}`.toLowerCase();
  return !tenantText.includes('文件迁移') && !tenantText.includes('migration');
};

const getTenantAppTitle = (tenantName: string, tenantId: string) => {
  if (tenantId === '1') {
    return `${tenantName} (平台运维中心)`;
  }
  if (tenantId === '2') {
    return `${tenantName} (License授权系统)`;
  }
  if (tenantId === '3') {
    return `${tenantName} (密钥管理中心)`;
  }
  if (tenantId === '5') {
    return `${tenantName} (注册认证中心)`;
  }
  if (tenantId === '6') {
    return `${tenantName} (在线证书状态服务)`;
  }
  if (tenantId === '10') {
    return `${tenantName} (NAS网络存储管理系统)`;
  }
  return `${tenantName} (CA)`;
};

/**
 * 获取租户列表
 */
const initTenantList = async () => {
  try {
    const { data } = await getTenantList(false);
    // data is TenantCO[] from backend (id, name, code fields)
    const list: any[] = (Array.isArray(data) ? data : []).filter(isPkiTenant);
    tenantEnabled.value = list.length > 0;
    if (tenantEnabled.value) {
      tenantList.value = list.map((item: any) => ({
        tenantId: String(item.id),
        companyName: item.name,
        tenantCode: item.code,
        domain: null
      }));
      // 如果没有从本地存储中获取到租户ID，或缓存的租户不属于 PKI 平台，则默认选中第一个 PKI 租户。
      const selectedTenant = tenantList.value.find((item) => item.tenantId === loginForm.value.tenantId);
      if (!selectedTenant) {
        loginForm.value.tenantId = tenantList.value[0].tenantId;
        loginForm.value.tenantCode = tenantList.value[0].tenantCode;
        localStorage.setItem('tenantId', String(loginForm.value.tenantId));
        localStorage.setItem('tenantCode', String(loginForm.value.tenantCode));
      } else {
        loginForm.value.tenantCode = selectedTenant.tenantCode;
      }
      // 初始化标题
      if (loginForm.value.tenantId) {
        getTenantInfo(loginForm.value.tenantId);
        refreshRadiusStatus(loginForm.value.tenantCode);
      }
    }
  } catch (error) {
    console.error('获取租户列表失败:', error);
    tenantEnabled.value = false;
  }
};

const handleTenantChange = (val: string) => {
  const tenant = tenantList.value.find((item) => item.tenantId === val);
  if (tenant) {
    loginForm.value.tenantCode = tenant.tenantCode;
    localStorage.setItem('tenantId', String(tenant.tenantId));
    localStorage.setItem('tenantCode', String(tenant.tenantCode));
    getTenantInfo(val);
    refreshRadiusStatus(tenant.tenantCode);
  }
};

const refreshRadiusStatus = async (tenantCode?: string) => {
  try {
    const response = await getRadiusStatus(tenantCode);
    radiusRequired.value = Boolean(response.data?.enabled);
    radiusAuthMethod.value = response.data?.authMethod || 'PAP';
    if (!radiusRequired.value) {
      loginForm.value.radiusPassword = '';
    }
  } catch (error) {
    radiusRequired.value = false;
    console.error('获取 RADIUS 状态失败:', error);
  }
};

/**
 * 获取租户
 */
const getTenantInfo = async (tenantId: string) => {
  const res = await getTenant(tenantId);
  if (res.data && res.data.name) {
    loginTitle.value = res.data.name;
    settingsStore.setAppTitle(getTenantAppTitle(res.data.name, String(tenantId)));
  }
};

/**
 * 第三方登录
 * @param type
 */
const doSocialLogin = (type: string) => {
  authBinding(type, loginForm.value.tenantId).then((res: any) => {
    if (res.code === HttpStatus.SUCCESS) {
      // 获取授权地址跳转
      window.location.href = res.data;
    } else {
      ElMessage.error(res.msg);
    }
  });
};

onMounted(() => {
  getCode();
  getSecretKey();
  getLoginData();
  initTenantList();
});
</script>

<style lang="scss" scoped>
.login {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100dvh;
  padding: 48px 32px 72px;
  overflow: hidden;
  background:
    linear-gradient(135deg, #0b2f4a 0%, #1b6a86 42%, #e7f7ff 100%),
    url('../assets/images/login-background.jpg') center / cover;
  color: #14213d;
}

.login::before {
  position: absolute;
  inset: 0;
  content: '';
  background:
    linear-gradient(120deg, rgba(8, 44, 73, 0.78) 0%, rgba(18, 93, 121, 0.58) 44%, rgba(232, 249, 255, 0.84) 100%),
    radial-gradient(circle at 20% 16%, rgba(125, 211, 252, 0.36), transparent 30%),
    radial-gradient(circle at 72% 34%, rgba(45, 212, 191, 0.28), transparent 28%),
    radial-gradient(circle at 48% 82%, rgba(255, 255, 255, 0.18), transparent 36%);
}

.login::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  background-image:
    linear-gradient(rgba(224, 242, 254, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(224, 242, 254, 0.18) 1px, transparent 1px),
    linear-gradient(135deg, transparent 0 48%, rgba(125, 211, 252, 0.22) 49%, transparent 50%);
  background-size:
    56px 56px,
    56px 56px,
    180px 180px;
  mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.72), transparent 88%);
}

.cyber-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.pki-backdrop {
  position: absolute;
  inset: 0;
  opacity: 0.95;
}

.cert-visual,
.key-visual,
.chip-visual,
.trust-chain {
  position: absolute;
  display: block;
  filter: drop-shadow(0 26px 42px rgba(5, 38, 57, 0.28));
}

.cert-visual {
  width: 210px;
  height: 278px;
  border: 1px solid rgba(191, 244, 255, 0.58);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.84), rgba(191, 244, 255, 0.2) 54%, rgba(13, 148, 136, 0.18)),
    linear-gradient(90deg, rgba(14, 116, 144, 0.16) 1px, transparent 1px), linear-gradient(rgba(14, 116, 144, 0.14) 1px, transparent 1px);
  background-size:
    auto,
    18px 18px,
    18px 18px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.74),
    inset 0 0 42px rgba(34, 211, 238, 0.16);
}

.cert-visual::before {
  position: absolute;
  top: 26px;
  left: 24px;
  width: 52px;
  height: 52px;
  content: '';
  border: 1px solid rgba(8, 145, 178, 0.4);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(15, 118, 110, 0.5) 0 18%, transparent 20%),
    conic-gradient(from 25deg, rgba(34, 211, 238, 0.12), rgba(15, 118, 110, 0.54), rgba(34, 211, 238, 0.12));
}

.cert-visual::after {
  position: absolute;
  right: 20px;
  bottom: 18px;
  width: 46px;
  height: 46px;
  content: '';
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.9) 0 27%, transparent 28%),
    repeating-conic-gradient(from 10deg, rgba(15, 118, 110, 0.8) 0 10deg, rgba(45, 212, 191, 0.35) 10deg 20deg);
  box-shadow:
    0 0 0 8px rgba(45, 212, 191, 0.12),
    0 0 26px rgba(34, 211, 238, 0.42);
}

.cert-visual i,
.cert-visual b {
  position: absolute;
  left: 24px;
  height: 8px;
  content: '';
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(8, 145, 178, 0.72), rgba(103, 232, 249, 0.12));
}

.cert-visual i:nth-child(1) {
  top: 110px;
  width: 136px;
}

.cert-visual i:nth-child(2) {
  top: 138px;
  width: 162px;
}

.cert-visual i:nth-child(3) {
  top: 166px;
  width: 118px;
}

.cert-visual b {
  top: 204px;
  width: 96px;
  height: 26px;
  border: 1px solid rgba(45, 212, 191, 0.38);
  background:
    linear-gradient(90deg, rgba(20, 184, 166, 0.24), rgba(125, 211, 252, 0.08)),
    repeating-linear-gradient(90deg, rgba(8, 145, 178, 0.5) 0 2px, transparent 2px 7px);
}

.cert-primary {
  left: clamp(48px, 8vw, 130px);
  top: 16%;
  transform: rotate(-8deg);
}

.cert-secondary {
  left: clamp(190px, 22vw, 330px);
  top: 34%;
  width: 168px;
  height: 224px;
  opacity: 0.7;
  transform: rotate(8deg);
}

.cert-secondary i:nth-child(3) {
  display: none;
}

.cert-secondary b {
  top: 166px;
}

.key-visual {
  left: clamp(280px, 31vw, 470px);
  top: 18%;
  width: 180px;
  height: 74px;
  opacity: 0.72;
  transform: rotate(-18deg);
}

.key-visual::before {
  position: absolute;
  left: 0;
  top: 1px;
  width: 68px;
  height: 68px;
  content: '';
  border: 11px solid rgba(191, 244, 255, 0.62);
  border-radius: 50%;
  box-shadow:
    inset 0 0 28px rgba(34, 211, 238, 0.2),
    0 0 24px rgba(34, 211, 238, 0.22);
}

.key-visual::after {
  position: absolute;
  left: 62px;
  top: 31px;
  width: 116px;
  height: 12px;
  content: '';
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(191, 244, 255, 0.76), rgba(45, 212, 191, 0.24));
  box-shadow:
    60px 18px 0 -1px rgba(191, 244, 255, 0.58),
    82px -18px 0 -2px rgba(191, 244, 255, 0.42);
}

.chip-visual {
  left: clamp(58px, 7vw, 116px);
  bottom: 13%;
  width: 146px;
  height: 146px;
  border: 1px solid rgba(191, 244, 255, 0.46);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.48) 0 24%, transparent 25%),
    linear-gradient(135deg, rgba(14, 116, 144, 0.32), rgba(125, 211, 252, 0.12)),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0 2px, transparent 2px 18px);
  opacity: 0.74;
  transform: rotate(11deg);
}

.chip-visual::before,
.chip-visual::after {
  position: absolute;
  content: '';
  background: repeating-linear-gradient(90deg, rgba(191, 244, 255, 0.52) 0 10px, transparent 10px 19px);
}

.chip-visual::before {
  left: -28px;
  right: -28px;
  top: 30px;
  height: 10px;
  box-shadow: 0 76px 0 rgba(191, 244, 255, 0.28);
}

.chip-visual::after {
  top: -28px;
  bottom: -28px;
  left: 30px;
  width: 10px;
  transform: rotate(90deg);
  box-shadow: 76px 0 0 rgba(191, 244, 255, 0.28);
}

.trust-chain {
  left: clamp(240px, 28vw, 430px);
  bottom: 15%;
  width: 300px;
  height: 140px;
  opacity: 0.78;
}

.trust-chain::before {
  position: absolute;
  left: 34px;
  right: 34px;
  top: 66px;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, rgba(191, 244, 255, 0.08), rgba(191, 244, 255, 0.72), rgba(20, 184, 166, 0.16));
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.36);
}

.trust-chain i {
  position: absolute;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(191, 244, 255, 0.56);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.8) 0 17%, transparent 18%),
    radial-gradient(circle, rgba(20, 184, 166, 0.22), rgba(14, 116, 144, 0.1));
  box-shadow: 0 0 24px rgba(34, 211, 238, 0.24);
}

.trust-chain i:nth-child(1) {
  left: 0;
  top: 46px;
}

.trust-chain i:nth-child(2) {
  left: 82px;
  top: 12px;
}

.trust-chain i:nth-child(3) {
  left: 166px;
  top: 70px;
}

.trust-chain i:nth-child(4) {
  right: 0;
  top: 36px;
}

.field-node {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #67e8f9;
  box-shadow:
    0 0 0 7px rgba(103, 232, 249, 0.1),
    0 0 34px rgba(103, 232, 249, 0.7);
}

.field-node::before,
.field-node::after {
  position: absolute;
  content: '';
  height: 1px;
  background: linear-gradient(90deg, rgba(103, 232, 249, 0.72), transparent);
  transform-origin: left center;
}

.field-node::before {
  width: 170px;
  transform: rotate(18deg);
}

.field-node::after {
  width: 120px;
  transform: rotate(92deg);
}

.node-a {
  left: 13%;
  top: 22%;
}

.node-b {
  left: 47%;
  top: 72%;
}

.node-c {
  right: 18%;
  top: 18%;
}

.scan-line {
  position: absolute;
  top: -20%;
  left: 58%;
  width: 1px;
  height: 140%;
  background: linear-gradient(180deg, transparent, rgba(45, 212, 191, 0.82), transparent);
  box-shadow: 0 0 28px rgba(45, 212, 191, 0.8);
  transform: rotate(16deg);
  animation: scanSweep 5.8s ease-in-out infinite;
}

.login-shell {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  width: min(1120px, 100%);
  align-items: center;
}

.form-kicker {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  color: #65e6d2;
  text-transform: uppercase;
}

.auth-panel {
  width: min(460px, 100%);
}

.title-box {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 6px;

  .title {
    margin: 2px 0 0;
    color: #14213d;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 0;
  }

  :deep(.lang-select--style) {
    line-height: 0;
    color: #47607e;
  }
}

.form-subtitle {
  margin: 0 0 18px;
  color: #667085;
  font-size: 14px;
  line-height: 1.7;
}

.form-kicker {
  color: #0f766e;
}

.auth-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 5px;
  margin-bottom: 20px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 8px;
  background: rgba(241, 250, 255, 0.78);
}

.auth-mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  gap: 8px;
  padding: 0 12px;
  color: #52677f;
  cursor: pointer;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  transition:
    color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.auth-mode-button .svg-icon {
  width: 15px;
  height: 15px;
}

.auth-mode-button:hover,
.auth-mode-button:focus-visible {
  color: #0f766e;
  outline: none;
  background: rgba(255, 255, 255, 0.72);
}

.auth-mode-button.active {
  color: #0f766e;
  background: #ffffff;
  box-shadow:
    0 8px 22px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(15, 118, 110, 0.16) inset;
}

.auth-mode-button:active {
  transform: translateY(1px);
}

.login-form {
  position: relative;
  width: 100%;
  padding: 34px;
  overflow: hidden;
  border: 1px solid rgba(103, 232, 249, 0.32);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(239, 252, 255, 0.9)),
    linear-gradient(90deg, rgba(14, 165, 233, 0.08) 1px, transparent 1px);
  background-size:
    auto,
    24px 24px;
  box-shadow:
    0 28px 80px rgba(15, 23, 42, 0.3),
    0 0 0 1px rgba(45, 212, 191, 0.08),
    0 0 46px rgba(14, 165, 233, 0.18);
  backdrop-filter: blur(20px);

  &::before {
    position: absolute;
    top: 0;
    left: 22px;
    right: 22px;
    height: 2px;
    content: '';
    background: linear-gradient(90deg, transparent, #22d3ee, #14b8a6, transparent);
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.72);
  }

  &::after {
    position: absolute;
    right: 18px;
    bottom: 18px;
    width: 86px;
    height: 86px;
    content: '';
    pointer-events: none;
    border-right: 1px solid rgba(14, 116, 144, 0.2);
    border-bottom: 1px solid rgba(14, 116, 144, 0.2);
    background: linear-gradient(90deg, rgba(14, 116, 144, 0.18) 1px, transparent 1px), linear-gradient(rgba(14, 116, 144, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
    opacity: 0.55;
  }

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .el-input {
    height: 46px;

    input {
      height: 46px;
      color: #14213d;
    }
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    min-height: 46px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 0 0 1px #c5d7e7 inset;
    transition:
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }

  :deep(.el-input__wrapper:hover),
  :deep(.el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px #9fb2c8 inset;
  }

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-select__wrapper.is-focused) {
    box-shadow:
      0 0 0 1px #0f766e inset,
      0 0 0 4px rgba(15, 118, 110, 0.12);
  }

  .input-icon {
    height: 44px;
    width: 15px;
    margin-left: 0;
    color: #64748b;
  }
}

.login-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
}

.login-code {
  flex: 0 0 132px;
  height: 46px;
  padding: 0;
  margin: 0;
  overflow: hidden;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid #d7dee8;
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  img {
    vertical-align: middle;
  }
}

.login-code:hover,
.login-code:focus-visible {
  border-color: #0f766e;
  box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
}

.login-code:active {
  transform: scale(0.98);
}

.code-form-item {
  :deep(.el-form-item__content) {
    display: flex;
    flex-wrap: nowrap;
    gap: 12px;
  }
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 2px 0 24px;
}

.secure-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.secure-note .svg-icon {
  width: 14px;
  height: 14px;
}

.cert-login-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cert-reader {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 90px;
  padding: 16px;
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(236, 253, 245, 0.9), rgba(240, 249, 255, 0.78)), linear-gradient(90deg, rgba(14, 116, 144, 0.1) 1px, transparent 1px);
  background-size:
    auto,
    18px 18px;
}

.cert-reader-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  color: #0f766e;
  border: 1px solid rgba(15, 118, 110, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 12px 28px rgba(20, 184, 166, 0.14);
}

.cert-reader-icon .svg-icon {
  width: 25px;
  height: 25px;
}

.cert-reader-title {
  margin: 0;
  color: #14213d;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.cert-reader-desc {
  margin: 5px 0 0;
  color: #667085;
  font-size: 13px;
  line-height: 1.55;
}

.cert-select-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  color: #0f766e;
  border: 1px dashed rgba(15, 118, 110, 0.38);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.62);
  font-size: 14px;
  font-weight: 700;
}

.cert-select-button .svg-icon {
  width: 15px;
  height: 15px;
}

.cert-select-button:disabled,
.cert-login-button.is-disabled {
  cursor: not-allowed;
}

.cert-placeholder {
  padding: 12px 14px;
  border: 1px solid rgba(203, 213, 225, 0.86);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.78);
}

.cert-placeholder-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  color: #667085;
  font-size: 13px;
}

.cert-placeholder-line + .cert-placeholder-line {
  border-top: 1px solid rgba(226, 232, 240, 0.86);
}

.cert-placeholder-line strong {
  color: #334155;
  font-weight: 700;
}

.cert-flow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.cert-flow span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  color: #0f766e;
  border: 1px solid rgba(20, 184, 166, 0.18);
  border-radius: 8px;
  background: rgba(236, 253, 245, 0.62);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.cert-flow .svg-icon {
  width: 13px;
  height: 13px;
}

.login-action {
  margin-bottom: 0 !important;
}

.login-button {
  width: 100%;
  min-height: 46px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0891b2 0%, #0f766e 54%, #0f172a 100%);
  box-shadow:
    0 14px 34px rgba(8, 145, 178, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  font-weight: 700;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}

.login-button:hover,
.login-button:focus {
  filter: brightness(1.05);
  box-shadow:
    0 18px 38px rgba(8, 145, 178, 0.42),
    0 0 24px rgba(20, 184, 166, 0.2);
}

.login-button:active {
  transform: translateY(1px);
}

.register-link {
  width: 100%;
  margin-top: 14px;
  text-align: right;
}

.el-login-footer {
  z-index: 1;
  min-height: 40px;
  line-height: 40px;
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
  color: rgba(255, 255, 255, 0.74);
  font-family: Arial, serif;
  font-size: 12px;
  letter-spacing: 0;
}

.login-code-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

@media (max-width: 960px) {
  .login {
    padding: 32px 20px 70px;
  }

  .login-shell {
    justify-content: center;
  }

  .pki-backdrop {
    opacity: 0.38;
  }

  .cert-primary {
    left: -72px;
    top: 10%;
  }

  .cert-secondary,
  .key-visual {
    display: none;
  }

  .chip-visual {
    left: auto;
    right: -42px;
    bottom: 10%;
  }

  .trust-chain {
    left: 50%;
    bottom: 8%;
    transform: translateX(-50%);
  }
}

@media (max-width: 560px) {
  .login {
    padding: 24px 14px 72px;
  }

  .pki-backdrop {
    opacity: 0.26;
  }

  .login-form {
    padding: 26px 20px;
  }

  .auth-mode-button {
    padding: 0 8px;
    font-size: 13px;
  }

  .title-box {
    align-items: center;
  }

  .title-box .title {
    font-size: 22px;
  }

  .code-form-item {
    :deep(.el-form-item__content) {
      flex-wrap: wrap;
    }
  }

  .login-code {
    flex-basis: 100%;
  }

  .cert-reader {
    align-items: flex-start;
  }

  .cert-flow {
    grid-template-columns: 1fr;
  }

  .cert-placeholder-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line {
    animation: none;
  }

  .login-code,
  .login-button,
  .login-form :deep(.el-input__wrapper),
  .login-form :deep(.el-select__wrapper) {
    transition: none;
  }
}

@keyframes scanSweep {
  0%,
  100% {
    opacity: 0.2;
    transform: translateX(-140px) rotate(16deg);
  }

  50% {
    opacity: 0.82;
    transform: translateX(120px) rotate(16deg);
  }
}
</style>
