<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>通知管理</span>
          <el-button v-hasPermi="['ra:notification']" icon="Refresh" @click="getList">刷新</el-button>
        </div>
      </template>

      <el-form ref="queryFormRef" :model="queryParams" inline class="query-form">
        <el-form-item label="通知标题" prop="title">
          <el-input v-model="queryParams.title" clearable placeholder="请输入通知标题" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="通知类型" prop="notificationType">
          <el-select v-model="queryParams.notificationType" clearable placeholder="全部" style="width: 130px">
            <el-option v-for="item in notificationTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="发送状态" prop="sendStatus">
          <el-select v-model="queryParams.sendStatus" clearable placeholder="全部" style="width: 130px">
            <el-option v-for="item in sendStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="阅读状态" prop="isRead">
          <el-select v-model="queryParams.isRead" clearable placeholder="全部" style="width: 130px">
            <el-option label="未读" :value="0" />
            <el-option label="已读" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-select v-model="queryParams.priority" clearable placeholder="全部" style="width: 120px">
            <el-option v-for="item in priorityOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务类型" prop="businessType">
          <el-input v-model="queryParams.businessType" clearable placeholder="请输入业务类型" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="notificationList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column label="通知标题" prop="title" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" width="100" align="center">
          <template #default="{ row }">{{ notificationTypeText(row.notificationType) }}</template>
        </el-table-column>
        <el-table-column label="接收人" width="110" align="center">
          <template #default="{ row }">{{ row.recipientId || '-' }}</template>
        </el-table-column>
        <el-table-column label="发送状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="sendStatusTag(row.sendStatus)" effect="light">{{ sendStatusText(row.sendStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="阅读状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isRead === 1 ? 'success' : 'warning'" effect="light">{{ row.isRead === 1 ? '已读' : '未读' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="priorityTag(row.priority)" effect="light">{{ priorityText(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="业务类型" prop="businessType" width="130" show-overflow-tooltip />
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="发送时间" prop="sendTime" width="170" />
        <el-table-column label="操作" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button v-hasPermi="['ra:notification']" link type="primary" icon="View" @click="handleDetail(row)" />
            </el-tooltip>
            <el-tooltip content="标记已读" placement="top">
              <el-button v-hasPermi="['ra:notification']" link type="primary" icon="Check" :disabled="row.isRead === 1" @click="handleRead(row)" />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ra:notification']" link type="danger" icon="Delete" @click="handleDelete(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-button v-hasPermi="['ra:notification']" :disabled="multiple" type="danger" plain icon="Delete" @click="handleDelete()">删除</el-button>
        <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
      </div>
    </el-card>

    <el-dialog v-model="detail.visible" title="通知详情" width="760px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="通知标题" :span="2">{{ detail.data?.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通知类型">{{ notificationTypeText(detail.data?.notificationType) }}</el-descriptions-item>
        <el-descriptions-item label="优先级">{{ priorityText(detail.data?.priority) }}</el-descriptions-item>
        <el-descriptions-item label="发送状态">{{ sendStatusText(detail.data?.sendStatus) }}</el-descriptions-item>
        <el-descriptions-item label="阅读状态">{{ detail.data?.isRead === 1 ? '已读' : '未读' }}</el-descriptions-item>
        <el-descriptions-item label="接收人ID">{{ detail.data?.recipientId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detail.data?.businessType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务ID">{{ detail.data?.businessId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="重试次数">{{ detail.data?.retryCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.data?.createTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发送时间">{{ detail.data?.sendTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="阅读时间">{{ detail.data?.readTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.data?.recipientEmail || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detail.data?.recipientPhone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通知内容" :span="2">{{ detail.data?.content || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2">{{ detail.data?.errorMessage || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup name="RaNotification" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, reactive, ref } from 'vue';
import { ElMessage, FormInstance } from 'element-plus';
import { to } from 'await-to-js';
import { getRaNotification, pageRaNotification, readRaNotification, removeRaNotification } from '@/api/ra/notification';
import type { RaNotification } from '@/api/ra/notification';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const notificationTypeOptions = [
  { label: '站内信', value: 'inapp' },
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
  { label: 'Webhook', value: 'webhook' }
];
const sendStatusOptions = [
  { label: '待发送', value: 0 },
  { label: '发送成功', value: 1 },
  { label: '发送失败', value: 2 }
];
const priorityOptions = [
  { label: '普通', value: 0 },
  { label: '重要', value: 1 },
  { label: '紧急', value: 2 }
];

const loading = ref(false);
const total = ref(0);
const notificationList = ref<RaNotification[]>([]);
const ids = ref<Array<number | string>>([]);
const multiple = ref(true);
const queryFormRef = ref<FormInstance>();
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  title: '',
  notificationType: '',
  sendStatus: '' as number | string,
  isRead: '' as number | string,
  priority: '' as number | string,
  businessType: ''
});
const detail = reactive({ visible: false, data: undefined as RaNotification | undefined });
const unwrap = (response: any) => response?.data ?? response;

async function getList() {
  loading.value = true;
  try {
    const response = await pageRaNotification(queryParams);
    const data = unwrap(response) || {};
    notificationList.value = data.records || data.rows || [];
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

function handleSelectionChange(selection: RaNotification[]) {
  ids.value = selection.map((item) => item.id!).filter(Boolean);
  multiple.value = ids.value.length === 0;
}

async function handleDetail(row: RaNotification) {
  const response = await getRaNotification(row.id!);
  detail.data = unwrap(response);
  detail.visible = true;
}

async function handleRead(row: RaNotification) {
  if (!row.id || row.isRead === 1) return;
  await readRaNotification(row.id);
  ElMessage.success('已标记为已读');
  await getList();
}

async function handleDelete(row?: RaNotification) {
  const deleteIds = row?.id ? [row.id] : ids.value;
  if (!deleteIds.length) {
    ElMessage.warning('请选择要删除的通知');
    return;
  }
  const [err] = await to(proxy?.$modal.confirm('是否确认删除选中的通知？') as any);
  if (!err) {
    await removeRaNotification(deleteIds);
    ElMessage.success('删除成功');
    await getList();
  }
}

function notificationTypeText(value?: string) {
  return notificationTypeOptions.find((item) => item.value === value)?.label || value || '-';
}

function sendStatusText(value?: number) {
  return sendStatusOptions.find((item) => item.value === value)?.label || '-';
}

function sendStatusTag(value?: number) {
  return value === 1 ? 'success' : value === 2 ? 'danger' : 'info';
}

function priorityText(value?: number) {
  return priorityOptions.find((item) => item.value === value)?.label || '-';
}

function priorityTag(value?: number) {
  return value === 2 ? 'danger' : value === 1 ? 'warning' : 'info';
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
}
</style>
