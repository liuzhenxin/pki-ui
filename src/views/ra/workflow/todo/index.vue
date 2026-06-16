<template>
  <div class="app-container ra-workflow-todo-page">
    <el-form ref="queryFormRef" v-show="showSearch" :model="queryParams" :inline="true" label-width="80px">
      <el-form-item label="业务类型" prop="businessType">
        <el-select v-model="queryParams.businessType" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="item in businessTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input v-model="queryParams.keyword" clearable placeholder="用户/部门/证书/任务" style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button icon="Refresh" @click="getList">刷新</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="taskList" border>
      <el-table-column label="任务编号" prop="id" align="center" width="160" />
      <el-table-column label="业务类型" prop="businessTypeName" min-width="120" />
      <el-table-column label="申请用户" prop="userName" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.userName || '-' }}</template>
      </el-table-column>
      <el-table-column label="所属部门" prop="deptName" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.deptName || '-' }}</template>
      </el-table-column>
      <el-table-column label="证书/申请" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">{{ row.serialNumber || row.businessKey || '-' }}</template>
      </el-table-column>
      <el-table-column label="证书模板" prop="profileName" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.profileName || '-' }}</template>
      </el-table-column>
      <el-table-column label="提交人" prop="initiatorName" min-width="120" show-overflow-tooltip />
      <el-table-column label="提交时间" prop="taskStartTime" align="center" width="170">
        <template #default="{ row }">{{ parseTime(row.taskStartTime) }}</template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="100">
        <template #default="{ row }">
          <el-tag type="warning">{{ row.taskStatusName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="170" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
          <el-tooltip content="通过" placement="top">
            <el-button link type="success" icon="CircleCheck" @click="openAudit(row, 'approve')" />
          </el-tooltip>
          <el-tooltip content="拒绝" placement="top">
            <el-button link type="danger" icon="CircleClose" @click="openAudit(row, 'reject')" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog v-model="detailOpen" title="审核任务详情" width="720px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="任务编号">{{ detail.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detail.businessTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请用户">{{ detail.userName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属部门">{{ detail.deptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ detail.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="根证书">{{ detail.rootName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书模板">{{ detail.profileName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请原因">{{ detail.reason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="CSR">{{ detail.csr || '-' }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ parseTime(detail.taskStartTime) || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="auditOpen" :title="auditMode === 'approve' ? '审核通过' : '审核拒绝'" width="520px" append-to-body>
      <el-form ref="auditFormRef" :model="auditForm" :rules="auditRules" label-width="96px">
        <el-form-item label="审批意见" prop="comment">
          <el-input
            v-model="auditForm.comment"
            type="textarea"
            :rows="4"
            :placeholder="auditMode === 'approve' ? '请输入审批意见（可选）' : '请输入拒绝原因'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditOpen = false">取消</el-button>
        <el-button :type="auditMode === 'approve' ? 'success' : 'danger'" :loading="submitLoading" @click="submitAudit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaWorkflowTodo" lang="ts">
import { approveRaWorkflowTask, getRaWorkflowTask, pageRaWorkflowTodo, rejectRaWorkflowTask, RaWorkflowTask } from '@/api/ra/workflowTask';
import { FormInstance, FormRules } from 'element-plus';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const taskList = ref<RaWorkflowTask[]>([]);
const loading = ref(false);
const submitLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const detailOpen = ref(false);
const auditOpen = ref(false);
const auditMode = ref<'approve' | 'reject'>('approve');
const currentTask = ref<RaWorkflowTask>();
const detail = ref<Partial<RaWorkflowTask>>({});

const queryFormRef = ref<FormInstance>();
const auditFormRef = ref<FormInstance>();

const businessTypeOptions = [
  { label: '证书申请', value: 'cert_apply' },
  { label: '证书续期', value: 'cert_renewal' },
  { label: '证书更新', value: 'cert_update' },
  { label: '证书吊销', value: 'cert_revoke' },
  { label: '证书补办', value: 'cert_reissue' },
  { label: '证书冻结', value: 'cert_freeze' },
  { label: '证书解冻', value: 'cert_unfreeze' }
];

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  businessType: '',
  keyword: ''
});

const auditForm = reactive({
  comment: ''
});

const auditRules = reactive<FormRules>({
  comment: [
    {
      validator: (_rule, value, callback) => {
        if (auditMode.value === 'reject' && !String(value || '').trim()) {
          callback(new Error('拒绝原因不能为空'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ]
});

function parsePage(res: any) {
  const page = res.data || res;
  return {
    rows: page.rows || page.records || [],
    total: page.total || 0
  };
}

async function getList() {
  loading.value = true;
  try {
    const res = await pageRaWorkflowTodo({
      ...queryParams,
      businessType: queryParams.businessType || undefined,
      keyword: queryParams.keyword || undefined
    });
    const page = parsePage(res);
    taskList.value = page.rows;
    total.value = page.total;
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

async function handleDetail(row: RaWorkflowTask) {
  const res = await getRaWorkflowTask(row.id);
  detail.value = res.data || row;
  detailOpen.value = true;
}

function openAudit(row: RaWorkflowTask, mode: 'approve' | 'reject') {
  currentTask.value = row;
  auditMode.value = mode;
  auditForm.comment = '';
  auditOpen.value = true;
}

async function submitAudit() {
  if (!(await auditFormRef.value?.validate().catch(() => false))) {
    return;
  }
  if (!currentTask.value) {
    return;
  }
  submitLoading.value = true;
  try {
    if (auditMode.value === 'approve') {
      await approveRaWorkflowTask(currentTask.value.id, auditForm.comment);
    } else {
      await rejectRaWorkflowTask(currentTask.value.id, auditForm.comment);
    }
    proxy?.$modal.msgSuccess('处理成功');
    auditOpen.value = false;
    await getList();
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.ra-workflow-todo-page {
  .el-table {
    width: 100%;
  }
}
</style>
