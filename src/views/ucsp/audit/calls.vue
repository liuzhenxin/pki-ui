<template>
  <AuditTable title="接口调用日志" :query="query">
    <template #toolbar="{ reload }">
      <el-form inline @submit.prevent="search(reload)">
        <el-form-item label="请求 ID">
          <el-input v-model="input" clearable maxlength="36" placeholder="输入完整请求 ID" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">查询</el-button>
          <el-button
            @click="
              input = '';
              search(reload);
            "
            >重置</el-button
          >
        </el-form-item>
      </el-form>
    </template>
    <el-table-column label="调用时间" prop="createdAt" min-width="185" />
    <el-table-column label="请求 ID" prop="requestId" min-width="260" show-overflow-tooltip />
    <el-table-column label="应用" prop="applicationId" min-width="160" show-overflow-tooltip />
    <el-table-column label="能力" prop="capability" min-width="130" />
    <el-table-column label="逻辑对象" prop="objectId" min-width="140" show-overflow-tooltip />
    <el-table-column label="服务" prop="serviceId" min-width="140" show-overflow-tooltip />
    <el-table-column label="实际端点" prop="endpointId" min-width="140" show-overflow-tooltip />
    <el-table-column label="资源版本" prop="resourceVersion" width="100" />
    <el-table-column label="授权版本" prop="grantVersion" width="100" />
    <el-table-column label="结果" prop="outcome" min-width="130" />
    <el-table-column label="耗时（毫秒）" prop="elapsedMillis" width="130" />
  </AuditTable>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import AuditTable from './AuditTable.vue';
import { listCalls } from '@/api/ucsp/audit';

const input = ref('');
let requestId: string | undefined;
const query = (offset: number) => listCalls(offset, requestId);
const search = (reload: () => void) => {
  const value = input.value.trim().toLowerCase();
  if (value && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)) {
    ElMessage.warning('请输入完整的请求 ID');
    return;
  }
  requestId = value || undefined;
  reload();
};
</script>
