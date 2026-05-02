<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="发布者名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入发布者名称" clearable @keyup.enter="handleQuery" />
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
            <el-button v-hasPermi="['ca:publisher:save']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:import']" type="success" plain icon="Upload" @click="handleImport">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:export']" type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()"
              >删除</el-button
            >
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="publisherList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column label="发布者名称" align="center" prop="name" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="发布者类型" align="center" prop="type" width="130">
          <template #default="scope">
            <el-tag v-if="scope.row.type === 'DATABASE'" type="primary">数据库</el-tag>
            <el-tag v-else-if="scope.row.type === 'FILE'" type="success">文件系统</el-tag>
            <el-tag v-else-if="scope.row.type === 'LDAP'" type="warning">LDAP</el-tag>
            <el-tag v-else-if="scope.row.type === 'OCSP'" type="info">OCSP</el-tag>
            <el-tag v-else type="info">{{ scope.row.type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配置" align="center" prop="conf" min-width="220" :show-overflow-tooltip="true">
          <template #default="scope">
            <el-button v-if="scope.row.conf" link type="primary" @click="handleViewConf(scope.row)">查看配置</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ scope.row.createTime || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="170" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="查看" placement="top">
              <el-button v-hasPermi="['ca:publisher:detail']" link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ca:publisher:modify']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ca:publisher:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-dialog :title="title" v-model="open" width="760px" append-to-body @close="resetForm">
      <el-form ref="publisherFormRef" :model="form" :rules="rules" label-width="110px" :disabled="readonly">
        <el-form-item label="发布者名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入发布者名称" />
        </el-form-item>
        <el-form-item label="发布者类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择发布者类型" style="width: 100%">
            <el-option label="数据库" value="DATABASE" />
            <el-option label="文件系统" value="FILE" />
            <el-option label="LDAP" value="LDAP" />
            <el-option label="OCSP" value="OCSP" />
          </el-select>
        </el-form-item>
        <el-form-item label="配置" prop="conf">
          <el-input v-model="form.conf" type="textarea" placeholder="请输入发布者配置 JSON" :rows="12" />
          <div class="form-tip">配置内容按发布者类型填写 JSON，例如路径、连接地址或发布策略参数。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button v-if="!readonly" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog title="发布者配置" v-model="confOpen" width="760px" append-to-body>
      <pre class="conf-preview">{{ currentConf }}</pre>
    </el-dialog>

    <el-dialog title="导入发布者" v-model="importOpen" width="420px" append-to-body>
      <el-upload
        ref="uploadRef"
        :limit="1"
        accept=".xlsx,.xls"
        :headers="upload.headers"
        :action="upload.url"
        :disabled="upload.isUploading"
        :on-progress="handleFileUploadProgress"
        :on-success="handleFileSuccess"
        :auto-upload="false"
        drag
      >
        <el-icon class="el-icon--upload">
          <upload-filled />
        </el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip text-center">请上传 .xls, .xlsx 格式文件</div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitFileForm">确 定</el-button>
          <el-button @click="importOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="CaPublisher" lang="ts">
import { getCurrentInstance, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadInstance } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { pagePublisher, getPublisher, savePublisher, modifyPublisher, removePublisher, exportPublisher } from '@/api/ca/publisher';
import { PublisherForm, PublisherQuery } from '@/api/ca/publisher/types';

const { proxy } = getCurrentInstance() as any;

const loading = ref(true);
const showSearch = ref(true);
const ids = ref<(string | number)[]>([]);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const readonly = ref(false);
const importOpen = ref(false);
const confOpen = ref(false);
const publisherList = ref<any[]>([]);
const currentConf = ref('');

const queryFormRef = ref();
const publisherFormRef = ref();
const uploadRef = ref<UploadInstance>();

const queryParams = reactive<PublisherQuery>({
  pageNum: 1,
  pageSize: 10,
  name: undefined
});

const form = ref<PublisherForm>({});

const rules = reactive({
  name: [{ required: true, message: '发布者名称不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '发布者类型不能为空', trigger: 'change' }],
  conf: [{ required: true, message: '发布者配置不能为空', trigger: 'blur' }]
});

const upload = reactive({
  isUploading: false,
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
  url: import.meta.env.VITE_APP_BASE_API + '/ca/v1/publishers/import'
});

function getList() {
  loading.value = true;
  pagePublisher(queryParams)
    .then((response) => {
      publisherList.value = response.data.records || response.data.rows || [];
      total.value = response.data.total || 0;
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
  readonly.value = false;
  form.value = {
    id: undefined,
    name: undefined,
    type: undefined,
    conf: undefined
  };
  publisherFormRef.value?.resetFields();
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
  title.value = '新增发布者';
}

function handleDetail(row: any) {
  resetForm();
  getPublisher(row.id).then((response) => {
    form.value = response.data;
    readonly.value = true;
    open.value = true;
    title.value = '查看发布者';
  });
}

function handleUpdate(row: any) {
  resetForm();
  const id = row.id || ids.value[0];
  getPublisher(id).then((response) => {
    form.value = response.data;
    open.value = true;
    title.value = '修改发布者';
  });
}

function submitForm() {
  publisherFormRef.value?.validate((valid: boolean) => {
    if (!valid) {
      return;
    }
    const commandData = { co: form.value };
    const request = form.value.id ? modifyPublisher(commandData) : savePublisher(commandData);
    request.then(() => {
      ElMessage.success(form.value.id ? '修改成功' : '新增成功');
      open.value = false;
      getList();
    });
  });
}

function handleDelete(row?: any) {
  const deleteIds = row?.id || ids.value;
  ElMessageBox.confirm('是否确认删除发布者编号为"' + deleteIds + '"的数据项？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => removePublisher(Array.isArray(deleteIds) ? deleteIds : [deleteIds]))
    .then(() => {
      getList();
      ElMessage.success('删除成功');
    })
    .catch(() => {});
}

function handleImport() {
  importOpen.value = true;
}

function handleExport() {
  ElMessageBox.confirm('是否确认导出发布者数据项?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => exportPublisher(queryParams))
    .then((response) => {
      proxy.download(response, 'publisher_' + new Date().getTime() + '.xlsx');
    })
    .catch(() => {});
}

function handleFileUploadProgress() {
  upload.isUploading = true;
}

function handleFileSuccess() {
  upload.isUploading = false;
  uploadRef.value?.clearFiles();
  ElMessage.success('导入成功');
  importOpen.value = false;
  getList();
}

function submitFileForm() {
  uploadRef.value?.submit();
}

function handleViewConf(row: any) {
  try {
    currentConf.value = JSON.stringify(JSON.parse(row.conf), null, 2);
  } catch {
    currentConf.value = row.conf || '';
  }
  confOpen.value = true;
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

.small-padding {
  .cell {
    padding: 0 5px;
  }
}

.fixed-width {
  min-width: 170px;
}

.form-tip {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.conf-preview {
  max-height: 520px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
