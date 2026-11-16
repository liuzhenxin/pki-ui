<template>
  <main class="ucsp-setup">
    <section v-loading="busy" class="ucsp-setup__panel">
      <header>
        <p>统一密码服务平台</p>
        <h1>系统初始化</h1>
      </header>
      <el-steps :active="step" finish-status="success" align-center>
        <el-step title="使用协议" />
        <el-step title="环境检查" />
        <el-step title="初始化两员" />
        <el-step title="完成" />
      </el-steps>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="ucsp-setup__alert" />
      <div v-if="!state" class="ucsp-setup__actions">
        <el-button type="primary" :disabled="busy" @click="load">重新读取状态</el-button>
      </div>
      <template v-else-if="step === 0 || reviewingAgreement">
        <div class="ucsp-setup__agreement">
          <Agreement tenant-code="ucsp" tenant-name="统一密码服务平台" />
        </div>
        <el-checkbox v-model="accepted">我已阅读并同意协议（{{ state.agreementVersion }}）</el-checkbox>
        <div class="ucsp-setup__actions">
          <el-button type="primary" :disabled="!accepted || busy" @click="accept">同意并继续</el-button>
        </div>
      </template>
      <template v-else-if="step === 1">
        <ul class="ucsp-setup__checks">
          <li v-for="check in checks" :key="check.key">
            <span>{{ labels[check.key] || check.key }}</span>
            <el-tag :type="check.ready ? 'success' : 'danger'">{{ check.ready ? '通过' : '未通过' }}</el-tag>
          </li>
        </ul>
        <div class="ucsp-setup__actions">
          <el-button :disabled="busy" @click="reviewingAgreement = true">查看协议</el-button>
          <el-button :disabled="busy" @click="inspect">重新检查</el-button>
          <el-button type="primary" :disabled="busy || !checks.length || checks.some((check) => !check.ready)" @click="confirm">
            确认并继续
          </el-button>
        </div>
      </template>
      <template v-else-if="step === 2">
        <el-form label-position="top" autocomplete="off" @submit.prevent="complete">
          <p>为固定账号 admin 和 auditor 设置不同的密码。每个密码至少 12 个字符，UTF-8 长度不超过 72 字节。</p>
          <el-form-item label="系统管理员 admin">
            <el-input v-model="adminPassword" type="password" show-password autocomplete="new-password" />
          </el-form-item>
          <el-form-item label="审计管理员 auditor">
            <el-input v-model="auditorPassword" type="password" show-password autocomplete="new-password" />
          </el-form-item>
          <div class="ucsp-setup__actions">
            <el-button :disabled="busy" @click="reviewingAgreement = true">查看协议</el-button>
            <el-button type="primary" native-type="submit" :disabled="!canComplete || busy">完成初始化</el-button>
          </div>
        </el-form>
      </template>
      <el-result v-else icon="success" title="初始化完成" sub-title="请使用新设置的 admin 或 auditor 密码重新登录。" />
      <div class="ucsp-setup__actions">
        <el-button link :disabled="busy" @click="leave">{{ step === 3 ? '返回登录' : '退出当前账号' }}</el-button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Agreement from '@/components/Agreement/index.vue';
import {
  acceptUcspAgreement,
  checkUcspEnvironment,
  completeUcspInstallation,
  confirmUcspEnvironment,
  getUcspInitStatus,
  type UcspInitCheck,
  type UcspInitStatus
} from '@/api/ucsp/init';
import { useUserStore } from '@/store/modules/user';

const labels: Record<string, string> = {
  ucspDatabase: 'UCSP 业务数据库',
  platformTenant: '平台产品租户',
  platformDirectory: '平台账号目录',
  accountsAndRoles: '两员账号与角色',
  setupMenus: '安装菜单'
};
const state = ref<UcspInitStatus>();
const busy = ref(false);
const error = ref('');
const checks = ref<UcspInitCheck[]>([]);
const accepted = ref(false);
const reviewingAgreement = ref(false);
const adminPassword = ref('');
const auditorPassword = ref('');
const step = computed(() => (state.value?.initialized ? 3 : (state.value?.progress ?? 0)));
const validPassword = (value: string) =>
  value.trim().length > 0 && value.length >= 12 && new TextEncoder().encode(value).length <= 72 && !/[\u0000-\u001F\u007F-\u009F]/.test(value);
const canComplete = computed(
  () => validPassword(adminPassword.value) && validPassword(auditorPassword.value) && adminPassword.value !== auditorPassword.value
);

const run = async (work: () => Promise<void>) => {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await work();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作未完成，请重试。';
  } finally {
    busy.value = false;
  }
};
const readChecks = async () => {
  checks.value = [];
  checks.value = await checkUcspEnvironment();
};
const load = () =>
  run(async () => {
    state.value = await getUcspInitStatus();
    if (step.value === 1) await readChecks();
  });
const inspect = () => run(readChecks);
const accept = () =>
  run(async () => {
    if (!state.value || !accepted.value) return;
    state.value = await acceptUcspAgreement(state.value.agreementVersion);
    reviewingAgreement.value = false;
    accepted.value = false;
    if (step.value === 1) await readChecks();
  });
const confirm = () =>
  run(async () => {
    state.value = await confirmUcspEnvironment();
  });
const complete = () =>
  run(async () => {
    if (!state.value || !canComplete.value) return;
    try {
      state.value = await completeUcspInstallation(state.value.agreementVersion, adminPassword.value, auditorPassword.value);
    } catch (cause) {
      // The response can be lost after the transaction commits.
      const latest = await getUcspInitStatus().catch(() => undefined);
      if (!latest?.initialized) throw cause;
      state.value = latest;
    } finally {
      adminPassword.value = '';
      auditorPassword.value = '';
    }
  });
const leave = async () => {
  try {
    await useUserStore().logout();
  } finally {
    window.location.replace(new URL('login', document.baseURI).href);
  }
};
onMounted(load);
</script>

<style scoped>
.ucsp-setup {
  min-height: 100vh;
  padding: clamp(1rem, 5vw, 4rem);
  background: #f2f6fb;
}
.ucsp-setup__panel {
  max-width: 800px;
  margin: auto;
  padding: clamp(1rem, 4vw, 2.5rem);
  border-radius: 12px;
  background: #fff;
}
.ucsp-setup__panel header {
  margin-bottom: 2rem;
}
.ucsp-setup__agreement,
.ucsp-setup__checks,
.ucsp-setup__alert {
  margin: 1.5rem 0 1rem;
}
.ucsp-setup__agreement {
  max-height: 38vh;
  overflow: auto;
  padding: 1rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
}
.ucsp-setup__checks {
  padding: 0;
  list-style: none;
}
.ucsp-setup__checks li,
.ucsp-setup__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 0.5rem 0;
}
.ucsp-setup__actions {
  justify-content: flex-end;
}
</style>
