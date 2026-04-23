<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="请求者名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入请求者名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="请求者类型" prop="type">
              <el-select v-model="queryParams.type" placeholder="请求者类型" clearable>
                <el-option label="API" value="API" />
                <el-option label="CMP" value="CMP" />
                <el-option label="ACME" value="ACME" />
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
            <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Upload" @click="handleImport">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="requestorList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column label="请求者名称" align="center" prop="name" :show-overflow-tooltip="true" />
        <el-table-column label="请求者类型" align="center" prop="type" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.type === 'API'" type="primary">API</el-tag>
            <el-tag v-else-if="scope.row.type === 'CMP'" type="success">CMP</el-tag>
            <el-tag v-else-if="scope.row.type === 'ACME'" type="warning">ACME</el-tag>
            <el-tag v-else type="info">{{ scope.row.type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="证书" align="center" prop="conf" width="100">
          <template #default="scope">
            <el-button v-if="scope.row.conf" link type="success" @click="handleViewCert(scope.row)">
              <el-icon :size="20"><Document /></el-icon>
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ scope.row.createTime }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="160" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <!-- 添加/修改对话框 -->
    <el-dialog :title="title" v-model="open" width="700px" append-to-body @close="resetForm">
      <el-form ref="requestorFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="请求者名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入请求者名称" />
        </el-form-item>
        <el-form-item label="请求者类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择请求者类型" style="width: 100%">
            <el-option label="API" value="API" />
            <el-option label="CMP" value="CMP" />
            <el-option label="ACME" value="ACME" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书" prop="conf">
          <el-input v-model="form.conf" type="textarea" placeholder="请输入证书PEM数据" :rows="12" />
          <div class="text-xs text-gray-500 mt-1">证书的PEM编码数据</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 查看证书对话框 -->
    <el-dialog title="查看证书" v-model="certOpen" width="900px" append-to-body>
      <X509Cert v-if="currentCert" :certPem="currentCert" />
      <el-empty v-else description="暂无证书信息" />
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog title="导入请求者" v-model="importOpen" width="400px" append-to-body>
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
          <div class="el-upload__tip text-center">
            <div class="el-upload__tip">请上传 .xls, .xlsx 格式文件</div>
          </div>
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

<script setup name="CaRequestor" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import { ElMessage, ElMessageBox, type UploadInstance, type UploadProgressEvent, type UploadRawFile } from 'element-plus';
import { Search, Refresh, Plus, Upload, Download, Edit, Delete, UploadFilled, Document } from '@element-plus/icons-vue';
import { list as listProfile } from '@/api/ca/profile';
import { pageRequestor, getRequestor, saveRequestor, modifyRequestor, removeRequestor, importRequestor, exportRequestor } from '@/api/ca/requestor';
import { RequestorForm, RequestorQuery } from '@/api/ca/requestor/types';
import X509Cert from '@/components/X509Cert/index.vue';

const { proxy } = getCurrentInstance() as any;

// 数据定义
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<(string | number)[]>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const importOpen = ref(false);
const certOpen = ref(false);
const requestorList = ref<any[]>([]);
const currentCert = ref<string>('');

const queryFormRef = ref();
const requestorFormRef = ref();
const uploadRef = ref<UploadInstance>();

// 查询参数
const queryParams = reactive<RequestorQuery>({
  pageNum: 1,
  pageSize: 10,
  name: undefined,
  type: undefined
});

// 表单参数
const form = ref<RequestorForm>({});

// 表单校验
const rules = reactive({
  name: [{ required: true, message: '请求者名称不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '请求者类型不能为空', trigger: 'change' }]
});

// 上传参数
const upload = reactive({
  // 是否禁用上传
  isUploading: false,
  // 设置上传的请求头部
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
  // 上传的地址
  url: import.meta.env.VITE_APP_BASE_API + '/ca/v1/requestors/import'
});

/** 查询请求者列表 */
function getList() {
  loading.value = true;
  pageRequestor(queryParams)
    .then((response) => {
      requestorList.value = response.data.records || [];
      total.value = response.data.total || 0;
    })
    .finally(() => {
      loading.value = false;
    });
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  resetForm();
}

/** 表单重置 */
function resetForm() {
  form.value = {
    id: undefined,
    name: undefined,
    type: undefined,
    conf: undefined
  };
  requestorFormRef.value?.resetFields();
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
function handleAdd() {
  resetForm();
  open.value = true;
  title.value = '添加请求者';
}

/** 修改按钮操作 */
function handleUpdate(row: any) {
  resetForm();
  const id = row.id || ids.value[0];
  getRequestor(id).then((response) => {
    form.value = response.data;
    open.value = true;
    title.value = '修改请求者';
  });
}

/** 提交按钮 */
function submitForm() {
  requestorFormRef.value?.validate((valid: boolean) => {
    if (valid) {
      const commandData = {
        co: form.value
      };
      if (form.value.id) {
        modifyRequestor(commandData).then(() => {
          ElMessage.success('修改成功');
          open.value = false;
          getList();
        });
      } else {
        saveRequestor(commandData).then(() => {
          ElMessage.success('新增成功');
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row: any) {
  const deleteIds = row.id || ids.value;
  ElMessageBox.confirm('是否确认删除请求者编号为"' + deleteIds + '"的数据项？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      return removeRequestor(Array.isArray(deleteIds) ? deleteIds : [deleteIds]);
    })
    .then(() => {
      getList();
      ElMessage.success('删除成功');
    })
    .catch(() => {});
}

/** 导入按钮操作 */
function handleImport() {
  importOpen.value = true;
}

/** 导出按钮操作 */
function handleExport() {
  const queryParamsStr = JSON.stringify(queryParams);
  ElMessageBox.confirm('是否确认导出所有请求者数据项?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      return exportRequestor(ids.value);
    })
    .then((response) => {
      proxy.download(response, 'requestor_' + new Date().getTime() + '.xlsx');
    })
    .catch(() => {});
}

/** 文件上传中处理 */
function handleFileUploadProgress() {
  upload.isUploading = true;
}

/** 文件上传成功处理 */
function handleFileSuccess(response: any) {
  upload.isUploading = false;
  uploadRef.value?.clearFiles();
  ElMessageBox.confirm("<span style='color: red'>导入成功，是否继续导入？</span>", '导入结果', {
    dangerouslyUseHTMLString: true,
    confirmButtonText: '继续',
    cancelButtonText: '取消',
    type: 'success'
  })
    .then(() => {
      handleImport();
    })
    .catch(() => {
      importOpen.value = false;
      getList();
    });
}

/** 提交上传文件 */
function submitFileForm() {
  uploadRef.value?.submit();
}

/** 查看证书 */
function handleViewCert(row: any) {
  currentCert.value = row.conf;
  certOpen.value = true;
}

// 初始化
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
  min-width: 180px;
}
</style>