<template>
  <KmsConsole v-if="String(userStore.tenantId || localStorageTenant) === '2'" />
  <PlatformHome v-else />
</template>
<script setup lang="ts" name="ProductHome">
import { defineAsyncComponent } from 'vue';
import { useUserStore } from '@/store/modules/user';
const userStore = useUserStore();
const localStorageTenant = localStorage.getItem('tenantId');
const KmsConsole = defineAsyncComponent(() => import('./index.vue'));
const PlatformHome = defineAsyncComponent(() => import('@/views/index.vue'));
</script>
