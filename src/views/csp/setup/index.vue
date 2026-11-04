<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const store = useCspConsoleStore();
const router = useRouter();
const { initialized, setupStep, setup, busy, error, httpTestMode, confirmed, accountTransport, checkedAt } = storeToRefs(store);
const groups = ['ENVIRONMENT', 'RESOURCES', 'POLICY'] as const;
const titles = ['环境检查', '密码资源接入', '服务策略核验', '验收并启用'];
const labels: Record<string, string> = {
  PLATFORM_SCHEMA: '数据库与平台部署基线',
  HARDWARE_PROTECTION: '硬件保护与禁止软件回退',
  EXECUTION_ENTRY: '已实现的密码服务入口',
  SDF_RANDOM_RESOURCE: '真实 SDF 随机数资源与近期健康',
  SDF_SM3_RESOURCE: '真实 SDF 摘要资源与近期健康',
  APPLICATION_MAPPING: 'Auth 客户端与 CSP 应用映射',
  RANDOM_AUTHORIZATION: '随机数能力授权',
  SM3_AUTHORIZATION: '公开摘要自检授权',
  FOUR_DIMENSION_QUOTAS: '租户、应用、能力与资源池配额'
};
const visibleChecks = computed(
  () => setup.value?.checks.filter((row) => initialized.value || setupStep.value === 3 || row.group === groups[setupStep.value]) || []
);
const currentReady = computed(() => visibleChecks.value.length > 0 && visibleChecks.value.every((row) => row.ready));
const actions = ['CHECK_ENV', 'CHECK_RESOURCES', 'CHECK_POLICY'] as const;
async function refresh() {
  await store.refresh();
}
</script>
<template>
  <div class="app-container csp-page">
    <p v-if="httpTestMode" class="notice" role="status">HTTP 测试入口 · 不用于生产，网络传输未加密。</p>
    <p class="eyebrow">CSP CONSOLE</p>
    <h1>资源接入与服务启用</h1>
    <p class="muted">安装由部署脚本完成，账号与登录由 Auth/Admin 管理。本向导核验已纳管资源、现有策略和服务启用条件。</p>
    <ol class="setup-steps" aria-label="服务启用进度">
      <li
        v-for="(title, index) in titles"
        :key="title"
        :class="{ current: setupStep === index, done: setupStep > index || initialized }"
        :aria-current="setupStep === index ? 'step' : undefined"
      >
        <span aria-hidden="true">{{ index + 1 }}</span
        >{{ title }}
      </li>
    </ol>
    <section v-if="!setup || initialized === null" class="wizard-panel">
      <h2>需要确认服务启用状态</h2>
      <p>请刷新查询。缺少部署基线或当前授权时，由运维及平台管理员处理。</p>
      <el-button :loading="busy" @click="refresh">刷新状态</el-button>
    </section>
    <section v-else class="wizard-panel" :aria-busy="busy">
      <h2>{{ initialized ? '已完成首次服务启用验收' : titles[setupStep] }}</h2>
      <p v-if="setupStep === 0 && !initialized">核验数据库部署基线、硬件保护模式与已实现入口。连接凭据通过部署 Secret 注入。</p>
      <p v-else-if="setupStep === 1 && !initialized">
        核验已部署 Agent 与已纳管密码资源的当前健康和能力。资源不存在时，请先通过受控资源管理流程纳管。
      </p>
      <p v-else-if="setupStep === 2 && !initialized">
        核验现有应用映射、能力授权与配额。由 Auth/Admin 管理身份，通过受控配置管理服务策略；本页不创建或改写账号。
      </p>
      <p v-else-if="!initialized">确认后经正式路由和 Agent 执行随机数、公开 SM3 向量自检，并原子保存服务启用回执与审计。</p>
      <ul class="environment-list" aria-label="当前必要检查">
        <li v-for="check in visibleChecks" :key="check.code">
          <strong>{{ labels[check.code] || '必要检查' }}</strong>
          <span :class="check.ready ? 'check-ok' : 'check-failed'">{{ check.ready ? '当前检查通过' : '尚未通过，请完成对应部署或管理配置' }}</span>
        </li>
      </ul>
      <p class="notice">本向导不收集 PIN 或底层口令，不生成、覆盖或销毁设备密钥。自检通过仅支持已实现能力，不表示全部 17 项操作可用。</p>
      <template v-if="initialized">
        <p role="status">当前可用能力：{{ setup.enabledCapabilities.length ? '随机数 HTTP 服务' : '当前检查未通过，服务保持关闭' }}。</p>
        <p>后续变更通过正常管理与审计流程处理，首次向导不重新开放。</p>
        <el-button :disabled="busy" @click="router.replace('/csp/overview')">进入管理首页</el-button>
      </template>
      <template v-else-if="setupStep < 3">
        <el-button
          type="primary"
          :loading="busy"
          :disabled="busy || !accountTransport || !currentReady"
          @click="store.advanceSetup(actions[setupStep])"
          >核验并继续</el-button
        >
      </template>
      <template v-else>
        <dl class="setup-summary">
          <dt>服务版本</dt>
          <dd>{{ setup.serviceVersion }}</dd>
          <dt>运行环境</dt>
          <dd>{{ setup.environment }}</dd>
          <dt>核验时间</dt>
          <dd>{{ checkedAt }}</dd>
        </dl>
        <label class="setup-confirm"
          ><input v-model="confirmed" type="checkbox" :disabled="busy" />我确认现有资源与策略，执行非破坏性自检并启用已实现服务</label
        >
        <el-button type="primary" :loading="busy" :disabled="busy || !confirmed || !currentReady || !accountTransport" @click="store.initialize"
          >自检并启用</el-button
        >
      </template>
      <el-button :disabled="busy" @click="refresh">刷新检查结果</el-button>
      <el-button v-if="!initialized && setupStep > 0" :disabled="busy" @click="store.advanceSetup('CHECK_ENV')">从环境重新核验</el-button>
    </section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="muted">最近核验：{{ checkedAt || '尚无有效核验' }} · Asia/Shanghai</p>
  </div>
</template>
<style scoped>
.setup-steps {
  flex-wrap: wrap;
}
.muted,
.setup-summary dd {
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .environment-list li {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>
