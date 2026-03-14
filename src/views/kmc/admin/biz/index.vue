<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="用户名称" prop="username">
        <el-input v-model="queryParams.username" placeholder="请输入用户名称" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="手机号码" prop="mobile">
        <el-input v-model="queryParams.mobile" placeholder="请输入手机号码" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="用户状态" clearable style="width: 240px">
          <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['system:user:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['system:user:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="info" plain icon="Upload" @click="handleImport" v-hasPermi="['system:user:import']">导入</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['system:user:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" :columns="columns"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="userList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="用户编号" align="center" key="userId" prop="userId" v-if="columns[0].visible" />
      <el-table-column label="用户名称" align="center" key="username" prop="username" v-if="columns[1].visible" :show-overflow-tooltip="true" />
      <el-table-column label="邮箱" align="center" key="mail" prop="mail" v-if="columns[2].visible" :show-overflow-tooltip="true" />
      <el-table-column label="手机号码" align="center" key="phonenumber" prop="phonenumber" v-if="columns[3].visible" width="120" />
      <el-table-column label="状态" align="center" key="status" v-if="columns[4].visible">
        <template #default="scope">
          <el-switch v-model="scope.row.status" active-value="0" inactive-value="1" @change="handleStatusChange(scope.row)"></el-switch>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" v-if="columns[5].visible" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="150" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="修改" placement="top" v-if="scope.row.userId !== 1">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:user:edit']"></el-button>
          </el-tooltip>
          <el-tooltip content="删除" placement="top" v-if="scope.row.userId !== 1">
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:user:remove']"></el-button>
          </el-tooltip>
          <el-tooltip content="重置密码" placement="top" v-if="scope.row.userId !== 1">
            <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)" v-hasPermi="['system:user:resetPwd']"></el-button>
          </el-tooltip>
          <el-tooltip content="分配角色" placement="top" v-if="scope.row.userId !== 1">
            <el-button link type="primary" icon="CircleCheck" @click="handleAuthRole(scope.row)" v-hasPermi="['system:user:edit']"></el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改用户配置对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="userRef" :model="form" :rules="rules" label-width="80px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户名称" prop="userName">
              <el-input v-model="form.userName" placeholder="请输入用户名称" maxlength="30" :disabled="form.userId != undefined" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户密码" prop="password">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="20" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="phonenumber">
              <el-input v-model="form.phonenumber" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" placeholder="请选择状态">
                <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="上传证书" prop="cert" required>
              <el-upload
                ref="uploadCertRef"
                action="#"
                :limit="1"
                :on-exceed="handleCertExceed"
                :auto-upload="false"
                :on-change="handleCertFileChange"
                :on-remove="handleCertRemove"
                v-model:file-list="certFileList"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                <template #tip>
                  <div class="el-upload__tip">请上传 .cer, .crt, 或 .pem 格式的 X.509 证书文件。</div>
                </template>
              </el-upload>
              <el-button v-if="certPem" type="text" @click="showCertDialog = true">查看证书详情</el-button>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入内容"></el-input>
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

    <!-- 用户导入对话框 -->
    <el-dialog :title="upload.title" v-model="upload.open" width="400px" append-to-body>
      <el-upload
        ref="uploadRef"
        :limit="1"
        accept=".xlsx, .xls"
        :headers="upload.headers"
        :action="upload.url + '?updateSupport=' + upload.updateSupport"
        :disabled="upload.isUploading"
        :on-progress="handleFileUploadProgress"
        :on-success="handleFileSuccess"
        :auto-upload="false"
        drag
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip text-center">
            <div class="el-upload__tip"><el-checkbox v-model="upload.updateSupport" />是否更新已经存在的用户数据</div>
            <span>仅允许导入xls、xlsx格式文件。</span>
            <el-link type="primary" :underline="false" style="font-size: 12px; vertical-align: baseline" @click="importTemplate">下载模板</el-link>
          </div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitFileForm">确 定</el-button>
          <el-button @click="upload.open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 证书详情弹窗 -->
    <el-dialog v-model="showCertDialog" title="证书详情" width="60%">
      <X509Cert v-if="showCertDialog" :certPem="certPem" />
    </el-dialog>
  </div>
</template>

<script setup name="User" lang="ts">
import { listUser, getUser, delUser, addUser, updateUser, resetUserPwd, changeUserStatus, uploadUserCert, saveUserWithCert } from '@/api/system/user';
import { getToken } from '@/utils/auth';
import { UserForm, UserQuery, UserVO } from '@/api/system/user/types';
import { RoleVO } from '@/api/system/role/types';
import { FormInstance, UploadInstance, UploadUserFile, UploadProps, UploadRawFile, genFileId } from 'element-plus';
import X509Cert from '@/components/X509Cert/index.vue';
import * as forge from 'node-forge';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_common_status } = toRefs<any>(proxy!.useDict('sys_common_status'));

const userList = ref<UserVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<number | string>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const dateRange = ref<[Date, Date]>();
const initPassword = ref<string | undefined>(undefined);
const roleOptions = ref<RoleVO[]>([]);

const userRef = ref<FormInstance>();
const queryForm = ref<FormInstance>();

// 证书上传相关
const uploadCertRef = ref<UploadInstance>();
const certFileList = ref<UploadUserFile[]>([]);
const certPem = ref<string>('');
const showCertDialog = ref(false);

/*** 用户导入参数 */
const upload = reactive({
  // 是否显示弹出层（用户导入）
  open: false,
  // 弹出层标题（用户导入）
  title: '',
  // 是否禁用上传
  isUploading: false,
  // 是否更新已经存在的用户数据
  updateSupport: 0,
  // 设置上传的请求头部
  headers: { Authorization: 'Bearer ' + getToken() },
  // 上传的地址
  url: import.meta.env.VITE_APP_BASE_API + '/system/user/importData'
});

const columns = ref([
  { key: 0, label: `用户编号`, visible: true },
  { key: 1, label: `用户名称`, visible: true },
  { key: 2, label: `邮箱`, visible: true },
  { key: 3, label: `手机号码`, visible: true },
  { key: 4, label: `状态`, visible: true },
  { key: 5, label: `创建时间`, visible: true }
]);

const data = reactive<{
  form: UserForm;
  queryParams: UserQuery;
  rules: any;
}>({
  form: {} as UserForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    username: undefined,
    mobile: undefined,
    status: undefined,
    deptId: 301,
    roleId: 303, // 固定角色ID
    deptIds: [301] // 默认包含301
  },
  rules: {
    userName: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      { min: 2, max: 20, message: '用户名称长度必须介于 2 和 20 之间', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      { min: 5, max: 20, message: '用户密码长度必须介于 5 和 20 之间', trigger: 'blur' }
    ],
    email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
    phonenumber: [{ pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: '请输入正确的手机号码', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询用户列表 */
function getList() {
  loading.value = true;
  listUser(proxy?.addDateRange(queryParams.value, dateRange.value)).then((res) => {
    loading.value = false;
    userList.value = res.rows;
    total.value = res.total;
  });
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = [];
  queryForm.value?.resetFields();
  queryParams.value.deptId = 301;
  handleQuery();
}

/** 删除按钮操作 */
function handleDelete(row: any) {
  const userIds = row.userId || ids.value;
  proxy?.$modal
    .confirm('是否确认删除用户编号为"' + userIds + '"的数据项？')
    .then(function () {
      return delUser(userIds);
    })
    .then(() => {
      getList();
      proxy?.$modal.msgSuccess('删除成功');
    })
    .catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy?.download(
    'system/user/export',
    {
      ...queryParams.value
    },
    `user_${new Date().getTime()}.xlsx`
  );
}

/** 用户状态修改  */
function handleStatusChange(row: any) {
  const text = row.status === '0' ? '启用' : '停用';
  proxy?.$modal
    .confirm('确认要"' + text + '""' + row.userName + '"用户吗?')
    .then(function () {
      return changeUserStatus(row.userId, row.status);
    })
    .then(() => {
      proxy?.$modal.msgSuccess(text + '成功');
    })
    .catch(function () {
      row.status = row.status === '0' ? '1' : '0';
    });
}

/** 更多操作 */
function handleCommand(command: string, row: any) {
  switch (command) {
    case 'handleResetPwd':
      handleResetPwd(row);
      break;
    case 'handleAuthRole':
      handleAuthRole(row);
      break;
    default:
      break;
  }
}

/** 重置密码按钮操作 */
function handleResetPwd(row: any) {
  proxy
    ?.$prompt('请输入"' + row.userName + '"的新密码', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      inputPattern: /^.{5,20}$/,
      inputErrorMessage: '用户密码长度必须介于 5 和 20 之间'
    })
    .then(({ value }) => {
      resetUserPwd(row.userId, value).then(() => {
        proxy?.$modal.msgSuccess('修改成功，新密码是：' + value);
      });
    })
    .catch(() => {});
}

/** 分配角色 */
function handleAuthRole(row: any) {
  const userId = row.userId;
  proxy?.$router.push('/system/user-auth/role/' + userId);
}

/** 选择条数  */
function handleSelectionChange(selection: any) {
  ids.value = selection.map((item: any) => item.userId);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 导入按钮操作 */
function handleImport() {
  upload.title = '用户导入';
  upload.open = true;
}

/** 下载模板操作 */
function importTemplate() {
  proxy?.download('system/user/importTemplate', {}, `user_template_${new Date().getTime()}.xlsx`);
}

/**文件上传中处理 */
const handleFileUploadProgress = (event: any, file: any, fileList: any) => {
  upload.isUploading = true;
};

/** 文件上传成功处理 */
const handleFileSuccess = (response: any, file: any, fileList: any) => {
  upload.open = false;
  upload.isUploading = false;
  proxy?.$refs['uploadRef'].clearFiles();
  proxy?.$alert("<div style='overflow: auto;overflow-x: hidden;max-height: 70vh;padding: 10px 20px 0;'>" + response.msg + '</div>', '导入结果', {
    dangerouslyUseHTMLString: true
  });
  getList();
};

/** 提交上传文件 */
function submitFileForm() {
  proxy?.$refs['uploadRef'].submit();
}

/** 重置操作表单 */
function reset() {
  form.value = {
    userId: undefined,
    deptId: 301,
    userName: '',
    nickName: undefined,
    password: '',
    phonenumber: undefined,
    email: undefined,
    sex: undefined,
    status: '0',
    remark: undefined,
    postIds: [],
    roleIds: ['303']
  };
  userRef.value?.resetFields();
  certFileList.value = [];
  certPem.value = '';
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  reset();
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = '添加业务管理员';
  form.value.password = initPassword.value || '';
}

/** 修改按钮操作 */
function handleUpdate(row: any) {
  reset();
  const userId = row.userId || ids.value[0];
  getUser(userId).then((response) => {
    form.value = response.data.user;
    // postOptions.value = response.posts;
    roleOptions.value = response.roles;
    form.value.postIds = response.postIds;
    form.value.roleIds = response.roleIds;
    open.value = true;
    title.value = '修改业务管理员';
    form.value.password = '';
  });
}

/** 提交按钮 */
function submitForm() {
  proxy?.$refs['userRef'].validate(async (valid: any) => {
    if (valid) {
      if (form.value.userId != undefined) {
        updateUser(form.value).then(() => {
          proxy?.$modal.msgSuccess('修改成功');
          open.value = false;
          getList();
        });
      } else {
        // 校验是否上传了证书
        if (certFileList.value.length === 0) {
          ElMessage.error('请上传证书文件');
          return;
        }

        // 使用 saveUserWithCert 接口
        const formData = new FormData();
        // 将 form 数据转换为 JSON 字符串并作为 'co' 参数传递
        // 注意：后端 @RequestPart("co") UserCO co，通常需要 Content-Type: application/json
        // 但 FormData 中 append 对象通常会被转为字符串。
        // 如果后端需要 JSON，我们需要 Blob
        const coBlob = new Blob([JSON.stringify(form.value)], { type: 'application/json' });
        formData.append('co', coBlob);

        if (certFileList.value.length > 0 && certFileList.value[0].raw) {
          formData.append('file', certFileList.value[0].raw);
        } else {
          // 如果没有文件，可能需要传递一个空的 Blob 或者不传，取决于后端是否允许 file 为空
          // 假设后端允许 file 为空或者必须传
          // 如果必须传，这里可能需要处理。如果非必须，不 append 即可。
          // 根据之前的逻辑，证书是可选的吗？之前的逻辑是先 addUser 再 uploadUserCert。
          // 现在是合并。如果用户没选证书，file 参数怎么办？
          // 假设没选证书就传一个空的 Blob
          formData.append('file', new Blob(), '');
        }

        await saveUserWithCert(formData);
        proxy?.$modal.msgSuccess('新增成功');
        open.value = false;
        getList();
      }
    }
  });
}

// 证书解析相关
const readFileContent = async (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // 检查是否是 PEM 格式
        if (content.includes('-----BEGIN CERTIFICATE-----')) {
          resolve(content);
        } else {
          // 检查是否是 DER 格式 (二进制)
          // 简单的检查：DER 编码的证书通常以 0x30 (SEQUENCE) 开头
          const firstByte = content.charCodeAt(0);
          if (firstByte === 0x30) {
             // 尝试将 DER 转换为 PEM
            try {
              const derBuffer = forge.util.createBuffer(content, 'binary');
              const asn1 = forge.asn1.fromDer(derBuffer);
              const cert = forge.pki.certificateFromAsn1(asn1);
              const pem = forge.pki.certificateToPem(cert);
              resolve(pem);
            } catch (derError) {
               // 如果 forge 无法解析（如 SM2），尝试手动包装成 PEM
               // 假设它是有效的 DER，只是 forge 不支持
              const base64 = forge.util.encode64(content);
              const pem = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
              resolve(pem);
            }
          } else {
             // 既不是 PEM 也不是 DER
             resolve(null);
          }
        }
      } catch (error) {
        console.error('File reading error:', error);
        resolve(null);
      }
    };
    // 读取为二进制字符串以兼容 DER
    reader.readAsBinaryString(file);
    reader.onerror = () => reject(null);
  });
};

const handleCertExceed: UploadProps['onExceed'] = (files) => {
  uploadCertRef.value!.clearFiles();
  const file = files[0] as UploadRawFile;
  file.uid = genFileId();
  uploadCertRef.value!.handleStart(file);
};

const handleCertFileChange: UploadProps['onChange'] = async (uploadFile, uploadFiles) => {
  if (uploadFile.raw) {
    const pem = await readFileContent(uploadFile.raw);
    if (pem) {
      certPem.value = pem;
      // showCertDialog.value = true; // 上传成功后自动弹出详情
    } else {
      ElMessage.error('无法解析证书文件，请确认文件为正确的X.509证书格式（PEM或DER）');
      certPem.value = '';
      uploadCertRef.value!.clearFiles(); // 清除错误文件
    }
  } else {
    certPem.value = '';
  }
};

const handleCertRemove: UploadProps['onRemove'] = () => {
  certPem.value = '';
};

getList();
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
