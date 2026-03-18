<script setup name="CertManagement" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, nextTick } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules, UploadProps, UploadUserFile } from 'element-plus';
import { UploadFilled, Warning } from '@element-plus/icons-vue';
import { to } from 'await-to-js';
import { pageCert, getCert, saveCert, modifyCert, removeCert, importCert, exportCert } from '@/api/cert';
import { CertForm, CertQuery } from '@/api/cert/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const certList = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<FormInstance>();
const certFormRef = ref<FormInstance>();
const formDialogRef = ref<any>();

const dialog = reactive({
  visible: false,
  title: ''
});

const uploadDialog = reactive({
  visible: false,
  loading: false,
  fileList: [] as UploadUserFile[]
});

const initFormData: CertForm = {
  id: undefined,
  certSn: '',
  subject: '',
  issuer: '',
  cert: '',
  certType: '',
  status: '0',
  notBefore: '',
  notAfter: '',
  remark: ''
};

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    certSn: '',
    subject: '',
    issuer: '',
    status: '',
    certType: ''
  } as CertQuery
});

const { queryParams, form } = toRefs(data);

const certRules: FormRules = {
  certSn: [{ required: true, message: '证书序列号不能为空', trigger: 'blur' }],
  subject: [{ required: true, message: '主题不能为空', trigger: 'blur' }],
  issuer: [{ required: true, message: '颁发者不能为空', trigger: 'blur' }]
};

/** 查询证书列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await pageCert(queryParams.value);
    certList.value = [];
    total.value = res.data.total || 0;
    await nextTick();
    certList.value = res.data.rows || res.data.records || [];
  } catch (error) {
    console.error('获取列表失败', error);
  } finally {
    loading.value = false;
  }
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map(item => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  dialog.visible = true;
  dialog.title = '证书申请';
}

/** 吊销按钮操作 */
async function handleRevoke(row?: any) {
  const certIds = row?.id || ids.value;
  const [err] = await to(proxy?.$modal.confirm('是否确认吊销证书编号为"' + certIds + '"的数据项？') as any);
  if (!err) {
    try {
      await removeCert(Array.isArray(certIds) ? certIds : [certIds]);
      await getList();
      proxy?.$modal.msgSuccess('吊销成功');
    } catch (error) {
      console.error('吊销失败', error);
    }
  }
}

/** 修改按钮操作 */
async function handleUpdate(row?: any) {
  reset();
  const id = row?.id || ids.value[0];
  try {
    const { data } = await getCert(id);
    dialog.visible = true;
    dialog.title = '修改证书';
    Object.assign(form.value, data);
  } catch (error) {
    ElMessage.error('获取证书信息失败');
  }
}

/** 提交按钮 */
async function submitForm() {
  certFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      try {
        if (form.value.id) {
          await modifyCert(form.value);
        } else {
          await saveCert(form.value);
        }
        proxy?.$modal.msgSuccess('操作成功');
        dialog.visible = false;
        await getList();
      } catch (error) {
        console.error('操作失败', error);
      }
    }
  });
}

/** 删除按钮操作 */
async function handleDelete(row?: any) {
  const certIds = row?.id || ids.value;
  const [err] = await to(proxy?.$modal.confirm('是否确认删除证书编号为"' + certIds + '"的数据项？') as any);
  if (!err) {
    try {
      await removeCert(Array.isArray(certIds) ? certIds : [certIds]);
      await getList();
      proxy?.$modal.msgSuccess('删除成功');
    } catch (error) {
      console.error('删除失败', error);
    }
  }
}

/** 导入按钮操作 */
function handleImport() {
  uploadDialog.visible = true;
  uploadDialog.fileList = [];
}

/** 导入证书 */
async function submitImport() {
  if (uploadDialog.fileList.length === 0) {
    ElMessage.warning('请选择要导入的证书文件');
    return;
  }
  
  uploadDialog.loading = true;
  try {
    const formData = new FormData();
    uploadDialog.fileList.forEach(file => {
      if (file.raw) {
        formData.append('files', file.raw);
      }
    });
    await importCert(formData);
    ElMessage.success('导入成功');
    uploadDialog.visible = false;
    await getList();
  } catch (error) {
    ElMessage.error('导入失败');
  } finally {
    uploadDialog.loading = false;
  }
}

/** 导出按钮操作 */
async function handleExport() {
  if (ids.value.length === 0) {
    ElMessage.warning('请选择要导出的证书');
    return;
  }
  
  try {
    const blob = await exportCert(ids.value);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certificates_${new Date().getTime()}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (error) {
    ElMessage.error('导出失败');
  }
}

/** 重置操作表单 */
function reset() {
  form.value = { ...initFormData };
  certFormRef.value?.resetFields();
}

/** 关闭对话框 */
function cancel() {
  dialog.visible = false;
  reset();
}

/** 文件上传前校验 */
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isCert = file.name.endsWith('.pem') || file.name.endsWith('.cer') || file.name.endsWith('.crt') || file.name.endsWith('.der');
  if (!isCert) {
    ElMessage.error('只支持上传证书文件');
    return false;
  }
  return true;
};

/** 文件上传 */
const handleFileChange: UploadProps['onChange'] = (uploadFile, uploadFiles) => {
  uploadDialog.fileList = uploadFiles;
};

getList();
</script>

<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="证书序列号" prop="certSn">
              <el-input v-model="queryParams.certSn" placeholder="请输入证书序列号" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="主题" prop="subject">
              <el-input v-model="queryParams.subject" placeholder="请输入主题" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="颁发者" prop="issuer">
              <el-input v-model="queryParams.issuer" placeholder="请输入颁发者" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="证书类型" prop="certType">
              <el-select v-model="queryParams.certType" placeholder="证书类型" clearable>
                <el-option label="根证书" value="ROOT" />
                <el-option label="中间证书" value="INTERMEDIATE" />
                <el-option label="终端证书" value="END_ENTITY" />
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
            <el-button type="primary" plain icon="Plus" @click="handleAdd">证书申请</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Warning" :disabled="single" @click="handleRevoke">吊销</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Upload" @click="handleImport">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="info" plain icon="Download" :disabled="multiple" @click="handleExport">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="certList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="证书序列号" align="center" prop="certSn" width="200" :show-overflow-tooltip="true" />
        <el-table-column label="主题" align="center" prop="subject" width="250" :show-overflow-tooltip="true" />
        <el-table-column label="颁发者" align="center" prop="issuer" width="250" :show-overflow-tooltip="true" />
        <el-table-column label="证书类型" align="center" prop="certType" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.certType === 'ROOT'" type="danger">根证书</el-tag>
            <el-tag v-else-if="scope.row.certType === 'INTERMEDIATE'" type="warning">中间证书</el-tag>
            <el-tag v-else-if="scope.row.certType === 'END_ENTITY'" type="success">终端证书</el-tag>
            <el-tag v-else type="info">{{ scope.row.certType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生效时间" align="center" prop="notBefore" width="180" />
        <el-table-column label="失效时间" align="center" prop="notAfter" width="180" />
        <el-table-column label="操作" fixed="right" width="150" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="吊销" placement="top">
              <el-button link type="warning" icon="Warning" @click="handleRevoke(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <!-- 添加或修改证书对话框 -->
    <el-dialog ref="formDialogRef" v-model="dialog.visible" :title="dialog.title" width="600px" append-to-body @close="cancel">
      <el-form ref="certFormRef" :model="form" :rules="certRules" label-width="120px">
        <el-row>
          <el-col :span="24">
            <el-form-item label="证书序列号" prop="certSn">
              <el-input v-model="form.certSn" placeholder="请输入证书序列号" :disabled="!!form.id" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="主题" prop="subject">
              <el-input v-model="form.subject" placeholder="请输入主题" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="颁发者" prop="issuer">
              <el-input v-model="form.issuer" placeholder="请输入颁发者" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="证书类型" prop="certType">
              <el-select v-model="form.certType" placeholder="请选择证书类型" style="width: 100%">
                <el-option label="根证书" value="ROOT" />
                <el-option label="中间证书" value="INTERMEDIATE" />
                <el-option label="终端证书" value="END_ENTITY" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="证书内容" prop="cert">
              <el-input v-model="form.cert" type="textarea" :rows="10" placeholder="请输入证书内容" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 导入证书对话框 -->
    <el-dialog v-model="uploadDialog.visible" title="导入证书" width="600px" append-to-body>
      <el-upload
        drag
        :auto-upload="false"
        :file-list="uploadDialog.fileList"
        :on-change="handleFileChange"
        :before-upload="beforeUpload"
        multiple
        accept=".pem,.cer,.crt,.der"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 .pem, .cer, .crt, .der 格式的证书文件</div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="uploadDialog.loading" @click="submitImport">确 定</el-button>
          <el-button @click="uploadDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
</style>
