<template>
  <el-config-provider :locale="appStore.locale" :size="appStore.size">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { useSettingsStore } from '@/store/modules/settings';
import { handleThemeStyle } from '@/utils/theme';
import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';
import { isCertLogin, startCertSession } from '@/utils/certSessionWatcher';

const appStore = useAppStore();
const userStore = useUserStore();

onMounted(() => {
  if (userStore.token && isCertLogin()) {
    startCertSession();
  }
  nextTick(() => {
    // 初始化主题样式
    handleThemeStyle(useSettingsStore().theme);
  });
});
</script>
