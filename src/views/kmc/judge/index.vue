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
          <el-button type="warning" plain icon="Download" v-hasPermi="['kmc:judge:export']" @click="handleExport">导出</el-button>
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
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="View" v-hasPermi="['kmc:judge:detail']" @click="handleDetail(row)">详情</el-button>
            <el-button link type="primary" icon="CircleCheck" v-hasPermi="['kmc:judge:approve']" @click="openApprove(row)">审批</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>

    <el-dialog v-model="detailDialog.visible" title="审批记录详情" width="560px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="对象类型">{{ detail.targetType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="对象ID">{{ detail.targetId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ detail.operator || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusText(detail.status) }}</el-descriptions-item>
        <el-descriptions-item label="原因">{{ detail.reason || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="approveDialog.visible" title="审批" width="520px" append-to-body>
      <el-form ref="approveFormRef" :model="approveForm" :rules="approveRules" label-width="120px">
        <el-form-item label="审批人">
          <el-input :model-value="userStore.name" disabled />
        </el-form-item>
        <el-form-item label="审批意见" prop="comment">
          <el-input v-model="approveForm.comment" type="textarea" maxlength="500" show-word-limit />
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
import { getCurrentInstance, onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { approveJudge, getJudge, listJudge } from '@/api/kmc/judge';
import type { JudgeQuery, JudgeVO } from '@/api/kmc/judge/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';
import { useUserStore } from '@/store/modules/user';

const queryFormRef = ref<FormInstance>();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const approveFormRef = ref<FormInstance>();
const userStore = useUserStore();
const loading = ref(false);
const rows = ref<JudgeVO[]>([]);
const total = ref(0);

const queryParams = reactive<JudgeQuery>({
  pageNum: 1,
  pageSize: 10
});

const detail = reactive<JudgeVO>({ id: '' });

const approveForm = reactive({
  judgeId: '',
  approverId: '',
  approverName: '',
  approverIp: '',
  approverUkeySn: '',
  comment: ''
});

const detailDialog = reactive({ visible: false });
const approveDialog = reactive({ visible: false });

const approveRules = reactive<FormRules>({});

const statusText = (status?: string) => ({ APPROVED: '通过', REJECTED: '拒绝', PENDING: '待审批' })[status || ''] || status || '-';

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

const handleExport = () => {
  proxy?.download('kmc/v1/judges/export', { ...queryParams }, `kmc_judges_${new Date().getTime()}.xlsx`);
};

const handleDetail = async (row: JudgeVO) => {
  Object.assign(detail, unwrapKmcData(await getJudge(row.id)));
  detailDialog.visible = true;
};

const openApprove = (row: JudgeVO) => {
  Object.assign(approveForm, {
    judgeId: row.id,
    approverId: userStore.userId,
    approverName: userStore.name,
    approverIp: '',
    approverUkeySn: '',
    comment: ''
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

onMounted(getList);
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
