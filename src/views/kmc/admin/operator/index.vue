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
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:user:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['system:user:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['system:user:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" :columns="columns"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="userList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="用户编号" align="center" key="id" prop="id" v-if="columns[0].visible" />
      <el-table-column label="用户名称" align="center" key="username" prop="username" v-if="columns[1].visible" :show-overflow-tooltip="true" />
      <el-table-column label="邮箱" align="center" key="mail" prop="mail" v-if="columns[2].visible" :show-overflow-tooltip="true" />
      <el-table-column label="手机号码" align="center" key="mobile" prop="mobile" v-if="columns[3].visible" width="120" />
      <el-table-column label="状态" align="center" key="status" v-if="columns[4].visible">
        <template #default="scope">
          <el-switch
            v-model="scope.row.status"
            :active-value="0"
            :inactive-value="1"
            @change="(val) => handleStatusChange(scope.row, val as number)"
          ></el-switch>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" v-if="columns[5].visible" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="120" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="修改" placement="top" v-if="scope.row.id !== 1">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:user:edit']"></el-button>
          </el-tooltip>
          <el-tooltip content="删除" placement="top" v-if="scope.row.id !== 1">
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:user:remove']"></el-button>
          </el-tooltip>
          <el-tooltip content="重置密码" placement="top" v-if="scope.row.id !== 1">
            <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)" v-hasPermi="['system:user:resetPwd']"></el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="userRef" :model="form" :rules="rules" label-width="80px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" :disabled="form.id != undefined" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.id == undefined" label="用户密码" prop="password">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="30" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="mobile">
              <el-input v-model="form.mobile" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="邮箱" prop="mail">
              <el-input v-model="form.mail" placeholder="请输入邮箱" maxlength="50" />
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
            <el-form-item label="上传证书" required>
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
              <el-button v-if="certPem" link type="primary" @click="showCertDialog = true">查看证书详情</el-button>
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

    <el-dialog v-model="showCertDialog" title="证书详情" width="60%">
      <X509Cert v-if="showCertDialog" :certPem="certPem" />
    </el-dialog>
  </div>
</template>

<script setup name="KmcOperatorAdmin" lang="ts">
import { listUser, getUser, delUser, updateUser, resetUserPwd, changeStatus, saveUserWithCert } from '@/api/system/user';
import { UserForm, UserQuery, UserVO } from '@/api/system/user/types';
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
const isDataLoaded = ref(false);
const KMC_BIZ_DEPT_ID = 301;
const KMC_OPERATOR_ROLE_ID = '304';

const userRef = ref<FormInstance>();
const queryForm = ref<FormInstance>();
const uploadCertRef = ref<UploadInstance>();
const certFileList = ref<UploadUserFile[]>([]);
const certPem = ref<string>('');
const showCertDialog = ref(false);

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
    roleId: KMC_OPERATOR_ROLE_ID
  },
  rules: {
    username: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      { min: 2, max: 20, message: '用户名称长度必须介于 2 和 20 之间', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      { min: 6, max: 30, message: '用户密码长度必须介于 6 和 30 之间', trigger: 'blur' }
    ],
    mail: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
    mobile: [{ pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: '请输入正确的手机号码', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

function getList() {
  loading.value = true;
  isDataLoaded.value = false;
  listUser(proxy?.addDateRange(queryParams.value, dateRange.value)).then((res) => {
    loading.value = false;
    const page = res.data || res;
    userList.value = [];
    nextTick(() => {
      userList.value = page.rows || page.records || [];
      setTimeout(() => {
        isDataLoaded.value = true;
      }, 200);
    });
    total.value = page.total || 0;
  });
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  dateRange.value = [];
  queryForm.value?.resetFields();
  queryParams.value.roleId = KMC_OPERATOR_ROLE_ID;
  handleQuery();
}

function handleDelete(row: any) {
  const userIds = row.id || ids.value;
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

function handleStatusChange(row: any, newStatus: number) {
  if (!isDataLoaded.value) {
    return;
  }

  const text = newStatus === 0 ? '启用' : '停用';
  proxy?.$modal
    .confirm('确认要"' + text + '" "' + row.username + '"用户吗?')
    .then(function () {
      return changeStatus(row.id, newStatus);
    })
    .then(() => {
      proxy?.$modal.msgSuccess(text + '成功');
    })
    .catch(function () {
      row.status = newStatus === 0 ? 1 : 0;
    });
}

function handleResetPwd(row: any) {
  proxy
    ?.$prompt('请输入"' + row.username + '"的新密码', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      inputPattern: /^.{6,30}$/,
      inputErrorMessage: '用户密码长度必须介于 6 和 30 之间'
    })
    .then(({ value }) => {
      resetUserPwd(row.id, value).then(() => {
        proxy?.$modal.msgSuccess('修改成功，新密码是：' + value);
      });
    })
    .catch(() => {});
}

function handleSelectionChange(selection: any) {
  ids.value = selection.map((item: any) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

function reset() {
  form.value = {
    id: undefined,
    deptId: KMC_BIZ_DEPT_ID,
    username: '',
    nickName: undefined,
    password: '',
    mobile: undefined,
    mail: undefined,
    sex: undefined,
    status: 0,
    remark: undefined,
    postIds: [],
    roleIds: [KMC_OPERATOR_ROLE_ID]
  };
  userRef.value?.resetFields();
  certFileList.value = [];
  certPem.value = '';
}

function cancel() {
  open.value = false;
  reset();
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '添加业务操作员';
}

function handleUpdate(row: any) {
  reset();
  const userId = row.id || ids.value[0];
  getUser(userId).then((response) => {
    form.value = response.data as any;
    form.value.postIds = [];
    form.value.roleIds = [KMC_OPERATOR_ROLE_ID];
    form.value.deptId = KMC_BIZ_DEPT_ID;
    open.value = true;
    title.value = '修改业务操作员';
    form.value.password = '';
  });
}

function submitForm() {
  proxy?.$refs['userRef'].validate(async (valid: any) => {
    if (!valid) {
      return;
    }

    form.value.deptId = KMC_BIZ_DEPT_ID;
    form.value.roleIds = [KMC_OPERATOR_ROLE_ID];
    if (form.value.id != undefined) {
      updateUser(form.value).then(() => {
        proxy?.$modal.msgSuccess('修改成功');
        open.value = false;
        getList();
      });
      return;
    }

    if (certFileList.value.length === 0) {
      ElMessage.error('请上传证书文件');
      return;
    }

    const formData = new FormData();
    const coBlob = new Blob([JSON.stringify(form.value)], { type: 'application/json' });
    formData.append('co', coBlob);

    if (certFileList.value[0].raw) {
      formData.append('file', certFileList.value[0].raw);
    }

    await saveUserWithCert(formData);
    proxy?.$modal.msgSuccess('新增成功');
    open.value = false;
    getList();
  });
}

const readFileContent = async (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (content.includes('-----BEGIN CERTIFICATE-----')) {
          resolve(content);
          return;
        }

        const firstByte = content.charCodeAt(0);
        if (firstByte !== 0x30) {
          resolve(null);
          return;
        }

        try {
          const derBuffer = forge.util.createBuffer(content, 'binary');
          const asn1 = forge.asn1.fromDer(derBuffer);
          const cert = forge.pki.certificateFromAsn1(asn1);
          resolve(forge.pki.certificateToPem(cert));
        } catch (derError) {
          const base64 = forge.util.encode64(content);
          const pem = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
          resolve(pem);
        }
      } catch (error) {
        console.error('File reading error:', error);
        resolve(null);
      }
    };
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

const handleCertFileChange: UploadProps['onChange'] = async (uploadFile) => {
  if (!uploadFile.raw) {
    certPem.value = '';
    return;
  }

  const pem = await readFileContent(uploadFile.raw);
  if (pem) {
    certPem.value = pem;
    return;
  }

  ElMessage.error('无法解析证书文件，请确认文件为正确的X.509证书格式（PEM或DER）');
  certPem.value = '';
  uploadCertRef.value!.clearFiles();
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
