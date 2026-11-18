<template>
  <el-select :model-value="employeeId" filterable remote :remote-method="search" :loading="loading" placeholder="输入姓名或域账号" @change="choose">
    <el-option v-if="employeeId && !options.some((item) => String(item.id) === String(employeeId))" :value="employeeId" :label="employeeName || String(employeeId)" />
    <el-option v-for="item in options" :key="String(item.id)" :value="item.id" :label="`${item.cnName} (${item.domainAccount})`" />
  </el-select>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { PublicCertEmployee } from '@/api/ra/publicCert';

const props = defineProps<{ employeeId?: number | string; employeeName?: string; lookup: (keyword: string) => Promise<PublicCertEmployee[]> }>();
const emit = defineEmits<{ select: [employee: PublicCertEmployee] }>();
const options = ref<PublicCertEmployee[]>([]);
const loading = ref(false);
let version = 0;

async function search(keyword: string) {
  const current = ++version;
  options.value = [];
  if (!keyword.trim()) { loading.value = false; return; }
  loading.value = true;
  try {
    const result = await props.lookup(keyword.trim());
    if (current === version) options.value = result;
  } catch (error: any) {
    if (current === version) ElMessage.error(error?.message || '员工查询失败');
  } finally {
    if (current === version) loading.value = false;
  }
}

function choose(id: number | string) {
  const employee = options.value.find((item) => String(item.id) === String(id));
  if (employee) emit('select', employee);
}
</script>
