<template>
  <div class="p-2 cert-operation-page">
    <el-card shadow="hover">
      <template #header>
        <div class="page-header">
          <div>
            <div class="title">{{ title }}</div>
            <div class="subtitle">{{ subtitle }}</div>
          </div>
          <el-button type="primary" :icon="buttonIcon" @click="handleSubmit">提交{{ actionName }}申请</el-button>
        </div>
      </template>

      <el-form :model="queryParams" class="query-form" inline>
        <el-form-item label="证书序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="请输入证书序列号" />
        </el-form-item>
        <el-form-item label="主体名称">
          <el-input v-model="queryParams.subject" clearable placeholder="请输入主体名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" clearable placeholder="请选择状态" style="width: 160px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">查询</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table ref="tableRef" v-loading="loading" :data="rows" border height="420" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column prop="serialNumber" label="证书序列号" min-width="180" show-overflow-tooltip />
        <el-table-column prop="subject" label="主体名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="profileName" label="证书模板" min-width="150" show-overflow-tooltip />
        <el-table-column prop="notAfter" label="到期时间" width="170" />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.statusType">{{ row.statusName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="action === 'renewal'" label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="Timer" @click="handleSingleRenewal(row)">续签</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

      <el-drawer v-model="drawerOpen" :title="`${actionName}申请`" size="520px" append-to-body>
        <el-form :model="form" label-width="96px">
          <el-form-item label="已选证书">
            <el-input :model-value="selectedRows.length ? `${selectedRows.length} 张` : '未选择'" disabled />
          </el-form-item>
          <el-alert
            v-if="action === 'update'"
            class="mb-3"
            type="warning"
            show-icon
            :closable="false"
            title="换密钥更新：签发时采集新 CSR，生成新序列号，旧证书将按 superseded 吊销。若所选为双证书任一侧，将同时更新签名与加密证书。"
          />
          <el-form-item :label="action === 'renewal' ? '申请原因（选填）' : '申请原因'">
            <el-input
              v-model="form.reason"
              type="textarea"
              :rows="4"
              :placeholder="action === 'renewal' ? '可填写续期原因' : `请输入${actionName}原因`"
            />
          </el-form-item>
          <template v-if="action === 'renewal' || action === 'update'">
            <el-form-item label="新生效时间">
              <el-date-picker
                v-model="form.notBefore"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="默认保持原生效时间"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item :label="action === 'update' ? '新失效时间' : '新失效时间'" :required="action === 'renewal'">
              <el-date-picker
                v-model="form.notAfter"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="action === 'update' ? '可选，默认保持原失效时间' : '请选择续期后的失效时间'"
                style="width: 100%"
              />
            </el-form-item>
          </template>
          <el-form-item v-if="action === 'reissue'" label="CSR">
            <el-input v-model="form.csr" type="textarea" :rows="5" placeholder="请输入补办证书使用的 CSR" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="drawerOpen = false">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="confirmSubmit">确认提交</el-button>
        </template>
      </el-drawer>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { pageRaOperationCert, submitRaOperation, RaOperationCert } from '@/api/ra/workflowTask';

type OperationAction = 'reissue' | 'freeze' | 'unfreeze' | 'renewal' | 'update';

const props = defineProps<{
  action: OperationAction;
}>();

const actionMeta = {
  reissue: {
    title: '证书补办',
    subtitle: '为已签发证书提交补办申请，补办申请进入证书业务审核流程。',
    icon: 'Key',
    statusOptions: [
      { label: '有效', value: 'valid' },
      { label: '即将到期', value: 'expiring' }
    ]
  },
  renewal: {
    title: '证书续期',
    subtitle: '保留原证书密钥、主体、扩展和序列号，仅更新证书有效期。',
    icon: 'Timer',
    statusOptions: [
      { label: '有效', value: 'valid' },
      { label: '已过期', value: 'expired' }
    ]
  },
  update: {
    title: '证书更新',
    subtitle: '换密钥，不是续期：签发新 CSR、新序列号，旧证书 superseded 吊销。',
    icon: 'Refresh',
    statusOptions: [
      { label: '有效', value: 'valid' },
      { label: '已过期', value: 'expired' }
    ]
  },
  freeze: {
    title: '证书冻结',
    subtitle: '对异常、争议或临时停用的证书提交冻结申请。',
    icon: 'Lock',
    statusOptions: [
      { label: '有效', value: 'valid' },
      { label: '即将到期', value: 'expiring' }
    ]
  },
  unfreeze: {
    title: '证书解冻',
    subtitle: '对已冻结证书提交恢复使用申请。',
    icon: 'Unlock',
    statusOptions: [{ label: '已冻结', value: 'frozen' }]
  }
};

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  serialNumber: '',
  subject: '',
  status: ''
});

const form = reactive({
  reason: '',
  csr: '',
  notBefore: '',
  notAfter: ''
});

const drawerOpen = ref(false);
const loading = ref(false);
const submitLoading = ref(false);
const tableRef = ref();
const total = ref(0);
const rows = ref<Array<RaOperationCert & { status?: string; statusType?: string }>>([]);
const selectedRows = ref<Array<RaOperationCert & { status?: string; statusType?: string }>>([]);
const action = computed(() => props.action);
const meta = computed(() => actionMeta[action.value]);
const title = computed(() => meta.value.title);
const subtitle = computed(() => meta.value.subtitle);
const actionName = computed(() => title.value.replace('证书', ''));
const buttonIcon = computed(() => meta.value.icon);
const statusOptions = computed(() => meta.value.statusOptions);
const operationType = computed(() => `cert_${action.value}`);

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
    const res = await pageRaOperationCert({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      operationType: operationType.value,
      serialNumber: queryParams.serialNumber || undefined,
      subject: queryParams.subject || undefined
    });
    const page = parsePage(res);
    rows.value = page.rows.map((item: RaOperationCert) => ({
      ...item,
      status: item.statusName,
      statusType: item.statusName === '已吊销' ? 'danger' : item.statusName === '已冻结' ? 'info' : 'success'
    }));
    total.value = page.total;
  } finally {
    loading.value = false;
  }
}

function handleSelectionChange(selection: Array<RaOperationCert & { status?: string; statusType?: string }>) {
  selectedRows.value = selection;
}

function handleQuery() {
  queryParams.pageNum = 1;
  selectedRows.value = [];
  getList();
}

function resetQuery() {
  queryParams.pageNum = 1;
  queryParams.serialNumber = '';
  queryParams.subject = '';
  queryParams.status = '';
  handleQuery();
}

function handleSubmit() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请选择需要操作的证书');
    return;
  }
  form.reason = '';
  form.csr = '';
  form.notBefore = '';
  form.notAfter = '';
  drawerOpen.value = true;
}

function handleSingleRenewal(row: RaOperationCert & { status?: string; statusType?: string }) {
  tableRef.value?.clearSelection();
  tableRef.value?.toggleRowSelection(row, true);
  form.reason = '';
  form.csr = '';
  form.notBefore = '';
  form.notAfter = '';
  drawerOpen.value = true;
}

async function confirmSubmit() {
  if (action.value !== 'renewal' && !form.reason.trim()) {
    ElMessage.warning(`请输入${actionName.value}原因`);
    return;
  }
  if (action.value === 'renewal' && !form.notAfter) {
    ElMessage.warning('请选择续期后的失效时间');
    return;
  }
  if (
    action.value === 'renewal' &&
    selectedRows.value.some((row) => row.notAfter && new Date(form.notAfter).getTime() <= new Date(row.notAfter).getTime())
  ) {
    ElMessage.warning('续期后的失效时间必须晚于原证书失效时间');
    return;
  }
  submitLoading.value = true;
  try {
    await Promise.all(
      selectedRows.value.map((row) =>
        submitRaOperation({
          operationType: operationType.value,
          certId: row.id,
          reason: form.reason,
          csr: form.csr,
          notBefore: form.notBefore || undefined,
          notAfter: form.notAfter || undefined
        })
      )
    );
    drawerOpen.value = false;
    selectedRows.value = [];
    ElMessage.success(`${title.value}申请已提交`);
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
.cert-operation-page {
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .title {
    color: #1f2937;
    font-size: 18px;
    font-weight: 600;
    line-height: 28px;
  }

  .subtitle {
    margin-top: 4px;
    color: #64748b;
    font-size: 13px;
    line-height: 20px;
  }

  .query-form {
    margin-bottom: 12px;
  }
}
</style>
