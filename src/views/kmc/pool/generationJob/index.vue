<template>
  <div class="app-container pool-generation-job-page">
    <el-form v-show="showSearch" ref="queryFormRef" :model="queryParams" :inline="true" label-width="90px">
      <el-form-item label="密钥策略" prop="strategyId">
        <el-select v-model="queryParams.strategyId" placeholder="请选择密钥策略" clearable filterable style="width: 260px">
          <el-option v-for="item in strategyOptions" :key="item.id" :label="strategyText(item)" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="执行策略" prop="executeType">
        <el-select v-model="queryParams.executeType" placeholder="请选择执行策略" clearable style="width: 170px">
          <el-option v-for="item in executeTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="任务状态" clearable style="width: 140px">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['kmc:poolgenerationjob:save']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['kmc:poolgenerationjob:modify']">
          修改
        </el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['kmc:poolgenerationjob:remove']">
          删除
        </el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="jobList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="任务名称" prop="jobName" min-width="150" show-overflow-tooltip />
      <el-table-column label="密钥策略" prop="strategyLabel" min-width="220" show-overflow-tooltip />
      <el-table-column label="执行策略" prop="executeType" width="130" align="center">
        <template #default="{ row }">{{ executeTypeText(row.executeType) }}</template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="运行状态" prop="runStatus" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="runStatusType(row.runStatus)">{{ runStatusText(row.runStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下次执行" prop="nextRunTime" width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.nextRunTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="成功/失败" width="100" align="center">
        <template #default="{ row }">{{ row.successCount || 0 }}/{{ row.failureCount || 0 }}</template>
      </el-table-column>
      <el-table-column label="最近失败原因" prop="lastFailureReason" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.lastFailureReason || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="250" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="手动执行" placement="top">
            <el-button link type="primary" icon="VideoPlay" @click="handleTrigger(row)" v-hasPermi="['kmc:poolgenerationjob:trigger']" />
          </el-tooltip>
          <el-tooltip :content="row.status === 1 ? '停用' : '启用'" placement="top">
            <el-button
              link
              type="primary"
              :icon="row.status === 1 ? 'CircleClose' : 'CircleCheck'"
              @click="handleStatus(row)"
              v-hasPermi="['kmc:poolgenerationjob:enable', 'kmc:poolgenerationjob:disable']"
            />
          </el-tooltip>
          <el-tooltip content="执行日志" placement="top">
            <el-button link type="primary" icon="Document" @click="handleLogs(row)" v-hasPermi="['kmc:poolgenerationjob:log']" />
          </el-tooltip>
          <el-tooltip content="修改" placement="top">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(row)" v-hasPermi="['kmc:poolgenerationjob:modify']" />
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-button link type="primary" icon="Delete" @click="handleDelete(row)" v-hasPermi="['kmc:poolgenerationjob:remove']" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="dialog.title" v-model="dialog.visible" width="620px" append-to-body>
      <el-form ref="jobFormRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="任务名称" prop="jobName">
          <el-input v-model="form.jobName" placeholder="请输入任务名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="密钥策略" prop="strategyId">
          <el-select v-model="form.strategyId" placeholder="请选择密钥策略" filterable style="width: 100%">
            <el-option v-for="item in strategyOptions" :key="item.id" :label="strategyText(item)" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行策略" prop="executeType">
          <el-radio-group v-model="form.executeType">
            <el-radio-button value="IMMEDIATE">立即执行</el-radio-button>
            <el-radio-button value="CRON">定时执行</el-radio-button>
            <el-radio-button value="FIXED_INTERVAL">固定间隔</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.executeType === 'CRON'" label="Cron 表达式" prop="cronExpression">
          <el-input v-model="form.cronExpression" placeholder="例如 0 0/5 * * * *" />
        </el-form-item>
        <el-form-item v-if="form.executeType === 'FIXED_INTERVAL'" label="间隔秒数" prop="fixedIntervalSeconds">
          <el-input-number v-model="form.fixedIntervalSeconds" :min="10" :max="86400" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="logDrawer.visible" :title="logDrawer.title" size="760px" append-to-body>
      <el-table v-loading="logLoading" :data="logList" border>
        <el-table-column label="触发方式" prop="triggerType" width="110" align="center">
          <template #default="{ row }">{{ triggerTypeText(row.triggerType) }}</template>
        </el-table-column>
        <el-table-column label="结果" prop="status" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="runStatusType(row.status)">{{ runStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="请求/生成" width="100" align="center">
          <template #default="{ row }">{{ row.requestedCount }}/{{ row.actualCount }}</template>
        </el-table-column>
        <el-table-column label="开始时间" prop="startTime" width="180" show-overflow-tooltip />
        <el-table-column label="结束时间" prop="endTime" width="180" show-overflow-tooltip />
        <el-table-column label="失败原因" prop="failureReason" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.failureReason || '-' }}</template>
        </el-table-column>
      </el-table>
      <pagination v-show="logTotal > 0" :total="logTotal" v-model:page="logQuery.pageNum" v-model:limit="logQuery.pageSize" @pagination="getLogs" />
    </el-drawer>
  </div>
</template>

<script setup name="KmcPoolGenerationJob" lang="ts">
import { onMounted, reactive, ref, toRefs } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { listPoolStrategy } from '@/api/kmc/poolStrategy';
import type { PoolStrategyVO } from '@/api/kmc/poolStrategy/types';
import {
  addPoolGenerationJob,
  delPoolGenerationJob,
  disablePoolGenerationJob,
  enablePoolGenerationJob,
  getPoolGenerationJob,
  listPoolGenerationJob,
  listPoolGenerationJobLog,
  triggerPoolGenerationJob,
  updatePoolGenerationJob
} from '@/api/kmc/poolGenerationJob';
import type {
  PoolGenerationJobForm,
  PoolGenerationJobLogQuery,
  PoolGenerationJobLogVO,
  PoolGenerationJobQuery,
  PoolGenerationJobVO
} from '@/api/kmc/poolGenerationJob/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';

const queryFormRef = ref<FormInstance>();
const jobFormRef = ref<FormInstance>();
const loading = ref(false);
const logLoading = ref(false);
const showSearch = ref(true);
const jobList = ref<PoolGenerationJobVO[]>([]);
const strategyOptions = ref<PoolStrategyVO[]>([]);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const logList = ref<PoolGenerationJobLogVO[]>([]);
const logTotal = ref(0);

const executeTypeOptions = [
  { label: '立即执行', value: 'IMMEDIATE' },
  { label: '定时执行', value: 'CRON' },
  { label: '固定间隔', value: 'FIXED_INTERVAL' }
] as const;

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const logDrawer = reactive({
  visible: false,
  title: ''
});

const data = reactive<PageData<PoolGenerationJobForm, PoolGenerationJobQuery>>({
  form: {
    id: undefined,
    jobName: '',
    strategyId: undefined,
    executeType: 'IMMEDIATE',
    cronExpression: '',
    fixedIntervalSeconds: 300,
    status: 1
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    strategyId: undefined,
    executeType: undefined,
    status: undefined
  },
  rules: {
    jobName: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
    strategyId: [{ required: true, message: '密钥策略不能为空', trigger: 'change' }],
    executeType: [{ required: true, message: '执行策略不能为空', trigger: 'change' }],
    cronExpression: [{ required: true, message: 'Cron 表达式不能为空', trigger: 'blur' }],
    fixedIntervalSeconds: [{ required: true, message: '间隔秒数不能为空', trigger: 'blur' }],
    status: [{ required: true, message: '状态不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const logQuery = reactive<PoolGenerationJobLogQuery>({
  pageNum: 1,
  pageSize: 10,
  jobId: undefined
});

const strategyText = (strategy: PoolStrategyVO) => {
  return `${strategy.algType} / 低${strategy.lowWatermark} 高${strategy.highWatermark}`;
};

const executeTypeText = (value?: string) => executeTypeOptions.find((item) => item.value === value)?.label || value || '-';

const runStatusText = (value?: string) => {
  const map: Record<string, string> = {
    IDLE: '待运行',
    RUNNING: '运行中',
    SUCCESS: '成功',
    FAILED: '失败',
    SKIPPED: '跳过'
  };
  return map[value || ''] || value || '-';
};

const runStatusType = (value?: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    IDLE: 'info',
    RUNNING: 'warning',
    SUCCESS: 'success',
    FAILED: 'danger',
    SKIPPED: 'info'
  };
  return map[value || ''] || 'info';
};

const triggerTypeText = (value?: string) => {
  const map: Record<string, string> = {
    IMMEDIATE: '立即',
    SCHEDULE: '调度',
    MANUAL: '手动'
  };
  return map[value || ''] || value || '-';
};

const loadStrategies = async () => {
  const res = await listPoolStrategy({ pageNum: 1, pageSize: 200, status: 1 });
  strategyOptions.value = readKmcPage<PoolStrategyVO>(res).records;
};

const getList = async () => {
  loading.value = true;
  try {
    const page = readKmcPage<PoolGenerationJobVO>(await listPoolGenerationJob(queryParams.value));
    jobList.value = page.records;
    total.value = page.total;
  } finally {
    loading.value = false;
  }
};

const getLogs = async () => {
  logLoading.value = true;
  try {
    const page = readKmcPage<PoolGenerationJobLogVO>(await listPoolGenerationJobLog(logQuery));
    logList.value = page.records;
    logTotal.value = page.total;
  } finally {
    logLoading.value = false;
  }
};

const reset = () => {
  form.value = {
    id: undefined,
    jobName: '',
    strategyId: undefined,
    executeType: 'IMMEDIATE',
    cronExpression: '',
    fixedIntervalSeconds: 300,
    status: 1
  };
  jobFormRef.value?.resetFields();
};

const cancel = () => {
  dialog.visible = false;
  reset();
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleSelectionChange = (selection: PoolGenerationJobVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加备用密钥生成任务';
};

const handleUpdate = async (row?: PoolGenerationJobVO) => {
  reset();
  const id = row?.id || ids.value[0];
  const detail = unwrapKmcData<PoolGenerationJobVO>(await getPoolGenerationJob(id));
  Object.assign(form.value, detail);
  dialog.visible = true;
  dialog.title = '修改备用密钥生成任务';
};

const submitForm = () => {
  jobFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    if (form.value.executeType !== 'CRON') {
      form.value.cronExpression = '';
    }
    if (form.value.executeType !== 'FIXED_INTERVAL') {
      form.value.fixedIntervalSeconds = undefined;
    }
    if (form.value.id) {
      await updatePoolGenerationJob(form.value);
      ElMessage.success('修改成功');
    } else {
      await addPoolGenerationJob(form.value);
      ElMessage.success('新增成功');
    }
    dialog.visible = false;
    await getList();
  });
};

const handleDelete = async (row?: PoolGenerationJobVO) => {
  const jobIds = row?.id ? [row.id] : ids.value;
  await ElMessageBox.confirm('是否确认删除所选备用密钥生成任务？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  });
  await delPoolGenerationJob(jobIds);
  ElMessage.success('删除成功');
  await getList();
};

const handleStatus = async (row: PoolGenerationJobVO) => {
  if (row.status === 1) {
    await disablePoolGenerationJob(row.id);
    ElMessage.success('停用成功');
  } else {
    await enablePoolGenerationJob(row.id);
    ElMessage.success('启用成功');
  }
  await getList();
};

const handleTrigger = async (row: PoolGenerationJobVO) => {
  await triggerPoolGenerationJob(row.id);
  ElMessage.success('生成任务已提交');
  await getList();
};

const handleLogs = async (row: PoolGenerationJobVO) => {
  logQuery.pageNum = 1;
  logQuery.jobId = row.id;
  logDrawer.title = `${row.jobName} - 执行日志`;
  logDrawer.visible = true;
  await getLogs();
};

onMounted(async () => {
  await loadStrategies();
  await getList();
});
</script>

<style scoped lang="scss">
.pool-generation-job-page {
  :deep(.el-drawer__body) {
    padding-top: 8px;
  }

  :deep(.el-radio-button__inner) {
    min-width: 92px;
  }
}
</style>
