<template>
  <div class="login" :class="{ 'login--tenant-background': hasTenantLoginBackground }" :style="loginBackgroundStyle">
    <div class="login-shell">
      <section class="brand-panel" :class="tenantBrand.className" aria-label="平台介绍">
        <div class="brand-header">
          <span class="brand-logo">{{ tenantBrand.logo }}</span>
          <span class="brand-name">{{ title }}</span>
        </div>
        <div class="brand-visual" aria-hidden="true">
          <span class="visual-base"></span>
          <span class="visual-platform"></span>
          <span class="visual-shield"></span>
          <span class="visual-cert visual-cert-a"></span>
          <span class="visual-cert visual-cert-b"></span>
          <span class="visual-key"></span>
          <span class="visual-bar visual-bar-a"></span>
          <span class="visual-bar visual-bar-b"></span>
          <span class="visual-bar visual-bar-c"></span>
          <span class="visual-node visual-node-a"></span>
          <span class="visual-node visual-node-b"></span>
          <span class="visual-app visual-app-ops"></span>
          <span class="visual-app visual-app-ca"></span>
          <span class="visual-app visual-app-kmc"></span>
          <span class="visual-app visual-app-ra"></span>
          <span class="visual-app visual-app-ocsp"></span>
        </div>
        <div class="brand-copy">
          <h1>{{ tenantBrand.heading }}</h1>
          <p>{{ tenantBrand.subtitle }}</p>
        </div>
      </section>
      <section class="auth-panel" aria-label="登录">
        <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
          <div class="title-box">
            <div>
              <h2 class="title">欢迎回来</h2>
              <p class="form-subtitle">请输入您的账户信息以进入 {{ loginTitle }}</p>
            </div>
            <lang-select />
          </div>
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
              v-if="!singleTenant"
              v-model="loginForm.tenantId"
              filterable
              :placeholder="proxy.$t('login.selectPlaceholder')"
              style="width: 100%"
              @change="handleTenantChange"
            >
              <el-option v-for="item in tenantList" :key="item.tenantId" :label="item.companyName" :value="item.tenantId"></el-option>
              <template #prefix><svg-icon icon-class="company" class="el-input__icon input-icon" /></template>
            </el-select>
            <el-input v-else :model-value="tenantList[0]?.companyName || ''" disabled readonly aria-label="当前系统租户">
              <template #prefix><svg-icon icon-class="company" class="el-input__icon input-icon" /></template>
            </el-input>
          </el-form-item>
          <el-alert
            v-if="tenantWhitelistMissed"
            type="error"
            :closable="false"
            show-icon
            class="tenant-whitelist-miss-alert"
            title="当前系统租户未启用"
            description="构建时配置的租户白名单在本环境未匹配到任何租户，请检查租户状态或前端构建参数 VITE_APP_TENANT_IDS。"
          />
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
              <button class="login-code" type="button" title="刷新验证码" :disabled="captchaLoading" @click="getCode()">
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
                  <p class="cert-reader-desc">请插入 USB Key，并确认本机 SKF 服务已启动。{{ certUsbMonitoring ? '正在监听设备插拔…' : '' }}</p>
                </div>
              </div>
              <button class="cert-select-button" type="button" :disabled="certificateReading || certificateLoading" @click="handleReadCertificates">
                <svg-icon icon-class="search" />
                {{ certificateReading ? '正在读取证书…' : '读取证书列表' }}
              </button>
              <el-select
                v-if="certificateOptions.length"
                v-model="certificateForm.certKey"
                size="large"
                filterable
                placeholder="请选择签名证书"
                style="width: 100%"
              >
                <el-option v-for="item in certificateOptions" :key="item.key" :label="item.label" :value="item.key" />
              </el-select>
              <div class="cert-placeholder">
                <div class="cert-placeholder-line">
                  <span>证书主体</span>
                  <strong>{{ selectedCertificate?.subject || '等待选择' }}</strong>
                </div>
                <div class="cert-placeholder-line">
                  <span>证书序列号</span>
                  <strong>{{ selectedCertificate?.serialNumber || '未读取' }}</strong>
                </div>
                <div class="cert-placeholder-line">
                  <span>有效期</span>
                  <strong>{{ selectedCertificate?.validity || '未校验' }}</strong>
                </div>
              </div>
              <el-input
                v-model="certificateForm.pin"
                size="large"
                type="password"
                show-password
                autocomplete="off"
                placeholder="请输入 USB Key User PIN"
                :disabled="!selectedCertificate || certificateLoading"
                @keyup.enter="handleCertificateLogin"
              >
                <template #prefix><svg-icon icon-class="key" class="el-input__icon input-icon" /></template>
              </el-input>
              <div class="cert-flow">
                <span><svg-icon icon-class="cert" /> 选择证书</span>
                <span><svg-icon icon-class="key" /> PIN 签名</span>
                <span><svg-icon icon-class="lock" /> 身份验证</span>
              </div>
              <el-button
                size="large"
                type="primary"
                class="login-button cert-login-button"
                :loading="certificateLoading"
                :disabled="!selectedCertificate || !certificateForm.pin"
                @click="handleCertificateLogin"
              >
                {{ certificateLoading ? certificateLoginStep : '使用证书登录' }}
              </el-button>
            </div>
          </template>
        </el-form>
      </section>
    </div>
    <!--  底部  -->
    <div class="el-login-footer">
      <span>版本信息：v{{ systemVersion }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createCertificateLoginChallenge, getCodeImg, getLoginHints, getSecrets, verifyCertificateLoginSignature } from '@/api/login';
import SKFClient from '@/api/skf/skf_api';
import { calculateSm2SignatureDigest, normalizeSm2SignatureForApi } from '@/utils/sm2SignatureDigest';
import { X509 } from 'jsrsasign';

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
import defaultLoginBackground from '@/assets/images/login-background.jpg';
import opsLoginBackground from '@/assets/images/login/tenant-ops.webp';
import caLoginBackground from '@/assets/images/login/tenant-ca.webp';
import kmcLoginBackground from '@/assets/images/login/tenant-kmc.webp';
import raLoginBackground from '@/assets/images/login/tenant-ra.webp';
import ocspLoginBackground from '@/assets/images/login/tenant-ocsp.webp';
import nasLoginBackground from '@/assets/images/login/tenant-nas.webp';
import licenseLoginBackground from '@/assets/images/login/tenant-license.webp';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const systemVersion = import.meta.env.VITE_APP_VERSION || '未知';
const userStore = useUserStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const { t } = useI18n();

const configuredTenantIds = (import.meta.env.VITE_APP_TENANT_IDS || '')
  .split(',')
  .map((tenantId) => tenantId.trim())
  .filter(Boolean);
const cachedTenantId = localStorage.getItem('tenantId') || '';
const initialTenantId = configuredTenantIds.length && !configuredTenantIds.includes(cachedTenantId) ? configuredTenantIds[0] : cachedTenantId;

const loginForm = ref<LoginData>({
  tenantId: initialTenantId,
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
const captchaLoading = ref(false);
const CAPTCHA_REQUEST_INTERVAL_MS = 1200;
let lastCaptchaRequestAt = 0;
// 租户开关
const tenantEnabled = ref(false);
// 租户列表
const tenantList = ref<TenantVO[]>([]);
// 单租户：白名单只命中一个租户，下拉选择无意义，改为只读展示
const singleTenant = computed(() => tenantList.value.length === 1);
// 白名单未命中：构建时配置了 VITE_APP_TENANT_IDS，但后端返回的租户中没有匹配项
const tenantWhitelistMissed = ref(false);

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
type CertificateOption = {
  key: string;
  cert: string;
  label: string;
  subject: string;
  serialNumber: string;
  validity: string;
};
const certificateOptions = ref<CertificateOption[]>([]);
const certificateForm = reactive({ certKey: '', pin: '' });
const certificateReading = ref(false);
const certificateLoading = ref(false);
const certificateLoginStep = ref('正在验证证书…');
const skfServiceUrl = import.meta.env.VITE_APP_SKF_WS_URL || 'ws://127.0.0.1:9001';
let skfClient: SKFClient | null = null;
const selectedCertificate = computed(() => certificateOptions.value.find((item) => item.key === certificateForm.certKey));

// --- USB Key 插拔监控（证书登录场景） ---
let certUsbMonitoringActive = false;
const monitoredCertProviders = new Set<string>();
const certUsbMonitoring = ref(false);
const sleepMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopCertUsbMonitoring() {
  certUsbMonitoringActive = false;
  monitoredCertProviders.clear();
  certUsbMonitoring.value = false;
}

async function monitorCertProvider(provider: string) {
  while (certUsbMonitoringActive) {
    try {
      const skf = await getCertificateSkfClient();
      const event = await skf.waitForDevEvent(provider);
      if (!certUsbMonitoringActive) break;
      if (event.event === 1) {
        // 插入：静默重读证书列表并提示
        const before = certificateOptions.value.length;
        await loadCertificateList(true);
        const added = certificateOptions.value.length - before;
        ElMessage.info(
          added > 0
            ? `检测到 USB Key ${event.deviceName || ''} 插入，已读取 ${certificateOptions.value.length} 张签名证书`
            : `检测到 USB Key ${event.deviceName || ''} 插入，但未找到可用签名证书`
        );
      } else {
        // 拔出：清空证书与 PIN
        certificateOptions.value = [];
        certificateForm.certKey = '';
        certificateForm.pin = '';
        ElMessage.info(`USB Key ${event.deviceName || ''} 已拔出，证书列表已清空`);
      }
    } catch {
      if (!certUsbMonitoringActive) break;
      await sleepMs(1500);
    }
  }
}

async function monitorCertLoop() {
  while (certUsbMonitoringActive) {
    try {
      const skf = await getCertificateSkfClient();
      const providers = await skf.enumProvider();
      if (!providers.length) {
        certUsbMonitoring.value = false;
        await sleepMs(3000);
        continue;
      }
      certUsbMonitoring.value = true;
      providers.forEach((provider: string) => {
        if (!monitoredCertProviders.has(provider)) {
          monitoredCertProviders.add(provider);
          void monitorCertProvider(provider);
        }
      });
      await sleepMs(5000);
    } catch {
      if (!certUsbMonitoringActive) break;
      certUsbMonitoring.value = false;
      await sleepMs(3000);
    }
  }
}

async function startCertUsbMonitoring() {
  if (certUsbMonitoringActive) return;
  certUsbMonitoringActive = true;
  await monitorCertLoop();
}

watch(authMode, (mode) => {
  if (mode !== 'certificate') {
    void stopCertUsbMonitoring();
  }
});

const tenantLoginBackgrounds: Record<string, string> = {
  '1': opsLoginBackground,
  '3': kmcLoginBackground,
  '4': caLoginBackground,
  '5': raLoginBackground,
  '6': ocspLoginBackground,
  '10': nasLoginBackground,
  '100': licenseLoginBackground
};
const tenantLoginPanelThemes: Record<string, { panel: string; input: string; border: string }> = {
  '4': {
    panel: 'rgba(244, 241, 233, 0.9)',
    input: 'rgba(255, 252, 246, 0.72)',
    border: 'rgba(255, 255, 255, 0.5)'
  }
};
const defaultTenantBrand = {
  className: 'brand-panel--pki',
  logo: 'PKI',
  heading: 'PKI 综合管理平台',
  subtitle: '面向 CA、RA、KMC、OCSP 的统一安全运营入口'
};
const tenantBrandProfiles: Record<string, typeof defaultTenantBrand> = {
  '1': {
    className: 'brand-panel--ops',
    logo: 'OPS',
    heading: '平台运维中心',
    subtitle: '统一编排平台组件、容器状态、安全策略与审计任务'
  },
  '3': {
    className: 'brand-panel--kmc',
    logo: 'KMC',
    heading: '密钥管理中心',
    subtitle: '集中管理密钥生命周期、恢复流程与密码资源调度'
  },
  '4': {
    className: 'brand-panel--ca',
    logo: 'CA',
    heading: '证书认证中心',
    subtitle: '签发、更新、吊销与归档数字证书的可信根入口'
  },
  '5': {
    className: 'brand-panel--ra',
    logo: 'RA',
    heading: '注册认证中心',
    subtitle: '承载证书申请、审核流转与业务身份核验'
  },
  '6': {
    className: 'brand-panel--ocsp',
    logo: 'OCSP',
    heading: '在线证书状态服务',
    subtitle: '实时响应证书有效性查询，保障验证链路可用可信'
  },
  '10': {
    className: 'brand-panel--nas',
    logo: 'NAS',
    heading: '网络存储管理系统',
    subtitle: '管理存储资源、迁移任务与数据访问安全边界'
  },
  '100': {
    className: 'brand-panel--license',
    logo: 'LIC',
    heading: 'License 授权系统',
    subtitle: '统一管理产品授权、许可状态与客户交付凭证'
  }
};
const hasTenantLoginBackground = computed(() => Boolean(tenantLoginBackgrounds[String(loginForm.value.tenantId || '')]));
const tenantBrand = computed(() => tenantBrandProfiles[String(loginForm.value.tenantId || '')] || defaultTenantBrand);
const loginBackgroundStyle = computed(() => {
  const tenantId = String(loginForm.value.tenantId || '');
  const panelTheme = tenantLoginPanelThemes[tenantId];
  return {
    '--login-background-image': `url("${tenantLoginBackgrounds[tenantId] || defaultLoginBackground}")`,
    '--login-panel-background': panelTheme?.panel || 'rgba(229, 238, 242, 0.9)',
    '--login-panel-input-background': panelTheme?.input || 'rgba(248, 251, 252, 0.72)',
    '--login-panel-border': panelTheme?.border || 'rgba(255, 255, 255, 0.46)'
  };
});

watch(
  () => router.currentRoute.value,
  (newRoute: any) => {
    redirect.value = newRoute.query && newRoute.query.redirect && decodeURIComponent(newRoute.query.redirect);
  },
  { immediate: true }
);

const handleLogin = () => {
  if (tenantWhitelistMissed.value) {
    ElMessage.error('当前系统租户未启用，无法登录，请联系管理员');
    return;
  }
  loginRef.value?.validate(async (valid: boolean, fields: any) => {
    if (valid) {
      loading.value = true;

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
      loginData.value = { ...loginForm.value, publicKey: secretKey.value };

      const [err] = await to(userStore.login(loginData.value));
      if (!err) {
        const redirectUrl = redirect.value || '/';
        await router.push(redirectUrl);
        loading.value = false;
      } else {
        loading.value = false;
        const msg = String((err as any)?.message || (err as any)?.msg || '');
        if (msg.includes('请输入验证码')) {
          captchaEnabled.value = true;
          await getCode();
        } else if (captchaEnabled.value) {
          await getCode();
        }
      }
    } else {
      console.log('error submit!', fields);
    }
  });
};

function parseCertificateOption(item: any): CertificateOption | null {
  try {
    const cert = String(item?.cert || '').replace(/\s+/g, '');
    if (!cert || item?.type !== 'Sign') return null;
    const x509 = new X509();
    x509.readCertPEM(`-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`);
    const subject = x509.getSubjectString();
    const serialNumber = x509.getSerialNumberHex().toUpperCase();
    const validity = `${formatCertificateTime(x509.getNotBefore())} 至 ${formatCertificateTime(x509.getNotAfter())}`;
    return {
      key: String(item.key),
      cert,
      label: `${subject} · ${serialNumber}`,
      subject,
      serialNumber,
      validity
    };
  } catch {
    return null;
  }
}

function formatCertificateTime(value: string) {
  const normalized = String(value || '').replace(/Z$/, '');
  if (!/^\d{12}$|^\d{14}$/.test(normalized)) return value || '-';
  const offset = normalized.length === 12 ? 2 : 4;
  const shortYear = normalized.slice(0, offset);
  const year = offset === 4 ? shortYear : Number(shortYear) >= 50 ? `19${shortYear}` : `20${shortYear}`;
  return `${year}-${normalized.slice(offset, offset + 2)}-${normalized.slice(offset + 2, offset + 4)} ${normalized.slice(offset + 4, offset + 6)}:${normalized.slice(offset + 6, offset + 8)}:${normalized.slice(offset + 8, offset + 10)} UTC`;
}

async function getCertificateSkfClient() {
  if (skfClient?.isConnected()) return skfClient;
  skfClient = new SKFClient(skfServiceUrl);
  await skfClient.connect();
  return skfClient;
}

async function loadCertificateList(silent = false) {
  certificateReading.value = true;
  try {
    const skf = await getCertificateSkfClient();
    certificateOptions.value = (await skf.findCertificates('Sign'))
      .map(parseCertificateOption)
      .filter((item): item is CertificateOption => item !== null);
    if (!certificateOptions.value.length) {
      certificateForm.certKey = '';
      if (!silent) ElMessage.warning('USB Key 中未找到可用的签名证书');
      return;
    }
    if (!certificateOptions.value.some((item) => item.key === certificateForm.certKey)) {
      certificateForm.certKey = certificateOptions.value[0].key;
    }
    if (!silent) ElMessage.success(`已读取 ${certificateOptions.value.length} 张签名证书`);
  } catch (error: any) {
    certificateOptions.value = [];
    certificateForm.certKey = '';
    if (!silent) ElMessage.error(`读取 USB Key 失败：${error?.message || '请检查本机 SKF 服务'}`);
  } finally {
    certificateReading.value = false;
  }
}

async function handleReadCertificates() {
  await loadCertificateList(false);
}

async function handleCertificateLogin() {
  if (tenantWhitelistMissed.value) {
    ElMessage.error('当前系统租户未启用，无法登录，请联系管理员');
    return;
  }
  const certificate = selectedCertificate.value;
  const tenantCode = String(loginForm.value.tenantCode || '');
  if (!tenantCode) {
    ElMessage.warning('请先选择租户');
    return;
  }
  if (!certificate || !certificateForm.pin) {
    ElMessage.warning('请选择签名证书并输入 USB Key PIN');
    return;
  }

  certificateLoading.value = true;
  try {
    certificateLoginStep.value = '正在申请挑战…';
    const challengeResponse: any = await createCertificateLoginChallenge({ tenantCode, certificate: certificate.cert });
    const challenge = challengeResponse?.data;
    if (!challenge?.challengeId || !challenge?.signData) throw new Error('认证服务未返回有效挑战');

    const skf = await getCertificateSkfClient();
    certificateLoginStep.value = '正在验证 PIN…';
    const pinValid = await skf.checkPIN(certificate.key, certificateForm.pin);
    if (!pinValid) throw new Error('USB Key PIN 验证失败');
    certificateLoginStep.value = '请在 USB Key 上确认签名…';
    const digest = calculateSm2SignatureDigest(certificate.cert, challenge.signData, challenge.sm2UserId);
    const signature = normalizeSm2SignatureForApi(await skf.signData(certificate.key, digest));

    certificateLoginStep.value = '正在验证身份…';
    const verificationResponse: any = await verifyCertificateLoginSignature({
      challengeId: challenge.challengeId,
      certificate: certificate.cert,
      signature
    });
    const certificateCode = verificationResponse?.data?.certificateCode;
    if (!certificateCode) throw new Error('认证服务未返回一次性认证码');

    certificateLoginStep.value = '正在签发令牌…';
    await userStore.certificateLogin(certificateCode, String(loginForm.value.tenantId || ''));
    localStorage.setItem('tenantId', String(loginForm.value.tenantId || ''));
    localStorage.setItem('tenantCode', tenantCode);
    certificateForm.pin = '';
    await router.push(redirect.value || '/');
  } catch (error: any) {
    certificateForm.pin = '';
    ElMessage.error(error?.message || error?.msg || '证书登录失败，请重新读取证书后重试');
  } finally {
    certificateLoading.value = false;
    certificateLoginStep.value = '正在验证证书…';
  }
}

/**
 * 获取验证码
 */
const getCode = async (tenantCode = String(loginForm.value.tenantCode || '')) => {
  const now = Date.now();
  if (captchaLoading.value || now - lastCaptchaRequestAt < CAPTCHA_REQUEST_INTERVAL_MS) {
    return;
  }

  captchaLoading.value = true;
  lastCaptchaRequestAt = now;
  try {
    loginForm.value.code = '';
    const uuid = uuidv4();
    const res = await getCodeImg(uuid, tenantCode);
    if (tenantCode !== String(loginForm.value.tenantCode || '')) {
      return;
    }
    loginForm.value.uuid = uuid;
    const { data } = res;
    codeUrl.value = data;
  } catch (err) {
    console.error('获取验证码请求异常', err);
  } finally {
    captchaLoading.value = false;
  }
};

const loadLoginHints = async () => {
  const tenantCode = String(loginForm.value.tenantCode || '');
  if (!tenantCode) {
    return;
  }
  try {
    const res = await getLoginHints(tenantCode);
    const hints = (res as any)?.data ?? res;
    if (tenantCode !== String(loginForm.value.tenantCode || '')) {
      return;
    }
    captchaEnabled.value = hints?.captchaEnabled !== false;
    sessionStorage.setItem('idleTimeoutMinutes', String(hints?.idleTimeoutMinutes || 240));
    if (captchaEnabled.value) {
      await getCode(tenantCode);
    }
  } catch (_err) {
    if (tenantCode !== String(loginForm.value.tenantCode || '')) {
      return;
    }
    captchaEnabled.value = true;
    await getCode(tenantCode);
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
  // 租户优先用下拉选择（loginForm），localStorage 仅作无选择时的默认，
  // 避免缓存的上一个系统租户覆盖当前 UI 下拉选中的租户。
  const formTenantId = String(loginForm.value.tenantId || '');
  const formTenantCode = String(loginForm.value.tenantCode || '');
  loginForm.value = {
    tenantId: formTenantId || tenantId || '',
    tenantCode: formTenantCode || tenantCode || '',
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
  if (tenantId === '100') {
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
    // 按本 UI 部署的系统过滤租户（VITE_APP_TENANT_IDS 逗号分隔；空 = 全部 PKI 租户）
    const filtered: any[] = configuredTenantIds.length ? list.filter((t) => configuredTenantIds.includes(String(t.id))) : list;

    // 白名单未命中：本 UI 指定了租户，但后端返回的租户中没有匹配项。
    // 这是部署/配置问题，必须显式告警，并清掉可能已预置或缓存的租户上下文，
    // 否则会用错误的 tenantId/tenantCode 静默发起验证码、RADIUS 与登录请求。
    tenantWhitelistMissed.value = configuredTenantIds.length > 0 && filtered.length === 0;
    if (tenantWhitelistMissed.value) {
      loginForm.value.tenantId = '';
      loginForm.value.tenantCode = '';
      localStorage.removeItem('tenantId');
      localStorage.removeItem('tenantCode');
      tenantList.value = [];
      tenantEnabled.value = false;
      ElMessage.error(`租户白名单未命中：本系统限定租户 [${configuredTenantIds.join(', ')}]，但后端未返回匹配租户`);
      return;
    }

    tenantEnabled.value = filtered.length > 0;
    if (tenantEnabled.value) {
      tenantList.value = filtered.map((item: any) => ({
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
    loadLoginHints();
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
  getSecretKey();
  getLoginData();
  initTenantList().then(() => loadLoginHints());
});

onBeforeUnmount(() => {
  void stopCertUsbMonitoring();
  skfClient?.disconnect();
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
    var(--login-background-image, url('../assets/images/login-background.jpg')) center / cover no-repeat;
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

.login--tenant-background {
  background: var(--login-background-image) center / cover no-repeat;
}

.login--tenant-background::before {
  background: linear-gradient(90deg, rgba(3, 20, 36, 0.16) 0%, rgba(3, 20, 36, 0.04) 58%, rgba(232, 249, 255, 0.18) 100%);
}

.login--tenant-background::after {
  opacity: 0.18;
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
  background: rgba(241, 247, 249, 0.54);
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
  background: rgba(255, 255, 255, 0.76);
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
  border: 1px solid var(--login-panel-border, rgba(255, 255, 255, 0.46));
  border-radius: 8px;
  background: var(--login-panel-background, rgba(229, 238, 242, 0.9));
  box-shadow:
    0 22px 58px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(22px) saturate(110%);

  &::before {
    position: absolute;
    top: 0;
    left: 22px;
    right: 22px;
    height: 2px;
    content: '';
    background: linear-gradient(90deg, transparent, #22d3ee, #14b8a6, transparent);
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.32);
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
    display: none;
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
    background: var(--login-panel-input-background, rgba(248, 251, 252, 0.72));
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

/* Light enterprise login layout inspired by the attached reference. */
.login {
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
  background: #ffffff;
  color: #1f2937;
}

.login::before,
.login::after {
  display: none;
}

.login--tenant-background {
  background:
    linear-gradient(90deg, rgba(241, 247, 255, 0.92) 0%, rgba(241, 247, 255, 0.92) 58%, rgba(255, 255, 255, 0.98) 58%),
    var(--login-background-image) center / cover no-repeat;
}

.login-shell {
  display: grid;
  grid-template-columns: minmax(420px, 58%) minmax(360px, 42%);
  width: 100%;
  min-height: 100dvh;
  align-items: stretch;
}

.brand-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 32px 48px 86px;
  overflow: hidden;
  background:
    radial-gradient(circle at 72% 24%, rgba(98, 168, 255, 0.2), transparent 31%), linear-gradient(135deg, #f7fbff 0%, #e9f3ff 46%, #dfeaf6 100%);
}

.brand-panel::before {
  position: absolute;
  inset: 0;
  content: '';
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.58), transparent 46%), radial-gradient(circle at 34% 54%, rgba(0, 122, 255, 0.1), transparent 34%);
}

.brand-header {
  position: absolute;
  top: 24px;
  left: 28px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #2f3a4a;
  font-size: 16px;
  font-weight: 600;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: #0b8cff;
  border: 2px solid #26a8ff;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.brand-name {
  line-height: 1.3;
}

.brand-visual {
  position: relative;
  z-index: 1;
  width: min(380px, 72vw);
  height: 300px;
  margin-top: 14px;
  filter: drop-shadow(0 26px 32px rgba(37, 99, 235, 0.18));
}

.visual-base,
.visual-platform,
.visual-shield,
.visual-cert,
.visual-key,
.visual-bar,
.visual-node,
.visual-app {
  position: absolute;
  display: block;
}

.visual-app {
  display: none;
  z-index: 3;
}

.visual-base {
  left: 68px;
  bottom: 28px;
  width: 244px;
  height: 126px;
  border-radius: 18px;
  background: linear-gradient(145deg, #0a7cff, #1751d8);
  transform: skewY(-24deg) rotate(24deg);
  box-shadow:
    0 16px 0 #0852c8,
    0 28px 36px rgba(31, 96, 220, 0.22);
}

.visual-platform {
  left: 132px;
  bottom: 92px;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.95) 0 18%, rgba(120, 204, 255, 0.38) 19% 42%, transparent 43%),
    linear-gradient(145deg, #2bc7ff, #2468ef);
  box-shadow:
    inset 0 0 0 12px rgba(255, 255, 255, 0.16),
    0 16px 0 #1543c3;
}

.visual-shield {
  left: 166px;
  bottom: 158px;
  width: 52px;
  height: 70px;
  border-radius: 26px 26px 18px 18px;
  background: linear-gradient(160deg, #83e3ff, #1167ec);
  clip-path: polygon(50% 0, 94% 18%, 84% 78%, 50% 100%, 16% 78%, 6% 18%);
  box-shadow: 0 12px 24px rgba(17, 103, 236, 0.26);
}

.visual-cert {
  width: 82px;
  height: 100px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(18, 113, 240, 0.16) 16px, transparent 17px), linear-gradient(180deg, #ffffff, #dff4ff);
  box-shadow: 0 12px 20px rgba(30, 93, 200, 0.16);
}

.visual-cert::before,
.visual-cert::after {
  position: absolute;
  left: 14px;
  height: 6px;
  content: '';
  border-radius: 999px;
  background: rgba(23, 100, 221, 0.38);
}

.visual-cert::before {
  top: 42px;
  width: 50px;
}

.visual-cert::after {
  top: 62px;
  width: 36px;
}

.visual-cert-a {
  left: 90px;
  top: 46px;
  transform: rotate(-15deg);
}

.visual-cert-b {
  right: 64px;
  top: 36px;
  transform: rotate(13deg);
}

.visual-key {
  right: 54px;
  bottom: 74px;
  width: 96px;
  height: 34px;
  border-radius: 999px;
  background: linear-gradient(90deg, #7fe6ff, #1d7bff);
  transform: rotate(23deg);
}

.visual-key::before {
  position: absolute;
  left: -24px;
  top: -12px;
  width: 48px;
  height: 48px;
  content: '';
  border: 12px solid #2f88ff;
  border-radius: 50%;
  background: transparent;
}

.visual-key::after {
  position: absolute;
  right: 12px;
  top: 24px;
  width: 38px;
  height: 10px;
  content: '';
  background: #1862e6;
  box-shadow: 28px 0 0 #1862e6;
}

.visual-bar {
  bottom: 92px;
  width: 20px;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #78e7ff, #1357df);
}

.visual-bar-a {
  left: 96px;
  height: 48px;
}

.visual-bar-b {
  left: 126px;
  height: 72px;
}

.visual-bar-c {
  left: 156px;
  height: 38px;
}

.visual-node {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(145deg, #7868ff, #1d77ff);
  box-shadow: 0 10px 18px rgba(53, 93, 218, 0.22);
}

.visual-app-ops {
  left: 122px;
  top: 82px;
  width: 136px;
  height: 104px;
  border: 8px solid rgba(255, 255, 255, 0.88);
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.72) 1px, transparent 1px), linear-gradient(rgba(255, 255, 255, 0.72) 1px, transparent 1px),
    linear-gradient(145deg, #1a8dff, #1459db);
  background-size:
    22px 22px,
    22px 22px,
    auto;
  box-shadow:
    0 15px 0 #1148bc,
    0 24px 28px rgba(17, 72, 188, 0.18);
}

.visual-app-ops::before {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  height: 36px;
  content: '';
  border-bottom: 5px solid rgba(255, 255, 255, 0.78);
  border-left: 5px solid rgba(255, 255, 255, 0.78);
  background:
    linear-gradient(135deg, transparent 0 28%, #9cf0ff 29% 34%, transparent 35% 56%, #ffffff 57% 62%, transparent 63%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.18), transparent);
}

.visual-app-ops::after {
  position: absolute;
  left: 22px;
  top: 16px;
  width: 18px;
  height: 18px;
  content: '';
  border-radius: 50%;
  background: #9cf0ff;
  box-shadow:
    38px 0 0 #ffffff,
    76px 0 0 rgba(255, 255, 255, 0.62);
}

.visual-app-ca {
  left: 134px;
  top: 58px;
  width: 112px;
  height: 146px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(13, 148, 136, 0.14) 22px, transparent 23px), linear-gradient(180deg, #ffffff, #ddfbff);
  box-shadow:
    0 15px 0 #0b72c8,
    0 26px 28px rgba(11, 114, 200, 0.16);
}

.visual-app-ca::before {
  position: absolute;
  left: 22px;
  top: 50px;
  width: 68px;
  height: 9px;
  content: '';
  border-radius: 999px;
  background: rgba(9, 117, 138, 0.42);
  box-shadow:
    0 24px 0 rgba(9, 117, 138, 0.28),
    0 48px 0 rgba(9, 117, 138, 0.2);
}

.visual-app-ca::after {
  position: absolute;
  right: -18px;
  bottom: 18px;
  width: 58px;
  height: 58px;
  content: '';
  border-radius: 50%;
  background: radial-gradient(circle, #ffffff 0 24%, transparent 25%), repeating-conic-gradient(from 10deg, #14b8a6 0 14deg, #6ee7f9 14deg 28deg);
  box-shadow:
    0 0 0 8px rgba(20, 184, 166, 0.14),
    0 14px 24px rgba(20, 184, 166, 0.24);
}

.visual-app-kmc {
  left: 114px;
  top: 72px;
  width: 154px;
  height: 118px;
  border-radius: 18px;
  background: linear-gradient(145deg, #8d7aff, #355fe8);
  box-shadow:
    inset 0 0 0 10px rgba(255, 255, 255, 0.16),
    0 16px 0 #283bb7,
    0 28px 30px rgba(40, 59, 183, 0.18);
}

.visual-app-kmc::before {
  position: absolute;
  left: 42px;
  top: -44px;
  width: 70px;
  height: 62px;
  content: '';
  border: 14px solid #6f63f4;
  border-bottom: 0;
  border-radius: 42px 42px 0 0;
  box-shadow: inset 0 0 0 8px rgba(255, 255, 255, 0.16);
}

.visual-app-kmc::after {
  position: absolute;
  left: 58px;
  top: 34px;
  width: 40px;
  height: 40px;
  content: '';
  border-radius: 50%;
  background:
    linear-gradient(180deg, transparent 42%, rgba(255, 255, 255, 0.86) 43% 56%, transparent 57%),
    radial-gradient(circle, #ffffff 0 28%, #c9c2ff 29% 48%, transparent 49%);
  box-shadow:
    0 0 0 11px rgba(255, 255, 255, 0.18),
    0 0 22px rgba(255, 255, 255, 0.22);
}

.visual-app-ra {
  left: 108px;
  top: 58px;
  width: 168px;
  height: 132px;
}

.visual-app-ra::before {
  position: absolute;
  left: 4px;
  top: 15px;
  width: 64px;
  height: 78px;
  content: '';
  border-radius: 10px;
  background: radial-gradient(circle at 50% 30%, #f8b84e 0 18%, transparent 19%), linear-gradient(180deg, #ffffff, #fff4dc);
  box-shadow:
    92px 0 0 #ffffff,
    92px 0 0 1px rgba(245, 158, 11, 0.2),
    0 13px 0 #d07812,
    92px 13px 0 #d07812,
    0 24px 28px rgba(191, 106, 16, 0.16);
}

.visual-app-ra::after {
  position: absolute;
  left: 70px;
  top: 45px;
  width: 50px;
  height: 18px;
  content: '';
  border-top: 6px solid #f6a723;
  border-right: 6px solid #f6a723;
  transform: skewX(-20deg);
  box-shadow:
    17px -10px 0 -6px #f6a723,
    17px 10px 0 -6px #f6a723;
}

.visual-app-ocsp {
  left: 116px;
  top: 62px;
  width: 150px;
  height: 128px;
  border-radius: 22px;
  background: linear-gradient(145deg, #3ee47c, #127de0);
  box-shadow:
    inset 0 0 0 10px rgba(255, 255, 255, 0.16),
    0 16px 0 #108241,
    0 28px 30px rgba(16, 130, 65, 0.18);
}

.visual-app-ocsp::before {
  position: absolute;
  left: 36px;
  top: 48px;
  width: 72px;
  height: 34px;
  content: '';
  border-left: 8px solid rgba(255, 255, 255, 0.9);
  border-bottom: 8px solid rgba(255, 255, 255, 0.9);
  transform: rotate(-45deg);
}

.visual-app-ocsp::after {
  position: absolute;
  left: -24px;
  right: -24px;
  top: 30px;
  height: 20px;
  content: '';
  background:
    linear-gradient(
      90deg,
      transparent 0 8%,
      rgba(255, 255, 255, 0.82) 9% 18%,
      transparent 19% 34%,
      rgba(255, 255, 255, 0.82) 35% 50%,
      transparent 51% 66%,
      rgba(255, 255, 255, 0.82) 67% 76%,
      transparent 77%
    ),
    linear-gradient(180deg, transparent 45%, rgba(255, 255, 255, 0.34) 46% 56%, transparent 57%);
}

.visual-node-a {
  left: 64px;
  top: 90px;
}

.visual-node-b {
  right: 124px;
  bottom: 46px;
}

.brand-copy {
  position: relative;
  z-index: 1;
  margin-top: 12px;
  text-align: center;
}

.brand-copy h1 {
  margin: 0;
  color: #344054;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.35;
}

.brand-copy p {
  margin: 10px 0 0;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}

.auth-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100dvh;
  padding: 72px 56px 84px;
  background: #ffffff;
}

.login-form {
  width: min(388px, 100%);
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.login-form::before,
.login-form::after {
  display: none;
}

.title-box {
  align-items: flex-start;
  margin-bottom: 18px;
}

.title-box .title {
  margin: 0 0 8px;
  color: #202631;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.25;
}

.form-subtitle {
  margin: 0;
  color: #8a94a6;
  font-size: 13px;
  line-height: 1.6;
}

.auth-mode-switch {
  gap: 10px;
  padding: 0;
  margin-bottom: 18px;
  border: 0;
  background: transparent;
}

.auth-mode-button {
  min-height: 38px;
  color: #5d6b82;
  border: 1px solid #e5eaf2;
  border-radius: 6px;
  background: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
}

.auth-mode-button:hover,
.auth-mode-button:focus-visible,
.auth-mode-button.active {
  color: #0b7ff3;
  border-color: #b9dcff;
  background: #f5faff;
  box-shadow: 0 0 0 3px rgba(11, 127, 243, 0.08);
}

.login-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.login-form :deep(.el-input__wrapper),
.login-form :deep(.el-select__wrapper) {
  min-height: 42px;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 0 0 1px #e5e9f0 inset;
}

.login-form :deep(.el-input__wrapper:hover),
.login-form :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #c9d7e8 inset;
}

.login-form :deep(.el-input__wrapper.is-focus),
.login-form :deep(.el-select__wrapper.is-focused) {
  box-shadow:
    0 0 0 1px #1684fc inset,
    0 0 0 3px rgba(22, 132, 252, 0.1);
}

.login-form .el-input,
.login-form .el-input input {
  height: 42px;
}

.login-form .input-icon {
  height: 40px;
  color: #9aa5b5;
}

.form-options {
  margin: -2px 0 18px;
}

.secure-note {
  color: #0b7ff3;
  font-weight: 500;
}

.login-code {
  flex-basis: 124px;
  height: 42px;
  border-color: #e5e9f0;
  border-radius: 6px;
  background: #ffffff;
}

.login-code:hover,
.login-code:focus-visible {
  border-color: #1684fc;
  box-shadow: 0 0 0 3px rgba(22, 132, 252, 0.1);
}

.cert-reader {
  min-height: 82px;
  border-color: #dcecff;
  border-radius: 6px;
  background: #f6fbff;
}

.cert-reader-icon {
  color: #0b7ff3;
  border-color: #cfe6ff;
  border-radius: 6px;
  box-shadow: none;
}

.cert-reader-title {
  color: #202631;
}

.cert-reader-desc,
.cert-placeholder-line {
  color: #667085;
}

.cert-select-button {
  min-height: 42px;
  color: #0b7ff3;
  border-color: #b9dcff;
  border-radius: 6px;
  background: #f8fbff;
}

.cert-placeholder {
  border-color: #e5e9f0;
  border-radius: 6px;
  background: #fbfcfe;
}

.cert-flow span {
  color: #0b7ff3;
  border-color: #dcecff;
  border-radius: 6px;
  background: #f6fbff;
}

.login-button {
  min-height: 42px;
  border-radius: 6px;
  background: #0878e8;
  box-shadow: 0 10px 20px rgba(8, 120, 232, 0.18);
  font-weight: 600;
}

.login-button:hover,
.login-button:focus {
  filter: none;
  background: #0b84ff;
  box-shadow: 0 12px 24px rgba(8, 120, 232, 0.24);
}

.register-link {
  margin-top: 12px;
}

.el-login-footer {
  color: #98a2b3;
}

.brand-panel--ops {
  background:
    radial-gradient(circle at 72% 24%, rgba(59, 130, 246, 0.2), transparent 31%), linear-gradient(135deg, #f7fbff 0%, #e9f3ff 46%, #dfeaf6 100%);

  .brand-logo {
    color: #0b72e7;
    border-color: #2d9cff;
  }

  .visual-base {
    background: linear-gradient(145deg, #0a7cff, #174fd2);
  }

  .visual-platform::before {
    position: absolute;
    inset: 31px;
    content: '';
    border: 7px solid rgba(255, 255, 255, 0.78);
    border-left-color: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
  }

  .visual-app-ops {
    display: block;
  }

  .visual-platform,
  .visual-shield,
  .visual-cert-a,
  .visual-key {
    display: none;
  }

  .visual-cert-b {
    right: 48px;
    top: 52px;
    opacity: 0.72;
  }
}

.brand-panel--ca {
  background:
    radial-gradient(circle at 72% 24%, rgba(20, 184, 166, 0.18), transparent 31%), linear-gradient(135deg, #f7fffd 0%, #e7f7ff 48%, #d9e9f8 100%);

  .brand-logo {
    color: #077e95;
    border-color: #1eb7cf;
  }

  .visual-base {
    background: linear-gradient(145deg, #00a9d6, #1167ec);
  }

  .visual-shield {
    background: linear-gradient(160deg, #7df4e2, #0877d9);
  }

  .visual-cert-b {
    width: 92px;
    height: 112px;
    transform: rotate(9deg);
  }

  .visual-app-ca {
    display: block;
  }

  .visual-platform,
  .visual-shield,
  .visual-cert-a,
  .visual-cert-b {
    display: none;
  }

  .visual-key {
    right: 44px;
    bottom: 70px;
    opacity: 0.64;
  }
}

.brand-panel--kmc {
  background:
    radial-gradient(circle at 72% 24%, rgba(124, 92, 255, 0.18), transparent 31%), linear-gradient(135deg, #fbf9ff 0%, #edf0ff 48%, #e0e8fb 100%);

  .brand-logo {
    width: 40px;
    flex: 0 0 40px;
    color: #5b4ddf;
    border-color: #8377ff;
    font-size: 10px;
  }

  .visual-base {
    background: linear-gradient(145deg, #7c5cff, #2558d8);
  }

  .visual-platform {
    background:
      radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.95) 0 16%, rgba(190, 181, 255, 0.42) 17% 40%, transparent 41%),
      linear-gradient(145deg, #9d8cff, #365eea);
  }

  .visual-key {
    right: 36px;
    bottom: 124px;
    width: 124px;
    background: linear-gradient(90deg, #c1b7ff, #4d62ff);
    transform: rotate(-18deg);
  }

  .visual-app-kmc {
    display: block;
  }

  .visual-platform,
  .visual-shield,
  .visual-cert-a,
  .visual-cert-b {
    display: none;
  }

  .visual-key {
    right: 36px;
    bottom: 64px;
    opacity: 0.72;
  }
}

.brand-panel--ra {
  background:
    radial-gradient(circle at 72% 24%, rgba(245, 158, 11, 0.18), transparent 31%), linear-gradient(135deg, #fffdf7 0%, #fff2df 48%, #eaf0fb 100%);

  .brand-logo {
    color: #c26a03;
    border-color: #f7a928;
  }

  .visual-base {
    background: linear-gradient(145deg, #f6a723, #2869df);
    box-shadow:
      0 16px 0 #bd6a10,
      0 28px 36px rgba(191, 106, 16, 0.18);
  }

  .visual-platform {
    background:
      radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.95) 0 18%, rgba(255, 219, 150, 0.5) 19% 42%, transparent 43%),
      linear-gradient(145deg, #ffc15c, #276fe8);
  }

  .visual-cert-a,
  .visual-cert-b {
    border-bottom: 8px solid rgba(245, 158, 11, 0.32);
  }

  .visual-app-ra {
    display: block;
  }

  .visual-platform,
  .visual-shield,
  .visual-cert-a,
  .visual-cert-b,
  .visual-key {
    display: none;
  }

  .visual-bar {
    background: linear-gradient(180deg, #ffd071, #e38a13);
  }
}

.brand-panel--ocsp {
  background:
    radial-gradient(circle at 72% 24%, rgba(34, 197, 94, 0.18), transparent 31%), linear-gradient(135deg, #f8fffb 0%, #e6f8ef 48%, #dcebf8 100%);

  .brand-logo {
    width: 42px;
    flex: 0 0 42px;
    color: #138a45;
    border-color: #38c878;
    font-size: 10px;
  }

  .visual-base {
    background: linear-gradient(145deg, #22c55e, #0b78d8);
    box-shadow:
      0 16px 0 #108241,
      0 28px 36px rgba(16, 130, 65, 0.16);
  }

  .visual-platform {
    background:
      radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.95) 0 14%, rgba(187, 247, 208, 0.55) 15% 42%, transparent 43%),
      linear-gradient(145deg, #3ee47c, #1379df);
  }

  .visual-platform::after {
    position: absolute;
    left: 35px;
    top: 58px;
    width: 52px;
    height: 24px;
    content: '';
    border-left: 5px solid rgba(255, 255, 255, 0.78);
    border-bottom: 5px solid rgba(255, 255, 255, 0.78);
    transform: rotate(-45deg);
  }

  .visual-bar {
    background: linear-gradient(180deg, #94f7b8, #10a557);
  }

  .visual-app-ocsp {
    display: block;
  }

  .visual-platform,
  .visual-shield,
  .visual-cert-a,
  .visual-cert-b,
  .visual-key {
    display: none;
  }
}

.brand-panel--nas {
  background:
    radial-gradient(circle at 72% 24%, rgba(99, 102, 241, 0.16), transparent 31%), linear-gradient(135deg, #f8fbff 0%, #edf2ff 48%, #e1e8f3 100%);

  .brand-logo {
    color: #4051c8;
    border-color: #7282ff;
  }
}

.brand-panel--license {
  background:
    radial-gradient(circle at 72% 24%, rgba(14, 165, 233, 0.18), transparent 31%), linear-gradient(135deg, #f7fcff 0%, #eaf7ff 48%, #e6eef7 100%);

  .brand-logo {
    color: #0876a8;
    border-color: #27b4e8;
    font-size: 10px;
  }
}

@media (max-width: 980px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    min-height: 360px;
    padding: 72px 24px 32px;
  }

  .brand-visual {
    width: min(320px, 84vw);
    height: 230px;
    transform: scale(0.82);
    transform-origin: center;
  }

  .auth-panel {
    min-height: auto;
    padding: 36px 24px 76px;
  }
}

@media (max-width: 560px) {
  .brand-panel {
    min-height: 300px;
  }

  .brand-header {
    left: 18px;
    top: 18px;
  }

  .brand-visual {
    height: 196px;
    margin-top: 0;
    transform: scale(0.7);
  }

  .brand-copy h1 {
    font-size: 20px;
  }

  .brand-copy p {
    font-size: 13px;
  }

  .title-box .title {
    font-size: 26px;
  }

  .auth-panel {
    padding-inline: 20px;
  }
}
</style>
