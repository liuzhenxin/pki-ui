<template>
  <div class="p-2">
    <el-card shadow="never" class="mb-3">
      <el-form :model="queryParams" ref="queryFormRef" :inline="true">
        <el-form-item label="对象ID" prop="targetId">
          <el-input v-model="queryParams.targetId" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="对象类型" prop="targetType">
          <el-input v-model="queryParams.targetType" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" clearable style="width: 140px">
            <el-option label="待审批" value="PENDING" />
            <el-option label="通过" value="APPROVED" />
            <el-option label="拒绝" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>三员审批记录</span>
          <el-button type="primary" plain icon="Plus" v-hasPermi="['kmc:judge:save']" @click="handleAdd">新增</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="targetType" label="对象类型" width="120" />
        <el-table-column prop="targetId" label="对象ID" width="110" />
        <el-table-column prop="operator" label="操作人" width="140" />
        <el-table-column prop="operatorIp" label="终端IP" width="150" />
        <el-table-column prop="operatorUkeySn" label="UKEY SN" width="180" show-overflow-tooltip />
        <el-table-column prop="decision" label="决策" width="100" />
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="Edit" v-hasPermi="['kmc:judge:modify']" @click="handleUpdate(row)">修改</el-button>
            <el-button link type="primary" icon="CircleCheck" v-hasPermi="['kmc:judge:approve']" @click="openApprove(row)">审批</el-button>
            <el-button link type="danger" icon="Delete" v-hasPermi="['kmc:judge:remove']" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="对象ID" prop="targetId">
          <el-input v-model="form.targetId" />
        </el-form-item>
        <el-form-item label="对象类型" prop="targetType">
          <el-input v-model="form.targetType" placeholder="ARCHIVE_KEY / RECOVERY" />
        </el-form-item>
        <el-form-item label="操作人" prop="operator">
          <el-input v-model="form.operator" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status">
            <el-option label="待审批" value="PENDING" />
            <el-option label="通过" value="APPROVED" />
            <el-option label="拒绝" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="approveDialog.visible" title="审批" width="520px" append-to-body>
      <el-form ref="approveFormRef" :model="approveForm" :rules="approveRules" label-width="120px">
        <el-form-item label="决策" prop="decision">
          <el-radio-group v-model="approveForm.decision">
            <el-radio value="APPROVED">通过</el-radio>
            <el-radio value="REJECTED">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="操作人" prop="operator">
          <el-input v-model="approveForm.operator" />
        </el-form-item>
        <el-form-item label="终端IP" prop="operatorIp">
          <el-input v-model="approveForm.operatorIp" />
        </el-form-item>
        <el-form-item label="UKEY SN" prop="operatorUkeySn">
          <el-input v-model="approveForm.operatorUkeySn" />
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="approveForm.reason" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitApprove">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="KmcJudge" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { addJudge, approveJudge, delJudge, getJudge, listJudge, updateJudge } from '@/api/kmc/judge';
import type { JudgeForm, JudgeQuery, JudgeVO } from '@/api/kmc/judge/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';

const queryFormRef = ref<FormInstance>();
const formRef = ref<FormInstance>();
const approveFormRef = ref<FormInstance>();
const loading = ref(false);
const rows = ref<JudgeVO[]>([]);
const total = ref(0);

const queryParams = reactive<JudgeQuery>({
  pageNum: 1,
  pageSize: 10
});

const form = reactive<JudgeForm>({
  targetId: undefined,
  targetType: 'ARCHIVE_KEY',
  operator: '',
  status: 'PENDING',
  reason: ''
});

const approveForm = reactive({
  id: '',
  decision: 'APPROVED',
  reason: '',
  operator: '',
  operatorIp: '',
  operatorUkeySn: ''
});

const dialog = reactive({ visible: false, title: '' });
const approveDialog = reactive({ visible: false });

const rules = reactive<FormRules>({
  targetId: [{ required: true, message: '请输入对象ID', trigger: 'blur' }],
  targetType: [{ required: true, message: '请输入对象类型', trigger: 'blur' }]
});
const approveRules = reactive<FormRules>({
  decision: [{ required: true, message: '请选择决策', trigger: 'change' }],
  operator: [{ required: true, message: '请输入操作人', trigger: 'blur' }],
  operatorIp: [{ required: true, message: '请输入终端IP', trigger: 'blur' }],
  operatorUkeySn: [{ required: true, message: '请输入UKEY序列号', trigger: 'blur' }]
});

const statusText = (status?: string) => ({ APPROVED: '通过', REJECTED: '拒绝', PENDING: '待审批' }[status || ''] || status || '-');

const resetForm = () => {
  Object.assign(form, { id: undefined, targetId: undefined, targetType: 'ARCHIVE_KEY', operator: '', status: 'PENDING', reason: '' });
  formRef.value?.resetFields();
};

const getList = async () => {
  loading.value = true;
  try {
    const page = readKmcPage<JudgeVO>(await listJudge(queryParams));
    rows.value = page.records;
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

const handleAdd = () => {
  resetForm();
  dialog.title = '新增审批记录';
  dialog.visible = true;
};

const handleUpdate = async (row: JudgeVO) => {
  resetForm();
  Object.assign(form, unwrapKmcData(await getJudge(row.id)));
  dialog.title = '修改审批记录';
  dialog.visible = true;
};

const submitForm = async () => {
  if (!(await formRef.value?.validate().catch(() => false))) {
    return;
  }
  if (form.id) {
    await updateJudge(form);
  } else {
    await addJudge(form);
  }
  ElMessage.success('保存成功');
  dialog.visible = false;
  await getList();
};

const openApprove = (row: JudgeVO) => {
  Object.assign(approveForm, {
    id: row.id,
    decision: 'APPROVED',
    reason: row.reason || '',
    operator: row.operator || '',
    operatorIp: row.operatorIp || '',
    operatorUkeySn: row.operatorUkeySn || ''
  });
  approveDialog.visible = true;
};

const submitApprove = async () => {
  if (!(await approveFormRef.value?.validate().catch(() => false))) {
    return;
  }
  await approveJudge(approveForm);
  ElMessage.success('审批提交成功');
  approveDialog.visible = false;
  await getList();
};

const handleDelete = async (row: JudgeVO) => {
  await ElMessageBox.confirm('确认删除该审批记录？', '提示', { type: 'warning' });
  await delJudge(row.id);
  ElMessage.success('删除成功');
  await getList();
};

onMounted(getList);
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
