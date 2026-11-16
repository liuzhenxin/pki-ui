<template>
  <AuditTable title="操作日志" :query="listOperations">
    <el-table-column label="操作时间" prop="createdAt" min-width="185" />
    <el-table-column label="管理员" min-width="110">
      <template #default>admin</template>
    </el-table-column>
    <el-table-column label="操作" prop="action" min-width="180" />
    <el-table-column label="目标" prop="target" min-width="220" show-overflow-tooltip />
    <el-table-column label="版本" prop="version" width="90" />
    <el-table-column label="事件 ID" prop="eventId" min-width="250" show-overflow-tooltip />
  </AuditTable>
</template>

<script setup lang="ts">
import AuditTable from './AuditTable.vue';
import { listOperations } from '@/api/ucsp/audit';
</script>
