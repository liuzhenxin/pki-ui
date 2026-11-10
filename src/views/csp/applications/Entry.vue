<script setup lang="ts">
import { useCspConsoleStore } from '@/store/modules/cspConsole';
import LegacyApplications from '@/views/csp/management/index.vue';
import RegisteredApplications from './index.vue';

const session = useCspConsoleStore();
</script>

<template>
  <RegisteredApplications v-if="session.ownedApplications" />
  <LegacyApplications v-else application-only />
</template>
