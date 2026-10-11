<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const store = useCspConsoleStore();
const router = useRouter();
const { httpTestMode, checkedAt, busy } = storeToRefs(store);
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
        <p class="muted">初始化状态来自 CSP 服务端，不代表密码设备及全部服务已验收。</p>
      </div>
      <el-button :loading="busy" @click="refresh">刷新状态</el-button>
    </div>
    <el-card shadow="never" class="csp-overview-card"
      ><template #header><h2>平台初始化状态</h2></template> <el-tag type="success" effect="plain">已完成初始化</el-tag>
      <p>统一 Auth 身份认证 · CSP 租户 10</p>
      <p class="muted">最近核查：{{ checkedAt || '尚无成功核查' }} · Asia/Shanghai</p>
    </el-card>
    <el-card shadow="never" class="csp-overview-card"
      ><template #header><h2>当前版本边界</h2></template>
      <p>已接入共享工程的登录、初始化与总览入口。</p>
      <p class="muted">设备、资源池、密钥、路由、审批及审计业务菜单尚未开放；不展示模拟指标，不提供未验收操作。</p>
    </el-card>
  </div>
</template>
