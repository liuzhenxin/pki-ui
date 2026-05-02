<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="签名者名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入签名者名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="签名者类型" prop="signerType">
              <el-select v-model="queryParams.signerType" placeholder="签名者类型" clearable>
                <el-option label="PKCS12" value="PKCS12" />
                <el-option label="SDF" value="SDF" />
              </el-select>
            </el-form-item>
            <el-form-item label="用途类别" prop="category">
              <el-select v-model="queryParams.category" placeholder="用途类别" clearable>
                <el-option label="签发者" value="ISSUER" />
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
            <el-button v-hasPermi="['ca:signer:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()"
              >删除</el-button
            >
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="signerList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column label="签名者名称" align="center" prop="name" :show-overflow-tooltip="true" />
        <el-table-column label="签名者类型" align="center" prop="signerType" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.signerType === 'PKCS12'" type="primary">PKCS12</el-tag>
            <el-tag v-else-if="scope.row.signerType === 'SDF'" type="success">SDF</el-tag>
            <el-tag v-else type="info">{{ scope.row.signerType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用途类别" align="center" prop="category" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.category === 'ISSUER'" type="success">签发者</el-tag>
            <el-tag v-else type="info">{{ scope.row.category || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="算法" align="center" prop="algo" width="120" />
        <el-table-column label="密钥索引" align="center" prop="keyIndex" width="120">
          <template #default="scope">
            <span>{{ scope.row.keyIndex || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="别名" align="center" prop="alias" :show-overflow-tooltip="true">
          <template #default="scope">
            <span>{{ scope.row.alias || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ scope.row.createTime || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="160" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="查看" placement="top">
              <el-button v-hasPermi="['ca:signer:detail']" link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ca:signer:modify']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ca:signer:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-dialog :title="title" v-model="open" width="700px" append-to-body @close="resetForm">
      <el-form ref="signerFormRef" :model="form" :rules="rules" label-width="110px" :disabled="readonly">
        <el-form-item label="签名者名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入签名者名称" />
        </el-form-item>
        <el-form-item label="签名者类型" prop="signerType">
          <el-select v-model="form.signerType" placeholder="请选择签名者类型" style="width: 100%">
            <el-option label="PKCS12" value="PKCS12" />
            <el-option label="SDF" value="SDF" />
          </el-select>
        </el-form-item>
        <el-form-item label="用途类别" prop="category">
          <el-select v-model="form.category" placeholder="请选择用途类别" style="width: 100%">
            <el-option label="签发者" value="ISSUER" />
          </el-select>
        </el-form-item>
        <el-form-item label="签名算法" prop="algo">
          <el-select v-model="form.algo" placeholder="请选择签名算法" style="width: 100%">
            <el-option label="SM2" value="SM2" />
            <el-option label="RSA" value="RSA" />
            <el-option label="ECDSA" value="ECDSA" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.signerType === 'SDF'" label="密钥索引" prop="keyIndex">
          <el-input-number v-model="form.keyIndex" :min="1" :precision="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="别名" prop="alias">
          <el-input v-model="form.alias" placeholder="请输入密钥别名" />
        </el-form-item>
        <el-form-item label="口令" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入口令" show-password />
        </el-form-item>
        <el-form-item label="证书" prop="cert">
          <el-input v-model="form.cert" type="textarea" placeholder="请输入证书PEM数据" :rows="8" />
          <div class="form-tip">PKCS12 可填写证书 PEM 数据；SDF 签名者通常按密钥索引加载。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button v-if="!readonly" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="CaSigner" lang="ts">
import { getCurrentInstance, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { pageSigner, getSigner, saveSigner, modifySigner, removeSigner } from '@/api/ca/signer';

const { proxy } = getCurrentInstance() as any;

const loading = ref(true);
const showSearch = ref(true);
const ids = ref<(string | number)[]>([]);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const readonly = ref(false);
const signerList = ref<any[]>([]);

const queryFormRef = ref();
const signerFormRef = ref();

const queryParams = reactive<any>({
  pageNum: 1,
  pageSize: 10,
  name: undefined,
  signerType: undefined,
  category: undefined
});

const form = ref<any>({});

const rules = reactive({
  name: [{ required: true, message: '签名者名称不能为空', trigger: 'blur' }],
  signerType: [{ required: true, message: '签名者类型不能为空', trigger: 'change' }],
  category: [{ required: true, message: '用途类别不能为空', trigger: 'change' }],
  algo: [{ required: true, message: '签名算法不能为空', trigger: 'change' }]
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

function submitForm() {
  signerFormRef.value?.validate((valid: boolean) => {
    if (!valid) {
      return;
    }

    const action = form.value.id ? modifySigner(form.value) : saveSigner(form.value);
    action.then(() => {
      ElMessage.success(form.value.id ? '修改成功' : '新增成功');
      open.value = false;
      getList();
    });
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

getList();
</script>

<style scoped lang="scss">
.p-2 {
  padding: 8px;
}

.mb-10px {
  margin-bottom: 10px;
}

.form-tip {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.small-padding {
  .cell {
    padding: 0 5px;
  }
}

.fixed-width {
  min-width: 160px;
}
</style>
