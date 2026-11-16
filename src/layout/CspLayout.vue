<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useWindowSize } from '@vueuse/core';
import { Menu, Monitor, Setting } from '@element-plus/icons-vue';
import { ElSubMenu } from 'element-plus';
import ManagementFrame from './components/ManagementFrame.vue';
import mark from '@/assets/brand/csp-mark-inverse.svg';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
import '@/products/csp/style.css';
import { cspProduct } from '@/config/csp';
const store = useCspConsoleStore();
const { busy, error, destination } = storeToRefs(store);
const router = useRouter();
const route = useRoute();
const { width } = useWindowSize();
const opened = ref(width.value >= 992);
watch(
  () => route.path,
  () => {
    if (width.value < 992) opened.value = false;
  }
);
watch(
  () => width.value >= 992,
  (value) => {
    opened.value = value;
  }
);
async function logout() {
  await store.logout();
  if (!store.signedIn) await router.replace('/login');
}
</script>
<template>
  <ManagementFrame class="csp-shell" :class="{ mobile: width < 992, openSidebar: opened, hideSidebar: !opened }">
    <template #navigation>
      <button v-if="width < 992 && opened" class="csp-drawer-bg" aria-label="关闭导航菜单" @click="opened = false" />
      <aside id="csp-navigation" class="sidebar-container csp-sidebar" :inert="width < 992 && !opened">
        <router-link :to="destination" class="csp-brand" aria-label="密码服务平台首页"
          ><img :src="mark" alt="" width="32" height="32" /><span>密码服务平台</span></router-link
        >
        <nav aria-label="控制台导航">
          <el-menu :default-active="route.path" router background-color="transparent" text-color="#e2e8f0" active-text-color="#176ac3">
            <el-menu-item v-if="store.allows(cspProduct.home)" :index="cspProduct.home"
              ><el-icon><Monitor /></el-icon><span>运行总览</span></el-menu-item
            >
            <el-sub-menu v-if="store.allows('/csp/applications')" index="application-management">
              <template #title
                ><el-icon><Setting /></el-icon><span>应用接入</span></template
              >
              <el-menu-item index="/csp/applications">应用列表</el-menu-item>
              <el-menu-item v-if="store.allows('/csp/application-resources')" index="/csp/application-resources">服务与配额</el-menu-item>
            </el-sub-menu>
            <el-sub-menu v-if="store.allows('/csp/devices')" index="device-management">
              <template #title
                ><el-icon><Setting /></el-icon><span>密码设备管理</span></template
              >
              <el-menu-item index="/csp/devices">设备列表</el-menu-item>
            </el-sub-menu>
            <el-sub-menu v-if="store.allows('/csp/services/svs')" index="service-management">
              <template #title
                ><el-icon><Setting /></el-icon><span>密码服务管理</span></template
              >
              <el-menu-item index="/csp/services/svs">签名验签服务器</el-menu-item>
              <el-menu-item index="/csp/services/tsa">时间戳服务器</el-menu-item>
              <el-menu-item index="/csp/services/sef">电子签章系统</el-menu-item>
            </el-sub-menu>
            <el-menu-item v-if="store.allows(cspProduct.installation)" :index="cspProduct.installation"
              ><el-icon><Setting /></el-icon><span>安装初始化</span></el-menu-item
            >
            <el-menu-item v-if="store.allows('/csp/auditors')" index="/csp/auditors">
              <el-icon><Setting /></el-icon><span>审计员管理</span>
            </el-menu-item>
            <el-menu-item v-if="store.allows('/csp/login-logs')" index="/csp/login-logs">
              <el-icon><Monitor /></el-icon><span>登录日志</span>
            </el-menu-item>
            <el-menu-item v-if="store.allows('/csp/operation-logs')" index="/csp/operation-logs">
              <el-icon><Monitor /></el-icon><span>操作日志</span>
            </el-menu-item>
          </el-menu>
        </nav>
        <p class="csp-sidebar-note">CSP · {{ cspProduct.version }}<br />管理操作按当前权限校验</p>
      </aside>
    </template>
    <template #header>
      <header class="csp-navbar">
        <el-button
          class="csp-menu-toggle"
          :icon="Menu"
          :aria-expanded="opened"
          aria-controls="csp-navigation"
          aria-label="切换导航菜单"
          @click="opened = !opened"
        />
        <el-breadcrumb separator="/"
          ><el-breadcrumb-item>密码服务平台</el-breadcrumb-item><el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item></el-breadcrumb
        >
        <el-button class="csp-logout" :disabled="busy" @click="logout">退出登录</el-button>
      </header>
      <div class="csp-tabs" role="region" aria-label="当前页面">
        <span>{{ route.meta.title }}</span>
      </div>
    </template>
    <main id="main" tabindex="-1"><router-view :key="route.path" /></main>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </ManagementFrame>
</template>
