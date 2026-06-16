<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>告警历史</span>
          <el-button v-hasPermi="['ra:alert:history']" icon="Refresh" @click="getList">刷新</el-button>
        </div>
      </template>

      <el-form ref="queryFormRef" :model="queryParams" inline class="query-form">
        <el-form-item label="告警类型" prop="alertType">
          <el-select v-model="queryParams.alertType" clearable placeholder="全部" style="width: 150px">
            <el-option v-for="item in alertTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="级别" prop="alertLevel">
          <el-select v-model="queryParams.alertLevel" clearable placeholder="全部" style="width: 120px">
            <el-option v-for="item in alertLevelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理状态" prop="handleStatus">
          <el-select v-model="queryParams.handleStatus" clearable placeholder="全部" style="width: 130px">
            <el-option v-for="item in handleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="解决状态" prop="isResolved">
          <el-select v-model="queryParams.isResolved" clearable placeholder="全部" style="width: 120px">
            <el-option label="未解决" :value="0" />
            <el-option label="已解决" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="historyList" border>
        <el-table-column label="规则名称" prop="ruleName" min-width="170" show-overflow-tooltip />
        <el-table-column label="告警类型" width="140">
          <template #default="{ row }">{{ alertTypeText(row.alertType) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="alertLevelTag(row.alertLevel)" effect="light">{{ alertLevelText(row.alertLevel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="触发值" prop="triggerValue" width="110" align="center" />
        <el-table-column label="告警消息" prop="alertMessage" min-width="260" show-overflow-tooltip />
        <el-table-column label="处理状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="handleStatusTag(row.handleStatus)" effect="light">{{ handleStatusText(row.handleStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="解决" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isResolved === 1 ? 'success' : 'warning'" effect="light">{{ row.isResolved === 1 ? '已解决' : '未解决' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="触发时间" prop="triggerTime" width="170" />
        <el-table-column label="操作" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button v-hasPermi="['ra:alert:history']" link type="primary" icon="View" @click="handleDetail(row)" />
            </el-tooltip>
            <el-tooltip content="处理" placement="top">
              <el-button v-hasPermi="['ra:alert:history']" link type="primary" icon="Edit" @click="handleOpenHandle(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
      </div>
    </el-card>

    <el-dialog v-model="detail.visible" title="告警详情" width="760px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="规则名称">{{ detail.data?.ruleName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="告警类型">{{ alertTypeText(detail.data?.alertType) }}</el-descriptions-item>
        <el-descriptions-item label="告警级别">{{ alertLevelText(detail.data?.alertLevel) }}</el-descriptions-item>
        <el-descriptions-item label="触发值">{{ detail.data?.triggerValue || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detail.data?.businessType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务ID">{{ detail.data?.businessId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理状态">{{ handleStatusText(detail.data?.handleStatus) }}</el-descriptions-item>
        <el-descriptions-item label="是否解决">{{ detail.data?.isResolved === 1 ? '已解决' : '未解决' }}</el-descriptions-item>
        <el-descriptions-item label="处理人">{{ detail.data?.handlerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理时间">{{ detail.data?.handleTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="告警消息" :span="2">{{ detail.data?.alertMessage || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理意见" :span="2">{{ detail.data?.handleComment || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="handleDialog.visible" title="处理告警" width="520px" append-to-body>
      <el-form :model="handleForm" label-width="90px">
        <el-form-item label="处理状态">
          <el-select v-model="handleForm.handleStatus" style="width: 100%">
            <el-option label="处理中" :value="1" />
            <el-option label="已处理" :value="2" />
            <el-option label="已忽略" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否解决">
          <el-switch v-model="handleForm.isResolved" :active-value="1" :inactive-value="0" active-text="已解决" inactive-text="未解决" />
        </el-form-item>
        <el-form-item label="处理意见">
          <el-input v-model="handleForm.handleComment" type="textarea" :rows="4" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitHandle">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaAlertHistory" lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, FormInstance } from 'element-plus';
import { getRaAlertHistory, handleRaAlertHistory, pageRaAlertHistory } from '@/api/ra/alert';
import type { RaAlertHistory } from '@/api/ra/alert';

const alertTypeOptions = [
  { label: '证书过期预警', value: 'cert_expire' },
  { label: '待审批积压', value: 'pending_approval' }
];
const alertLevelOptions = [
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
  { label: '严重', value: 'critical' }
];
const handleStatusOptions = [
  { label: '待处理', value: 0 },
  { label: '处理中', value: 1 },
  { label: '已处理', value: 2 },
  { label: '已忽略', value: 3 }
];

const loading = ref(false);
const submitting = ref(false);
const total = ref(0);
const historyList = ref<RaAlertHistory[]>([]);
const queryFormRef = ref<FormInstance>();
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  alertType: '',
  alertLevel: '',
  handleStatus: '' as number | string,
  isResolved: '' as number | string
});
const detail = reactive({ visible: false, data: undefined as RaAlertHistory | undefined });
const handleDialog = reactive({ visible: false, data: undefined as RaAlertHistory | undefined });
const handleForm = reactive({ handleStatus: 2, isResolved: 1, handleComment: '' });
const unwrap = (response: any) => response?.data ?? response;

async function getList() {
  loading.value = true;
  try {
    const response = await pageRaAlertHistory(queryParams);
    const data = unwrap(response) || {};
    historyList.value = data.records || data.rows || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

async function handleDetail(row: RaAlertHistory) {
  const response = await getRaAlertHistory(row.id!);
  detail.data = unwrap(response);
  detail.visible = true;
}

function handleOpenHandle(row: RaAlertHistory) {
  handleDialog.data = row;
  handleForm.handleStatus = row.handleStatus && row.handleStatus !== 0 ? row.handleStatus : 2;
  handleForm.isResolved = row.isResolved === 1 || handleForm.handleStatus === 2 ? 1 : 0;
  handleForm.handleComment = row.handleComment || '';
  handleDialog.visible = true;
}

async function submitHandle() {
  if (!handleDialog.data?.id) return;
  submitting.value = true;
  try {
    await handleRaAlertHistory(handleDialog.data.id, { ...handleForm });
    ElMessage.success('处理成功');
    handleDialog.visible = false;
    await getList();
  } finally {
    submitting.value = false;
  }
}

function alertTypeText(value?: string) {
  return alertTypeOptions.find((item) => item.value === value)?.label || value || '-';
}

function alertLevelText(value?: string) {
  return alertLevelOptions.find((item) => item.value === value)?.label || value || '-';
}

function alertLevelTag(value?: string) {
  return value === 'critical' || value === 'error' ? 'danger' : value === 'warning' ? 'warning' : 'info';
}

function handleStatusText(value?: number) {
  return handleStatusOptions.find((item) => item.value === value)?.label || '待处理';
}

function handleStatusTag(value?: number) {
  return value === 2 ? 'success' : value === 3 ? 'info' : value === 1 ? 'primary' : 'warning';
}

getList();
</script>

<style scoped lang="scss">
.card-header,
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.query-form {
  margin-bottom: 12px;
}

.table-footer {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
