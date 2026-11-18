<template>
  <div class="usage-table">
    <el-table :data="rows" border>
      <el-table-column label="使用系统" min-width="160">
        <template #default="{ row }"><el-input v-model="row.systemName" maxlength="200" placeholder="必填" /></template>
      </el-table-column>
      <el-table-column label="系统负责人" min-width="210">
        <template #default="{ row }">
          <EmployeeSelect :employee-id="row.businessOwnerEmployeeId" :employee-name="row.businessOwnerName" :lookup="lookup" @select="(employee) => Object.assign(row, { businessOwnerEmployeeId: employee.id, businessOwnerName: employee.cnName, departmentName: employee.departmentName })" />
        </template>
      </el-table-column>
      <el-table-column label="使用域名" min-width="190">
        <template #default="{ row }"><el-input v-model="row.usageDomain" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" maxlength="500" placeholder="多个域名按行填写" /></template>
      </el-table-column>
      <el-table-column label="使用场景" min-width="170">
        <template #default="{ row }"><el-input v-model="row.usageScene" type="textarea" :rows="2" maxlength="500" /></template>
      </el-table-column>
      <el-table-column width="54" align="center">
        <template #default="{ $index }"><el-button icon="Delete" link type="danger" title="删除使用信息" :disabled="rows.length <= 1" @click="rows.splice($index, 1)" /></template>
      </el-table-column>
    </el-table>
    <el-button class="mt8" icon="Plus" :disabled="rows.length >= 100" @click="rows.push({ systemName: '', usageDomain: '', usageScene: '' })">新增使用信息</el-button>
  </div>
</template>

<script setup lang="ts">
import EmployeeSelect from './EmployeeSelect.vue';
import type { PublicCertEmployee, PublicCertUsage } from '@/api/ra/publicCert';
defineProps<{ lookup: (keyword: string) => Promise<PublicCertEmployee[]> }>();
const rows = defineModel<PublicCertUsage[]>({ default: () => [] });
</script>

<style scoped>
.usage-table { width: 100%; min-width: 0; }
</style>
