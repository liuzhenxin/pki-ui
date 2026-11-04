<template><ApplicationAuthorizationEntry :legacy-component="LegacyManagement" /></template>
<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import ApplicationAuthorizationEntry from '@/components/ApplicationUserManagement/ApplicationUserEntry.vue';
const LegacyManagement = defineAsyncComponent(() => import('./legacy.vue'));
</script>
