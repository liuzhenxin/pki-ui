<template>
  <div class="kms-init app-container" v-loading="busy">
    <header class="init-header">
      <div>
        <p class="eyebrow">密钥管理系统</p>
        <h1>KMS 安全初始化</h1>
        <p>逐项核验部署与密码边界，进度由服务端保存。</p>
      </div>
      <el-button :disabled="busy" @click="load">刷新进度</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="init-alert" />
    <el-result v-if="locked" icon="success" title="初始化已完成" sub-title="初始化写入口已锁定。设备证书、应用接入和信任策略可在管理台继续配置。"
      ><template #extra><el-button type="primary" @click="router.replace('/index')">进入管理台</el-button></template></el-result
    >
    <template v-else-if="plan">
      <el-alert
        v-if="!plan.status.canInitialize"
        title="当前身份或平台账号状态无法确认，请修复平台连接并使用具有初始化权限的固定系统管理员。"
        type="warning"
        :closable="false"
        show-icon
        class="init-alert"
      />
      <div class="init-grid">
        <aside>
          <el-steps :direction="mobile ? 'horizontal' : 'vertical'" :active="step - 1" finish-status="success"
            ><el-step v-for="(title, index) in titles" :key="title" :title="`${index + 1}. ${title}`"
          /></el-steps>
        </aside>
        <el-card shadow="never" class="step-card">
          <template #header
            ><div class="step-heading">
              <h2>{{ titles[step - 1] }}</h2>
              <el-tag>第 {{ step }} / 9 步</el-tag>
            </div></template
          >
          <template v-if="step === 1"
            ><div class="agreement-scroll"><Agreement tenant-name="密钥管理系统" /></div>
            <el-checkbox v-model="accepted">我已阅读并同意上述协议</el-checkbox></template
          >
          <template v-else-if="step === 2"
            ><p>所有必要项通过后方可继续。依赖恢复后可重新检测。</p>
            <CheckList :checks="plan.checks.filter((item) => item.step === 2)"
          /></template>
          <template v-else-if="step === 3"
            ><el-radio-group v-model="hostType"
              ><el-radio value="STANDALONE" border>独立主机</el-radio
              ><el-radio value="CLUSTER" border disabled>集群（暂不支持）</el-radio></el-radio-group
            ></template
          >
          <template v-else-if="step === 4"
            ><Summary :items="deviceSummary" /><CheckList :checks="currentChecks" /><el-alert
              title="核验部署中已分配的专用 SM4 KEK，并进行真实设备测试。不会扫描、生成或覆盖 KEK。SM4 为对称密钥，无公钥指纹。"
              type="info"
              :closable="false"
          /></template>
          <template v-else-if="step === 5"
            ><Summary :items="networkSummary" /><CheckList :checks="currentChecks" />
            <p>此步骤核验实际部署；需要调整网络时由运维处理后重新检测。</p></template
          >
          <template v-else-if="step === 6"
            ><CheckList :checks="currentChecks" />
            <p>缺失或无法核验的必要条件均会阻止继续。</p></template
          >
          <template v-else-if="step === 7"
            ><Summary :items="{ admin: '系统管理员', secadmin: '安全管理员', auditor: '审计管理员' }" /><CheckList :checks="currentChecks" />
            <p>绑定现有平台账号，不创建账号、不重置口令、不授予额外权限。</p></template
          >
          <template v-else-if="step === 8"
            ><p>执行真实设备的密钥包装、导入、SM4 加解密及完整性自测，重新核验配置、账号和审计写入。验证证据有效期为 5 分钟。</p>
            <CheckList :checks="plan.checks" /><el-alert title="本步骤仅执行验证；下一步由你确认完成。" type="info" :closable="false"
          /></template>
          <template v-else-if="step === 9"
            ><Summary :items="{ ...deviceSummary, ...networkSummary, '主机类型': '独立主机', '管理员': 'admin / secadmin / auditor' }" /><el-alert
              :title="expired ? '验证证据已过期，请刷新进度后重新自测。' : `验证有效期剩余 ${remaining} 秒，提交前服务端将再次核验。`"
              :type="expired ? 'warning' : 'success'"
              :closable="false"
              show-icon
            /><el-checkbox v-model="accepted" class="completion-confirm">确认上述配置和账号绑定，保存初始化结果并锁定入口</el-checkbox></template
          >
          <footer>
            <el-button :disabled="busy" @click="recheck">重新检测</el-button
            ><el-button type="primary" :disabled="!canContinue" @click="advance">{{
              step === 8
                ? '执行初始化验证'
                : step === 9
                  ? '确认完成初始化'
                  : step === 4
                    ? '核验设备并继续'
                    : step === 7
                      ? '核验账号并继续'
                      : '确认并继续'
            }}</el-button>
          </footer>
        </el-card>
      </div>
    </template>
    <el-empty v-else-if="!busy" description="尚未读取到初始化草稿，请检查服务连接及账号权限。" />
  </div>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElAlert, ElDescriptions, ElDescriptionsItem, ElTag } from 'element-plus';
import Agreement from '@/components/Agreement/index.vue';
import {
  completeKmsInitialization,
  confirmKmsInitializationStep,
  getKmsInitialization,
  getKmsInitializationPlan,
  recheckKmsInitialization,
  testKmsInitialization
} from '@/api/kms/initialization';
import type { InitializationCheck, InitializationCommand, InitializationPlan } from '@/api/kms/initialization';
const router = useRouter();
const titles = ['协议', '环境检查', '主机类型', '设备初始化', '网络与服务配置', '安全策略', '管理员绑定', '初始化验证', '完成'];
const plan = ref<InitializationPlan>();
const locked = ref(false);
const busy = ref(false);
const mobile = ref(false);
const error = ref('');
const accepted = ref(false);
const hostType = ref<'STANDALONE'>('STANDALONE');
const now = ref(Date.now());
const step = computed(() => plan.value?.status.step ?? 1);
const remaining = computed(() => Math.max(0, Math.floor(((plan.value?.expiresAt ?? 0) - now.value) / 1000)));
const expired = computed(() => remaining.value === 0);
const currentChecks = computed(() => plan.value?.checks.filter((item) => item.step === step.value) ?? []);
const deviceSummary = computed(() => ({
  '设备': plan.value?.summary.device ?? '',
  'Provider': plan.value?.summary.provider ?? '',
  '专用 KEK': plan.value?.summary.kek ?? ''
}));
const networkSummary = computed(() => ({
  '进程监听端口': plan.value?.summary.processPort ?? '',
  '管理访问地址': plan.value?.summary.publicBaseUrl ?? '',
  'KMIP': plan.value?.summary.kmip ?? ''
}));
const canContinue = computed(
  () =>
    !busy.value &&
    plan.value?.status.canInitialize &&
    (plan.value?.checks ?? []).filter((c) => c.step <= step.value).every((c) => !c.required || c.status === 'PASS') &&
    (step.value !== 1 || accepted.value) &&
    (step.value !== 9 || (accepted.value && !expired.value))
);
const CheckList = defineComponent<{ checks: InitializationCheck[] }>({
  props: ['checks'],
  setup: (props) => () =>
    h(
      'div',
      { class: 'check-list' },
      props.checks.map((check) =>
        h(ElAlert, {
          key: check.code,
          title: check.name,
          description: `${check.remedy}${check.checkedAt ? ` · ${new Date(check.checkedAt).toLocaleString()}` : ''}`,
          type: check.status === 'PASS' ? 'success' : 'warning',
          showIcon: true,
          closable: false
        })
      )
    )
});
const Summary = defineComponent<{ items: Record<string, string> }>({
  props: ['items'],
  setup: (props) => () =>
    h(ElDescriptions, { column: 1, border: true }, () =>
      Object.entries(props.items).map(([label, value]) => h(ElDescriptionsItem, { label, key: label }, () => value || '尚未配置'))
    )
});
function apply(value: InitializationPlan) {
  if (plan.value && value.status.revision < plan.value.status.revision) return;
  plan.value = value;
  locked.value = value.status.locked;
  accepted.value = false;
  now.value = Date.now();
}
async function run(operation: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  try {
    await operation();
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '操作未完成，请重新检测或刷新进度';
  } finally {
    busy.value = false;
  }
}
function load() {
  return run(async () => {
    const status = await getKmsInitialization();
    locked.value = status.locked;
    if (!locked.value) apply(await getKmsInitializationPlan());
  });
}
function recheck() {
  return run(async () => apply(await recheckKmsInitialization()));
}
function advance() {
  if (!plan.value || !canContinue.value) return;
  const requestId = (completionRequestId ??= crypto.randomUUID());
  const data: InitializationCommand = {
    revision: plan.value.status.revision,
    revisions: plan.value.revisions,
    accepted: accepted.value,
    agreementVersion: plan.value.summary.agreementVersion,
    hostType: hostType.value,
    verificationId: plan.value.verificationId,
    requestId
  };
  return run(async () => {
    try {
      apply(
        step.value === 8
          ? await testKmsInitialization(data)
          : step.value === 9
            ? await completeKmsInitialization(data)
            : await confirmKmsInitializationStep(step.value, data)
      );
    } catch (failure) {
      try {
        apply(await getKmsInitializationPlan());
      } catch {
        /* 保留当前草稿和原始错误，允许重试。 */
      }
      throw failure;
    }
  });
}
let completionRequestId: string | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let media: MediaQueryList | undefined;
const resize = () => {
  mobile.value = media?.matches ?? false;
};
onMounted(() => {
  media = window.matchMedia('(max-width: 768px)');
  resize();
  media.addEventListener('change', resize);
  void load();
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => {
  media?.removeEventListener('change', resize);
  if (timer) clearInterval(timer);
});
</script>
<style scoped>
.kms-init {
  max-width: 1280px;
  margin: 0 auto;
}
.init-header,
.step-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.init-header h1 {
  margin: 8px 0;
  font-size: 26px;
}
.init-header p {
  color: var(--el-text-color-secondary);
}
.eyebrow {
  margin: 0;
  font-size: 13px;
}
.init-alert {
  margin-bottom: 20px;
}
.init-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
}
aside {
  min-height: 620px;
  padding: 20px 0;
}
.step-heading h2 {
  font-size: 20px;
  margin: 0;
}
.agreement-scroll {
  max-height: 460px;
  overflow: auto;
  margin-bottom: 20px;
  padding-right: 16px;
}
.check-list {
  display: grid;
  gap: 12px;
  margin: 16px 0;
}
.completion-confirm {
  margin-top: 20px;
  white-space: normal;
  height: auto;
}
footer {
  margin-top: 28px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
@media (max-width: 768px) {
  .init-grid {
    grid-template-columns: 1fr;
  }
  aside {
    min-height: auto;
    overflow-x: auto;
    padding: 12px 0;
  }
  :deep(.el-steps) {
    min-width: 1080px;
  }
  :deep(.el-steps) {
    gap: 12px;
  }
  .init-header {
    align-items: flex-start;
  }
  footer {
    flex-wrap: wrap;
  }
}
</style>
