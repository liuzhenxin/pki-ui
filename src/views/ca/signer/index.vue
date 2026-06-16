<template>
  <div class="p-2 signer-page">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="签名者名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入签名者名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="签名者类型" prop="signerType">
              <el-select v-model="queryParams.signerType" placeholder="请选择签名者类型" clearable>
                <el-option v-for="item in signerTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="用途类别" prop="category">
              <el-select v-model="queryParams.category" placeholder="请选择用途类别" clearable>
                <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:signer:save']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:signer:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="signerList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column label="签名者名称" min-width="180" prop="name" :show-overflow-tooltip="true" />
        <el-table-column label="签名者类型" align="center" prop="signerType" width="120">
          <template #default="scope">
            <el-tag :type="signerTypeTag(scope.row.signerType)">{{ scope.row.signerType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用途类别" align="center" prop="category" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.category === 'ISSUER' ? 'success' : 'info'">{{ categoryLabel(scope.row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="算法" align="center" prop="algo" width="110">
          <template #default="scope">
            <el-tag effect="plain">{{ formatAlgorithm(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="证书状态" align="center" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.cert ? 'success' : 'warning'" effect="plain">{{ scope.row.cert ? '已配置' : '未配置' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ scope.row.createTime || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="190" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="查看" placement="top">
              <el-button v-hasPermi="['ca:signer:detail']" link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ca:signer:modify']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="测试" placement="top">
              <el-button v-hasPermi="['ca:signer:test']" link type="success" icon="Connection" @click="handleTestRow(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ca:signer:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-dialog class="signer-dialog" :title="title" v-model="open" width="820px" append-to-body @close="resetForm">
      <el-form ref="signerFormRef" class="signer-form" :model="form" :rules="rules" label-width="96px" :disabled="readonly">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="签名者名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入签名者名称" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="签名者类型" prop="signerType">
              <el-select v-model="form.signerType" placeholder="请选择签名者类型" style="width: 100%" @change="handleSignerTypeChange">
                <el-option v-for="item in signerTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="用途类别" prop="category">
              <el-select v-model="form.category" placeholder="请选择用途类别" style="width: 100%">
                <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="签名算法" prop="algo">
              <el-select v-model="form.algo" placeholder="请选择签名算法" style="width: 100%" @change="handleAlgorithmChange">
                <el-option v-for="item in algorithmOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="form.algo === 'RSA'" :xs="24" :sm="12">
            <el-form-item label="密钥长度" prop="keySize">
              <el-select v-model="form.keySize" placeholder="请选择密钥长度" style="width: 100%">
                <el-option v-for="item in rsaKeySizeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="form.signerType === 'SDF'" :xs="24" :sm="12">
            <el-form-item label="密钥索引" prop="keyIndex">
              <el-input-number v-model="form.keyIndex" :min="1" :precision="0" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col v-else :xs="24" :sm="12">
            <el-form-item label="密钥别名" prop="alias">
              <el-input v-model="form.alias" placeholder="请输入密钥别名" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="口令" prop="password">
              <el-input v-model="form.password" type="password" placeholder="请输入口令" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item class="cert-form-item" label="证书" prop="cert">
          <el-input v-model="form.cert" type="textarea" placeholder="请输入证书 PEM 数据" :rows="8" />
          <div class="form-tip">{{ form.signerType === 'SDF' ? 'SDF 签名者通常按密钥索引加载。' : 'PKCS12 签名者使用密钥别名定位私钥。' }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button v-hasPermi="['ca:signer:test']" icon="Connection" :loading="testLoading" @click="handleTestForm">测试</el-button>
          <el-button v-if="!readonly" type="primary" :loading="submitLoading" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="testOpen" title="签名者测试结果" width="680px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="测试结论">
          <el-tag :type="testResult?.passed ? 'success' : 'danger'">{{ testResult?.passed ? '通过' : '未通过' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="签名者类型">{{ testResult?.signerType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签名算法">{{ testResult?.algorithm || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-table class="test-checks" border :data="testResult?.checks || []">
        <el-table-column label="检查项" prop="name" width="140" />
        <el-table-column label="结果" width="90" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.passed ? 'success' : 'danger'" effect="plain">{{ scope.row.passed ? '通过' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="信息" prop="message" :show-overflow-tooltip="true" />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="testOpen = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="CaSigner" lang="ts">
import { getCurrentInstance, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { pageSigner, getSigner, saveSigner, modifySigner, removeSigner, testSigner } from '@/api/ca/signer';

const { proxy } = getCurrentInstance() as any;

const loading = ref(true);
const submitLoading = ref(false);
const testLoading = ref(false);
const showSearch = ref(true);
const ids = ref<(string | number)[]>([]);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const testOpen = ref(false);
const readonly = ref(false);
const signerList = ref<any[]>([]);
const testResult = ref<any>();

const queryFormRef = ref();
const signerFormRef = ref();

const signerTypeOptions = [
  { label: 'PKCS12', value: 'PKCS12' },
  { label: 'SDF', value: 'SDF' }
];

const categoryOptions = [{ label: '签发者', value: 'ISSUER' }];

const algorithmOptions = [
  { label: 'SM2', value: 'SM2' },
  { label: 'RSA', value: 'RSA' },
  { label: 'ECDSA', value: 'ECDSA' }
];

const rsaKeySizeOptions = [
  { label: '2048', value: 2048 },
  { label: '4096', value: 4096 }
];

const queryParams = reactive<any>({
  pageNum: 1,
  pageSize: 10,
  name: undefined,
  signerType: undefined,
  category: undefined
});

const form = ref<any>({});

const validateKeyIndex = (_rule: any, value: any, callback: any) => {
  if (form.value.signerType === 'SDF' && (!value || Number(value) < 1)) {
    callback(new Error('密钥索引不能为空'));
    return;
  }
  callback();
};

const validateKeySize = (_rule: any, value: any, callback: any) => {
  if (form.value.algo === 'RSA' && ![2048, 4096].includes(Number(value))) {
    callback(new Error('请选择密钥长度'));
    return;
  }
  callback();
};

const rules = reactive({
  name: [{ required: true, message: '签名者名称不能为空', trigger: 'blur' }],
  signerType: [{ required: true, message: '签名者类型不能为空', trigger: 'change' }],
  category: [{ required: true, message: '用途类别不能为空', trigger: 'change' }],
  algo: [{ required: true, message: '签名算法不能为空', trigger: 'change' }],
  keyIndex: [{ validator: validateKeyIndex, trigger: 'change' }],
  keySize: [{ validator: validateKeySize, trigger: 'change' }]
});

function getList() {
  loading.value = true;
  pageSigner(queryParams)
    .then((response) => {
      signerList.value = response.data?.records || [];
      total.value = response.data?.total || 0;
    })
    .finally(() => {
      loading.value = false;
    });
}

function cancel() {
  open.value = false;
  resetForm();
}

function resetForm() {
  form.value = {
    id: undefined,
    name: undefined,
    signerType: 'PKCS12',
    category: 'ISSUER',
    algo: 'SM2',
    keySize: undefined,
    keyIndex: 1,
    alias: undefined,
    password: undefined,
    cert: undefined
  };
  readonly.value = false;
  signerFormRef.value?.resetFields();
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  multiple.value = !selection.length;
}

function handleAdd() {
  resetForm();
  open.value = true;
  title.value = '添加签名者';
}

function loadSigner(row: any, viewOnly: boolean) {
  resetForm();
  const id = row.id || ids.value[0];
  getSigner(id).then((response) => {
    form.value = {
      ...form.value,
      ...response.data,
      signerType: response.data?.signerType || response.data?.type || 'PKCS12',
      category: response.data?.category || 'ISSUER',
      algo: response.data?.algo || 'SM2',
      keySize: response.data?.algo === 'RSA' ? response.data?.keySize || 2048 : undefined,
      keyIndex: response.data?.keyIndex || 1
    };
    readonly.value = viewOnly;
    open.value = true;
    title.value = viewOnly ? '查看签名者' : '修改签名者';
  });
}

function handleDetail(row: any) {
  loadSigner(row, true);
}

function handleUpdate(row: any) {
  loadSigner(row, false);
}

function handleSignerTypeChange(value: string) {
  if (value === 'SDF' && !form.value.keyIndex) {
    form.value.keyIndex = 1;
  }
}

function handleAlgorithmChange(value: string) {
  if (value === 'RSA') {
    form.value.keySize = form.value.keySize || 2048;
    return;
  }
  form.value.keySize = undefined;
}

function submitForm() {
  signerFormRef.value?.validate((valid: boolean) => {
    if (!valid) {
      return;
    }
    submitLoading.value = true;
    const action = form.value.id ? modifySigner(form.value) : saveSigner(form.value);
    action
      .then(() => {
        ElMessage.success(form.value.id ? '修改成功' : '新增成功');
        open.value = false;
        getList();
      })
      .finally(() => {
        submitLoading.value = false;
      });
  });
}

function handleTestRow(row: any) {
  runTest({ id: row.id });
}

function handleTestForm() {
  signerFormRef.value?.validate((valid: boolean) => {
    if (!valid) {
      return;
    }
    runTest(form.value.id ? { id: form.value.id } : form.value);
  });
}

function runTest(payload: any) {
  testLoading.value = true;
  testSigner(payload)
    .then((response) => {
      testResult.value = response.data;
      testOpen.value = true;
    })
    .finally(() => {
      testLoading.value = false;
    });
}

function handleDelete(row?: any) {
  const deleteIds = row?.id || ids.value;
  ElMessageBox.confirm('是否确认删除签名者编号为"' + deleteIds + '"的数据项？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      return removeSigner(Array.isArray(deleteIds) ? deleteIds : [deleteIds]);
    })
    .then(() => {
      getList();
      ElMessage.success('删除成功');
    })
    .catch(() => {});
}

function signerTypeTag(type?: string) {
  if (type === 'PKCS12') return 'primary';
  if (type === 'SDF') return 'success';
  return 'info';
}

function categoryLabel(category?: string) {
  return category === 'ISSUER' ? '签发者' : category || '-';
}

function formatAlgorithm(row: any) {
  if (row?.algo === 'RSA' && row?.keySize) {
    return `RSA-${row.keySize}`;
  }
  return row?.algo || '-';
}

getList();
</script>

<style scoped lang="scss">
.p-2 {
  padding: 8px;
}

.mb-10px {
  margin-bottom: 10px;
}

.signer-page {
  :deep(.el-form--inline .el-form-item) {
    margin-right: 14px;
  }
}

.signer-dialog {
  :deep(.el-dialog) {
    max-width: calc(100vw - 32px);
    border-radius: 8px;
  }

  :deep(.el-dialog__header) {
    padding: 18px 22px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog__body) {
    padding: 20px 22px 8px;
  }

  :deep(.el-dialog__footer) {
    padding: 14px 22px 18px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.signer-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    box-shadow: 0 0 0 1px var(--el-border-color-light) inset;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    min-height: 34px;
  }
}

.cert-form-item {
  margin-top: 2px;

  :deep(.el-textarea__inner) {
    min-height: 176px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    line-height: 1.55;
  }
}

.form-tip {
  width: 100%;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.test-checks {
  margin-top: 12px;
}

@media (max-width: 640px) {
  .signer-dialog {
    :deep(.el-dialog__body) {
      padding: 16px 16px 4px;
    }
  }

  .signer-form {
    :deep(.el-form-item) {
      margin-bottom: 16px;
    }
  }
}

.small-padding {
  .cell {
    padding: 0 5px;
  }
}

.fixed-width {
  min-width: 190px;
}
</style>
