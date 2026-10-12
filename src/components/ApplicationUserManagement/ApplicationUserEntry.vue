<template>
  <ApplicationUserManagement v-if="mode === 'ENFORCE'" />
  <component :is="legacyComponent" v-else-if="mode === 'LEGACY' || mode === 'SHADOW'" />
  <el-card v-else v-loading="loading"
    ><el-empty description="无法确认当前管理权限，操作已关闭"><el-button @click="load">重新加载</el-button></el-empty></el-card
  >
</template>
<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue';
import { getApplicationAuthorizationContext } from '@/api/system/applicationAuthorization';
import ApplicationUserManagement from './index.vue';
defineProps<{ legacyComponent: Component }>();
const mode = ref('');
const loading = ref(false);
async function load() {
  mode.value = '';
  loading.value = true;
  try {
    mode.value = (await getApplicationAuthorizationContext()).mode;
  } catch {
    mode.value = '';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
