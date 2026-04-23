<template>
  <div class="login">
    <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
      <div class="title-box">
        <h3 class="title">{{ loginTitle }}</h3>
        <lang-select />
      </div>
      <el-form-item v-if="tenantEnabled" prop="tenantId">
        <el-select v-model="loginForm.tenantId" filterable :placeholder="proxy.$t('login.selectPlaceholder')" style="width: 100%" @change="handleTenantChange">
          <el-option v-for="item in tenantList" :key="item.tenantId" :label="item.companyName" :value="item.tenantId"></el-option>
          <template #prefix><svg-icon icon-class="company" class="el-input__icon input-icon" /></template>
        </el-select>
      </el-form-item>
      <el-form-item prop="username">
        <el-input v-model="loginForm.username" type="text" size="large" auto-complete="off" :placeholder="proxy.$t('login.username')">
          <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          v-model="loginForm.password"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('login.password')"
          @keyup.enter="handleLogin"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item v-if="captchaEnabled" prop="code">
        <el-input
          v-model="loginForm.code"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('login.code')"
          style="width: 63%"
          @keyup.enter="handleLogin"
        >
          <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
        </el-input>
        <div class="login-code">
          <img :src="codeUrl" class="login-code-img" @click="getCode" />
        </div>
      </el-form-item>
      <el-checkbox v-model="loginForm.rememberMe" style="margin: 0 0 25px 0">{{ proxy.$t('login.rememberPassword') }}</el-checkbox>
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
      <el-form-item style="width: 100%">
        <el-button :loading="loading" size="large" type="primary" style="width: 100%" @click.prevent="handleLogin">
          <span v-if="!loading">{{ proxy.$t('login.login') }}</span>
          <span v-else>{{ proxy.$t('login.logging') }}</span>
        </el-button>
        <div v-if="register" style="float: right">
          <router-link class="link-type" :to="'/register'">{{ proxy.$t('login.switchRegisterPage') }}</router-link>
        </div>
      </el-form-item>
    </el-form>
    <!--  底部  -->
    <div class="el-login-footer">
      <span>Copyright © 2018-2025 立志报国 All Rights Reserved.</span>
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
import { LoginData, TenantVO } from '@/api/types';
import { to } from 'await-to-js';
import { HttpStatus } from '@/enums/RespEnum';
import { useI18n } from 'vue-i18n';
import { v4 as uuidv4 } from 'uuid';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const userStore = useUserStore();
const router = useRouter();
const { t } = useI18n();

const loginForm = ref<LoginData>({
  tenantId: '',
  tenantCode: '',
  username: 'admin',
  password: '',
  rememberMe: false,
  code: '',
  uuid: ''
} as LoginData);

const loginData = ref<LoginData>({
  tenantId: '',
  tenantCode: '',
  username: '',
  password: '',
  rememberMe: false,
  code: '',
  uuid: ''
} as LoginData);
loginForm.value.tenantId = import.meta.env.VITE_TENANT_ID;
loginForm.value.tenantCode = import.meta.env.VITE_TENANT_CODE;

const loginRules: ElFormRules = {
  tenantId: [{ required: true, trigger: 'blur', message: t('login.rule.tenantId.required') }],
  username: [{ required: true, trigger: 'blur', message: t('login.rule.username.required') }],
  password: [{ required: true, trigger: 'blur', message: t('login.rule.password.required') }],
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
        localStorage.setItem('username', String(loginForm.value.username));
        localStorage.setItem('password', String(loginForm.value.password));
        localStorage.setItem('rememberMe', String(loginForm.value.rememberMe));
      } else {
        // 否则移除
        localStorage.removeItem('tenantId');
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
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  const rememberMe = localStorage.getItem('rememberMe');
  loginForm.value = {
    tenantId: tenantId === null ? String(loginForm.value.tenantId) : tenantId,
    username: username === null ? String(loginForm.value.username) : username,
    password: password === null ? String(loginForm.value.password) : String(password),
    rememberMe: rememberMe === null ? false : Boolean(rememberMe)
  } as LoginData;
};

/**
 * 获取租户列表
 */
const initTenantList = async () => {
  try {
    const { data } = await getTenantList(false);
    // data is TenantCO[] from backend (id, name, code fields)
    const list: any[] = Array.isArray(data) ? data : [];
    tenantEnabled.value = list.length > 0;
    if (tenantEnabled.value) {
      tenantList.value = list.map((item: any) => ({
        tenantId: String(item.id),
        companyName: item.name,
        tenantCode: item.code,
        domain: null
      }));
      // 如果没有从本地存储中获取到租户ID，则默认选中第一个
      if (!loginForm.value.tenantId) {
        loginForm.value.tenantId = tenantList.value[0].tenantId;
        loginForm.value.tenantCode = tenantList.value[0].tenantCode;
      } else {
        // 如果有租户ID，同步一下 tenantCode
        const tenant = tenantList.value.find((item) => item.tenantId === loginForm.value.tenantId);
        if (tenant) {
          loginForm.value.tenantCode = tenant.tenantCode;
        }
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
    getTenantInfo(val);
  }
};

/**
 * 获取租户
 */
const getTenantInfo = async (tenantId: string) => {
  const res = await getTenant(tenantId);
  if (res.data && res.data.name) {
    loginTitle.value = res.data.name;
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
  initTenantList();
  getLoginData();
  if (loginForm.value.tenantId) {
    getTenantInfo(loginForm.value.tenantId);
  }
});
</script>

<style lang="scss" scoped>
.login {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-image: url('../assets/images/login-background.jpg');
  background-size: cover;
}

.title-box {
  display: flex;

  .title {
    margin: 0px auto 30px auto;
    text-align: center;
    color: #707070;
  }

  :deep(.lang-select--style) {
    line-height: 0;
    color: #7483a3;
  }
}

.login-form {
  border-radius: 6px;
  background: #ffffff;
  width: 400px;
  padding: 25px 25px 5px 25px;
  z-index: 1;
  .el-input {
    height: 40px;
    input {
      height: 40px;
    }
  }

  .input-icon {
    height: 39px;
    width: 14px;
    margin-left: 0px;
  }
}

.login-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
}

.login-code {
  width: 33%;
  height: 40px;
  float: right;

  img {
    cursor: pointer;
    vertical-align: middle;
  }
}

.el-login-footer {
  height: 40px;
  line-height: 40px;
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
  color: #fff;
  font-family: Arial, serif;
  font-size: 12px;
  letter-spacing: 1px;
}

.login-code-img {
  height: 40px;
  padding-left: 12px;
}
</style>
