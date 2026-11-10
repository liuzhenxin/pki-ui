<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const store = useCspConsoleStore();
const router = useRouter();
const { httpTestMode, checkedAt, busy, setup } = storeToRefs(store);
onMounted(() => store.refresh());
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
        !setup ? '服务状态尚未确认' : setup.enabledCapabilities.length ? '随机数服务已启用' : '当前检查未通过，服务关闭'
      }}</el-tag>
      <p>统一 Auth 身份认证 · CSP 租户 10</p>
      <p class="muted">最近核查：{{ checkedAt || '尚无成功核查' }} · Asia/Shanghai</p>
    </el-card>
    <el-card v-if="store.allows('/csp/devices')" shadow="never" class="csp-overview-card"
      ><template #header><h2>密码设备</h2></template>
      <p>查看设备状态、Agent 健康和设备配置。</p>
      <router-link to="/csp/devices">打开设备列表</router-link>
    </el-card>
  </div>
</template>
