<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const store = useCspConsoleStore();
const router = useRouter();
const { httpTestMode, checkedAt, busy, setup } = storeToRefs(store);
async function refresh() {
  await store.refresh();
  await router.replace(store.destination);
}
</script>
<template>
  <div class="app-container csp-page">
    <p v-if="httpTestMode" class="notice" role="status">128 HTTP 测试入口 · 不用于生产，网络传输未加密。</p>
    <div class="wizard-heading">
      <div>
        <p class="eyebrow">CSP CONSOLE</p>
        <h1>运行总览</h1>
        <p class="muted">服务启用与当前可用能力来自 CSP 服务端，按实际检查结果逐项放行。</p>
      </div>
      <el-button :loading="busy" @click="refresh">刷新状态</el-button>
    </div>
    <el-card shadow="never" class="csp-overview-card"
      ><template #header><h2>服务启用状态</h2></template>
      <el-tag :type="setup?.enabledCapabilities.length ? 'success' : 'warning'" effect="plain">{{
        setup?.enabledCapabilities.length ? '随机数服务已启用' : '当前检查未通过，服务关闭'
      }}</el-tag>
      <p>统一 Auth 身份认证 · CSP 租户 10</p>
      <p class="muted">最近核查：{{ checkedAt || '尚无成功核查' }} · Asia/Shanghai</p>
    </el-card>
    <el-card shadow="never" class="csp-overview-card"
      ><template #header><h2>当前版本边界</h2></template>
      <p>Auth/Admin 管理身份；部署脚本负责安装；CSP 负责资源核验、非破坏性自检与服务启用。</p>
      <p class="muted">设备、资源池、密钥、路由、审批及审计业务菜单尚未开放；不展示模拟指标，不提供未验收操作。</p>
    </el-card>
  </div>
</template>
