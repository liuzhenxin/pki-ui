<template>
  <div class="app-container">
    <el-alert
      title="所有密钥生成统一由水位策略或管理员手工操作触发。本页面只展示不可修改的执行记录。"
      type="info"
      show-icon
      :closable="false"
      class="mb8"
    />

    <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="90px">
      <el-form-item label="密钥策略" prop="strategyId">
        <el-select v-model="queryParams.strategyId" clearable filterable placeholder="全部策略" style="width: 260px">
          <el-option v-for="item in strategyOptions" :key="item.id" :label="strategyText(item)" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="触发来源" prop="triggerType">
        <el-select v-model="queryParams.triggerType" clearable placeholder="全部来源" style="width: 180px">
          <el-option label="水位补齐" value="WATERMARK" />
          <el-option label="手工定量生成" value="MANUAL_QUANTITY" />
          <el-option label="旧版计划任务" value="SCHEDULE" />
        </el-select>
      </el-form-item>
      <el-form-item label="执行结果" prop="status">
        <el-select v-model="queryParams.status" clearable placeholder="全部结果" style="width: 150px">
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
          <el-option label="跳过" value="SKIPPED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="recordList" border>
      <el-table-column label="策略" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ strategyLabel(row.strategyId) }}</template>
      </el-table-column>
      <el-table-column label="触发来源" width="150" align="center">
        <template #default="{ row }">{{ triggerTypeText(row.triggerType) }}</template>
      </el-table-column>
      <el-table-column label="执行结果" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="请求数量" prop="requestedCount" width="110" align="right" />
      <el-table-column label="成功数量" prop="actualCount" width="110" align="right" />
      <el-table-column label="开始时间" prop="startTime" width="180" />
      <el-table-column label="完成时间" prop="endTime" width="180" />
      <el-table-column label="耗时" width="100" align="right">
        <template #default="{ row }">{{ durationText(row.startTime, row.endTime) }}</template>
      </el-table-column>
      <el-table-column label="失败原因" prop="failureReason" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ row.failureReason || '-' }}</template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
  </div>
</template>

<script setup name="KmcPoolGenerationRecord" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { FormInstance } from 'element-plus';
import { listPoolStrategy } from '@/api/kmc/poolStrategy';
import type { PoolStrategyVO } from '@/api/kmc/poolStrategy/types';
import { listPoolGenerationJobLog } from '@/api/kmc/poolGenerationJob';
import type { PoolGenerationJobLogQuery, PoolGenerationJobLogVO } from '@/api/kmc/poolGenerationJob/types';
import { readKmcPage } from '@/api/kmc/common';

const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const recordList = ref<PoolGenerationJobLogVO[]>([]);
const strategyOptions = ref<PoolStrategyVO[]>([]);
const total = ref(0);
const queryParams = reactive<PoolGenerationJobLogQuery>({
  pageNum: 1,
  pageSize: 10,
  strategyId: undefined,
  triggerType: undefined,
  status: undefined
});

const strategyText = (item: PoolStrategyVO) => `${item.algType} / 低${item.lowWatermark} 高${item.highWatermark}`;
const strategyLabel = (id: string | number) =>
  strategyOptions.value.find((item) => String(item.id) === String(id))
    ? strategyText(strategyOptions.value.find((item) => String(item.id) === String(id))!)
    : String(id);
const triggerTypeText = (value?: string) =>
  ({ WATERMARK: '水位补齐', MANUAL_QUANTITY: '手工定量生成', SCHEDULE: '旧版计划任务', MANUAL: '旧版手工任务' })[value || ''] || value || '-';
const statusText = (value?: string) => ({ SUCCESS: '成功', FAILED: '失败', SKIPPED: '跳过', RUNNING: '执行中' })[value || ''] || value || '-';
const statusType = (value?: string): 'success' | 'danger' | 'warning' | 'info' =>
  value === 'SUCCESS' ? 'success' : value === 'FAILED' ? 'danger' : value === 'RUNNING' ? 'warning' : 'info';
const durationText = (start?: string, end?: string) => {
  if (!start || !end) return '-';
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  return milliseconds < 1000 ? `${milliseconds}ms` : `${(milliseconds / 1000).toFixed(1)}s`;
};

const loadStrategies = async () => {
  const page = readKmcPage<PoolStrategyVO>(await listPoolStrategy({ pageNum: 1, pageSize: 200 }));
  strategyOptions.value = page.records;
};
const getList = async () => {
  loading.value = true;
  try {
    const page = readKmcPage<PoolGenerationJobLogVO>(await listPoolGenerationJobLog(queryParams));
    recordList.value = page.records;
    total.value = page.total;
  } finally {
    loading.value = false;
  }
};
const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};
const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

onMounted(async () => {
  await loadStrategies();
  await getList();
});
</script>
