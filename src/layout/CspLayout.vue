<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useWindowSize } from '@vueuse/core';
import { Menu, Monitor, Setting } from '@element-plus/icons-vue';
import ManagementFrame from './components/ManagementFrame.vue';
import mark from '@/assets/brand/csp-mark-inverse.svg';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
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
            <el-menu-item :index="destination" :aria-label="destination === '/csp/overview' ? '运行总览' : '初始化引导'"
              ><el-icon><Monitor v-if="destination === '/csp/overview'" /><Setting v-else /></el-icon
              ><span>{{ destination === '/csp/overview' ? '运行总览' : '初始化引导' }}</span></el-menu-item
            >
          </el-menu>
        </nav>
        <p class="csp-sidebar-note">CSP · {{ cspProduct.version }} 测试版<br />未开放业务菜单不显示</p>
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
      <div class="csp-tabs" aria-label="当前页面">
        <span>{{ route.meta.title }}</span>
      </div>
    </template>
    <main id="main" tabindex="-1"><router-view /></main>
    <p v-if="error && route.path !== '/csp/setup'" class="error" role="alert">{{ error }}</p>
  </ManagementFrame>
</template>
