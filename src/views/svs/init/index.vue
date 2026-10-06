<template>
  <div class="svs-init-page">
    <h1>签名验签服务器初始化</h1>
    <p class="tenant-code">租户 {{ tenantCode }}</p>
    <el-steps :active="visualIndex" finish-status="success" align-center>
      <el-step v-for="title in titles" :key="title" :title="title" />
    </el-steps>

    <el-card class="step-card" shadow="never">
      <el-alert
        v-if="reinit"
        type="warning"
        :closable="false"
        show-icon
        title="审计日志保留。历史密钥、证书和应用实体不会自动恢复。"
      />
      <p class="step-copy">{{ stepCopy }}</p>

      <el-form v-if="needsAccount" label-width="96px" @submit.prevent>
        <el-form-item label="用户名">
          <el-input v-model="username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="口令">
          <el-input v-model="password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
      </el-form>

      <div class="step-actions">
        <el-button type="primary" :loading="submitting" @click="submitCurrent">{{ actionLabel }}</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  SVS_LOCKED_MESSAGE,
  SVS_PRESET_INIT_ACCOUNT,
  SVS_TENANT_CODE,
  openSvsInitSession,
  rememberMustChangePassword,
  responseText,
  submitSvsInitStep
} from '@/api/svs/init';

const FIRST_TITLES = [
  '身份认证',
  '设备基础信息',
  '网络配置',
  '时间同步',
  '安全策略基线',
  '创建系统管理员',
  '创建安全管理员',
  '创建审计员',
  '三权分别登录验证',
  '初始化日志',
  '锁定入口'
];

const REINIT_TITLES = [
  '身份认证',
  '授权审批',
  '风险确认',
  '审计日志保留',
  '设备信息',
  '网络',
  '时间',
  '安全基线',
  '重建三个账号',
  '三权登录验证',
  '重新初始化日志',
  '锁定入口'
];

const FIRST_STATES = [
  'AUTH',
  'DEVICE',
  'NETWORK',
  'TIME',
  'BASELINE',
  'CREATE_SYSADMIN',
  'CREATE_SECADMIN',
  'CREATE_AUDITOR',
  'VERIFY_SYSADMIN',
  'INIT_LOG',
  'LOCKED'
];

const REINIT_STATES = [
  'AUTH',
  'APPROVAL',
  'RISK',
  'AUDIT_RETAIN',
  'DEVICE',
  'NETWORK',
  'TIME',
  'BASELINE',
  'CREATE_SYSADMIN',
  'VERIFY_SYSADMIN',
  'REINIT_LOG',
  'LOCKED'
];

const route = useRoute();
const router = useRouter();
const tenantCode = SVS_TENANT_CODE;
const nextState = ref('AUTH');
const submitting = ref(false);
const username = ref('');
const password = ref('');
const reinit = ref(route.query.mode === 'FACTORY_RESET');

const titles = computed(() => (reinit.value ? REINIT_TITLES : FIRST_TITLES));
const states = computed(() => (reinit.value ? REINIT_STATES : FIRST_STATES));

const visualIndex = computed(() => {
  const state = nextState.value;
  if (state.startsWith('VERIFY_')) {
    return states.value.indexOf('VERIFY_SYSADMIN');
  }
  if (state.startsWith('CREATE_') && reinit.value) {
    return states.value.indexOf('CREATE_SYSADMIN');
  }
  const index = states.value.indexOf(state);
  return index < 0 ? 0 : index;
});

const needsAccount = computed(() => nextState.value.startsWith('CREATE_') || nextState.value.startsWith('VERIFY_'));

const stepCopy = computed(() => {
  if (nextState.value === 'AUDIT_RETAIN') {
    return '审计日志保留，已有审计记录不会被删除。';
  }
  if (nextState.value.startsWith('VERIFY_')) {
    return '请分别验证系统管理员、安全管理员和审计员。任一角色验证失败不能锁定入口。';
  }
  if (nextState.value.startsWith('CREATE_')) {
    return '三个账号的用户名和口令必须互不相同。首次登录必须修改口令。';
  }
  return titles.value[visualIndex.value] || '';
});

const actionLabel = computed(() => (nextState.value === 'LOCKED' ? '锁定入口' : '继续'));

function leaveLocked() {
  ElMessage.warning(SVS_LOCKED_MESSAGE);
  router.replace('/login');
}

async function loadSession() {
  try {
    const mode = route.query.mode === 'FACTORY_RESET' ? 'FACTORY_RESET' : undefined;
    const result = await openSvsInitSession(SVS_PRESET_INIT_ACCOUNT, mode);
    nextState.value = result.next;
    reinit.value = reinit.value || ['APPROVAL', 'RISK', 'AUDIT_RETAIN', 'REINIT_LOG'].includes(result.next);
  } catch (error) {
    if (responseText(error).includes(SVS_LOCKED_MESSAGE)) {
      leaveLocked();
    } else {
      ElMessage.error('无法打开初始化会话');
    }
  }
}

async function submitCurrent() {
  if (needsAccount.value && (!username.value.trim() || !password.value)) {
    ElMessage.warning('请填写用户名和口令');
    return;
  }
  submitting.value = true;
  const submitted = nextState.value;
  try {
    const result = await submitSvsInitStep(
      SVS_PRESET_INIT_ACCOUNT,
      submitted,
      needsAccount.value ? username.value.trim() : undefined,
      needsAccount.value ? password.value : undefined
    );
    if (submitted.startsWith('CREATE_')) {
      rememberMustChangePassword(username.value.trim());
    }
    username.value = '';
    password.value = '';
    if (result.next === 'LOCKED' && submitted === 'LOCKED') {
      leaveLocked();
      return;
    }
    nextState.value = result.next;
    if (result.next === 'REINIT_LOG' || result.next === 'APPROVAL') {
      reinit.value = true;
    }
  } catch (error) {
    const text = responseText(error);
    if (text.includes(SVS_LOCKED_MESSAGE)) {
      leaveLocked();
      return;
    }
    ElMessage.error(submitted.startsWith('VERIFY_') ? '角色验证失败，初始化尚未锁定' : '当前步骤未完成');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadSession);
</script>

<style scoped>
.svs-init-page {
  padding: 20px;
}

.svs-init-page h1 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
}

.tenant-code {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
}

.step-card {
  margin-top: 16px;
}

.step-copy {
  margin: 12px 0;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
