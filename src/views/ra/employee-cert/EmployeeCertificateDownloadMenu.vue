<template>
  <el-dropdown v-if="button" trigger="click" :disabled="disabled || loading" @command="$emit('download', $event)">
    <el-button :type="button" :plain="batch" icon="Download" :loading="loading" :disabled="disabled">{{ label }}</el-button>
    <template #dropdown><el-dropdown-menu>
      <el-dropdown-item v-for="[format, name] in options" :key="format" :command="format">{{ name }}</el-dropdown-item>
    </el-dropdown-menu></template>
  </el-dropdown>
  <CertRowAction v-else :label="label" icon="Download" :loading="loading" :disabled="disabled || loading" @command="$emit('download', $event)">
    <template #dropdown><el-dropdown-menu>
      <el-dropdown-item v-for="[format, name] in options" :key="format" :command="format">{{ name }}</el-dropdown-item>
    </el-dropdown-menu></template>
  </CertRowAction>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EmployeeCertDownloadFormat } from '@/api/ra/employeeCert';
import CertRowAction from '../components/CertRowAction.vue';

const props = withDefaults(defineProps<{
  batch?: boolean; button?: 'primary'; disabled?: boolean; loading?: boolean; label?: string;
}>(), { label: '下载证书' });
defineEmits<{ download: [format: EmployeeCertDownloadFormat] }>();
const options = computed<[EmployeeCertDownloadFormat, string][]>(() => props.batch
  ? [['cer', 'CER 证书'], ['pem', 'PEM 证书'], ['crt', 'CRT 证书'], ['p7b', 'P7B 证书包'], ['pfx', 'PFX 证书包（含私钥）']]
  : [['all', '全部下载'], ['cer', 'CER 证书'], ['pfx', 'PFX 证书包']]);
</script>
