<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="请求者名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入请求者名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="主体类型" prop="requestorType">
              <el-select v-model="queryParams.requestorType" placeholder="主体类型" clearable>
                <el-option v-for="item in requestorTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="接入协议" prop="type">
              <el-select v-model="queryParams.type" placeholder="接入协议" clearable>
                <el-option v-for="item in protocolTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
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
        <el-table-column label="主体类型" align="center" prop="requestorType" width="150">
          <template #default="scope">
            <el-tag v-if="scope.row.requestorType === 'RA'" type="warning">RA(证书注册系统)</el-tag>
            <el-tag v-else-if="scope.row.requestorType === 'BUSINESS'" type="primary">业务系统</el-tag>
            <el-tag v-else type="info">{{ scope.row.requestorType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="接入协议" align="center" prop="type" width="120">
          <template #default="scope">
            <el-space v-if="scope.row.type">
              <el-tag v-for="protocol in String(scope.row.type).split(',')" :key="protocol" :type="protocol.trim() === 'CMP' ? 'success' : 'primary'">
                {{ protocol.trim() }}
              </el-tag>
            </el-space>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" prop="status" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'DISABLED' ? 'danger' : 'success'">{{ scope.row.status === 'DISABLED' ? '停用' : '启用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="证书主体" align="center" prop="subjectDn" min-width="220" :show-overflow-tooltip="true" />
        <el-table-column label="序列号" align="center" prop="serialNumber" width="180" :show-overflow-tooltip="true" />
        <el-table-column label="有效期至" align="center" prop="notAfter" width="180" />
        <el-table-column label="协议身份证书" align="center" prop="conf" width="120">
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
            <el-tooltip content="授权" placement="top">
              <el-button v-hasPermi="['ca:requestor:authorize']" link type="success" icon="Key" @click="handleAuthorize(scope.row)"></el-button>
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
        <el-form-item label="主体类型" prop="requestorType">
          <el-select v-model="form.requestorType" placeholder="请选择主体类型" style="width: 100%">
            <el-option v-for="item in requestorTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="接入协议" prop="type">
          <el-select v-model="form.type" placeholder="请选择接入协议" style="width: 100%">
            <el-option v-for="item in protocolTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio-button label="ENABLED">启用</el-radio-button>
            <el-radio-button label="DISABLED">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="协议身份证书" prop="certificatePem">
          <el-input v-model="form.certificatePem" type="textarea" placeholder="请输入证书PEM数据" :rows="12" @blur="parseFormCertificate" />
          <div class="text-xs text-gray-500 mt-1">用于 API 请求签名或 CMP 消息保护的 PEM 证书</div>
        </el-form-item>
        <el-form-item v-if="form.subjectDn" label="证书主体">
          <el-input v-model="form.subjectDn" readonly />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
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

    <!-- 授权对话框 -->
    <el-dialog title="请求者授权" v-model="authorizeOpen" width="860px" append-to-body>
      <el-form :model="authorizeForm" label-width="100px">
        <el-form-item label="请求者">
          <el-input v-model="authorizeForm.requestorName" readonly />
        </el-form-item>
        <el-alert
          v-if="isRaAuthorizeRequestor"
          class="ra-requestor-auth-alert"
          type="warning"
          :closable="false"
          title="授权给 RA 请求者时必须包含管理员证书模板；该模板用于 RA 管理员和审计员身份证书签发，系统会自动勾选并锁定。"
          show-icon
        />
        <el-form-item label="根CA授权">
          <div class="root-auth-panel">
            <div class="root-auth-list">
              <div class="profile-auth-toolbar">
                <span>根证书</span>
                <div>
                  <el-button size="small" :disabled="!rootOptions.length || authorizeOptionsLoading" @click="selectAllRoots">全选</el-button>
                  <el-button size="small" :disabled="!rootOptions.length || authorizeOptionsLoading" @click="clearAllRoots">全不选</el-button>
                </div>
              </div>
              <el-table v-loading="authorizeOptionsLoading" border :data="rootOptions" highlight-current-row @row-click="handleRootRowClick">
                <el-table-column label="授权" align="center" width="90">
                  <template #default="scope">
                    <el-checkbox v-model="scope.row.authorized" @change="handleRootAuthorizeChange(scope.row)" />
                  </template>
                </el-table-column>
                <el-table-column label="根证书名称" prop="name" min-width="190" show-overflow-tooltip />
              </el-table>
            </div>
            <div class="profile-auth-panel">
              <div class="profile-auth-toolbar">
                <span>{{ activeRootName || '请选择根证书' }}</span>
                <div>
                  <el-button size="small" :disabled="!activeRootAuthorized || !profileOptions.length || rootProfileLoading" @click="selectAllRootProfiles">全选</el-button>
                  <el-button size="small" :disabled="!activeRootAuthorized || !profileOptions.length || rootProfileLoading" @click="clearRootProfiles">全不选</el-button>
                </div>
              </div>
              <el-table v-loading="rootProfileLoading" border :data="profileOptions" empty-text="请选择根证书后查看模板">
                <el-table-column type="index" label="序号" width="60" align="center" />
                <el-table-column label="模板名称" prop="name" min-width="180" show-overflow-tooltip />
                <el-table-column label="类型" align="center" width="140">
                  <template #default="scope">
                    <el-tag v-if="scope.row.type === 'RootCA' || scope.row.certLevel === 'RootCA'" type="danger">根CA</el-tag>
                    <el-tag v-else-if="scope.row.type === 'IntermediateCA' || scope.row.certLevel === 'IntermediateCA'" type="warning">中间CA</el-tag>
                    <el-tag v-else-if="scope.row.type === 'EndEntity' || scope.row.certLevel === 'EndEntity'" type="success">终端实体</el-tag>
                    <el-tag v-else>{{ scope.row.type || scope.row.certLevel || '-' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="授权状态" align="center" width="130">
                  <template #default="scope">
                    <el-checkbox
                      v-model="scope.row.authorized"
                      class="auth-checkbox"
                      :disabled="!activeRootAuthorized || isLockedAdminProfile(scope.row)"
                      @change="handleProfileAuthorizeChange"
                    >
                      {{ scope.row.authorized ? '已授权' : '未授权' }}
                    </el-checkbox>
                  </template>
                </el-table-column>
                <el-table-column label="操作" align="center" width="100">
                  <template #default="scope">
                    <el-button link type="primary" icon="View" @click="handleViewProfile(scope.row)">查看</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitAuthorize">确 定</el-button>
          <el-button @click="authorizeOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 模板详情对话框 -->
    <el-dialog v-model="profileDetailOpen" title="模板详情" width="60%" append-to-body top="5vh">
      <div style="max-height: 75vh; overflow-y: auto">
        <CertProfile v-if="currentProfile" :profile="currentProfile" />
        <el-empty v-else description="暂无模板详情" />
      </div>
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
import { ref, reactive, computed, getCurrentInstance, watch } from 'vue';
import { ElMessage, ElMessageBox, type UploadInstance, type UploadProgressEvent, type UploadRawFile } from 'element-plus';
import { Search, Refresh, Plus, Upload, Download, Edit, Delete, UploadFilled, Document, Key, View } from '@element-plus/icons-vue';
import { listProfile, getProfile } from '@/api/ca/profile';
import { getRootCa, listRootCa } from '@/api/ca/root';
import {
  pageRequestor,
  getRequestor,
  saveRequestor,
  modifyRequestor,
  removeRequestor,
  importRequestor,
  exportRequestor,
  authorizeRequestor,
  getRequestorAuthorization
} from '@/api/ca/requestor';
import { RequestorForm, RequestorQuery } from '@/api/ca/requestor/types';
import X509Cert from '@/components/X509Cert/index.vue';
import CertProfile from '@/components/CertProfile/index.vue';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
import { X509 } from 'jsrsasign';

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
const authorizeOpen = ref(false);
const profileDetailOpen = ref(false);
const requestorList = ref<any[]>([]);
const currentCert = ref<string>('');
const currentProfile = ref<any>(null);
const rootOptions = ref<any[]>([]);
const allProfileOptions = ref<any[]>([]);
const profileOptions = ref<any[]>([]);
const authorizeOptionsLoading = ref(false);
const rootProfileLoading = ref(false);
let rootProfileLoadSeq = 0;
const activeRootId = ref<string | number | undefined>(undefined);
const rootAuthorizationMap = reactive<Record<string, any>>({});

const queryFormRef = ref();
const requestorFormRef = ref();
const uploadRef = ref<UploadInstance>();

const authorizeForm = reactive<any>({
  requestorId: undefined,
  requestorName: '',
  requestorType: '',
  profileIds: []
});

const activeRootKey = computed(() => normalizeId(activeRootId.value));
const activeRootAuth = computed(() => rootAuthorizationMap[activeRootKey.value]);
const activeRootName = computed(() => rootOptions.value.find((item) => normalizeId(item.id) === activeRootKey.value)?.name || '');
const activeRootAuthorized = computed(() => !!activeRootAuth.value?.authorized);
const allRootProfileIds = computed(() => profileOptions.value.map((item) => item.id));
const ADMIN_PROFILE_NAME = '管理员证书模板';
const isRaAuthorizeRequestor = computed(() => String(authorizeForm.requestorType || '').trim().toUpperCase() === 'RA');
const requestorTypeOptions = [
  { label: 'RA(证书注册系统)', value: 'RA' },
  { label: '业务系统', value: 'BUSINESS' }
];
const protocolTypeOptions = [{ label: 'API + CMP', value: 'API,CMP' }];

// 查询参数
const queryParams = reactive<RequestorQuery>({
  pageNum: 1,
  pageSize: 10,
  name: undefined,
  requestorType: undefined,
  type: undefined
});

// 表单参数
const form = ref<RequestorForm>({});

// 表单校验
const rules = reactive({
  name: [{ required: true, message: '请求者名称不能为空', trigger: 'blur' }],
  requestorType: [{ required: true, message: '主体类型不能为空', trigger: 'change' }],
  type: [{ required: true, message: '接入协议不能为空', trigger: 'change' }],
  certificatePem: [{ required: true, message: '协议身份证书不能为空', trigger: 'blur' }]
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
      const pageData = response.data || {};
      const rows = pageData.rows || pageData.records || [];
      requestorList.value = rows.map((item: any) => normalizeRequestorRow(item));
      total.value = pageData.total || requestorList.value.length || 0;
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
    requestorType: 'BUSINESS',
    type: 'API,CMP',
    conf: undefined,
    certificatePem: undefined,
    status: 'ENABLED',
    remark: undefined
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
    form.value = toRequestorForm(response.data);
    open.value = true;
    title.value = '修改请求者';
  });
}

/** 提交按钮 */
function submitForm() {
  requestorFormRef.value?.validate((valid: boolean) => {
    if (valid) {
      const submitData = {
        id: form.value.id,
        name: form.value.name,
        requestorType: form.value.requestorType,
        type: 'API,CMP',
        status: form.value.status,
        remark: form.value.remark,
        certificatePem: form.value.certificatePem,
        conf: buildRequestorConf(form.value)
      };
      const commandData = {
        co: submitData
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
  currentCert.value = parseRequestorConf(row.conf).certificatePem || row.conf;
  certOpen.value = true;
}

function handleAuthorize(row: any) {
  authorizeForm.requestorId = row.id;
  authorizeForm.requestorName = row.name;
  authorizeForm.requestorType = row.requestorType;
  authorizeForm.profileIds = [];
  profileOptions.value = [];
  activeRootId.value = undefined;
  Object.keys(rootAuthorizationMap).forEach((key) => delete rootAuthorizationMap[key]);
  authorizeOpen.value = true;
  loadAuthorizeOptions();
}

async function submitAuthorize() {
  if (!authorizeForm.requestorId) {
    ElMessage.warning('请选择请求者');
    return;
  }
  if (isRaAuthorizeRequestor.value) {
    const missingAdminRoot = rootOptions.value.find((root) => {
      if (!root.authorized) {
        return false;
      }
      const authorization = rootAuthorizationMap[normalizeId(root.id)] || {};
      const adminProfile = allProfileOptions.value.find((profile) => isAdminProfile(profile));
      return (
        !adminProfile ||
        !normalizeIdList(authorization.rootProfileIds || []).includes(normalizeId(adminProfile.id)) ||
        !normalizeIdList(authorization.profileIds || []).includes(normalizeId(adminProfile.id))
      );
    });
    if (missingAdminRoot) {
      ElMessage.warning(`授权给RA请求者时，根CA ${missingAdminRoot.name || missingAdminRoot.id} 必须选择管理员证书模板`);
      return;
    }
  }
  await authorizeRequestor({
    requestorId: authorizeForm.requestorId,
    roots: rootOptions.value.map((root) => {
      const key = normalizeId(root.id);
      const authorization = rootAuthorizationMap[key] || {};
      return {
        rootId: root.id,
        authorized: !!root.authorized,
        profileIds: root.authorized ? authorization.profileIds || [] : []
      };
    })
  });
  ElMessage.success('授权成功');
  authorizeOpen.value = false;
}

async function loadAuthorizeOptions() {
  authorizeOptionsLoading.value = true;
  try {
    const rootRes: any = await listRootCa({});
    const roots = rootRes.data?.records || rootRes.data?.rows || rootRes.data || [];
    if (!allProfileOptions.value.length) {
      const profileRes: any = await listProfile({});
      allProfileOptions.value = profileRes.data?.records || profileRes.data?.rows || profileRes.data || [];
    }
    const authorizationResults = await Promise.all(
      roots.map(async (root: any) => {
        const [rootDetailRes, authRes]: any[] = await Promise.all([getRootCa(root.id), getRequestorAuthorization(authorizeForm.requestorId, root.id)]);
        const rootDetail = rootDetailRes.data || {};
        const authorization = authRes.data || {};
        const rootProfileIds = normalizeIdList(rootDetail.profileIds || []);
        const authorizedProfileIds = normalizeIdList(authorization.profileIds || []);
        const profileIds =
          authorization.authorized && !authorizedProfileIds.length
            ? allProfileOptions.value.filter((item) => rootProfileIds.includes(normalizeId(item.id))).map((item) => item.id)
            : allProfileOptions.value.filter((item) => authorizedProfileIds.includes(normalizeId(item.id))).map((item) => item.id);
        return {
          root,
          authorization: {
            rootId: root.id,
            authorized: !!authorization.authorized,
            rootProfileIds,
            profileIds
          }
        };
      })
    );
    rootOptions.value = authorizationResults.map(({ root, authorization }) => ({
      ...root,
      authorized: authorization.authorized
    }));
    authorizationResults.forEach(({ root, authorization }) => {
      rootAuthorizationMap[normalizeId(root.id)] = authorization;
    });
    if (!activeRootId.value && rootOptions.value.length) {
      activeRootId.value = rootOptions.value.find((root) => root.authorized)?.id || rootOptions.value[0].id;
      loadRootProfileOptions(activeRootId.value);
    }
  } finally {
    authorizeOptionsLoading.value = false;
  }
}

async function loadRootProfileOptions(rootId?: string | number) {
  const seq = ++rootProfileLoadSeq;
  authorizeForm.profileIds = [];
  profileOptions.value = [];
  if (!rootId || !authorizeForm.requestorId) return;
  rootProfileLoading.value = true;
  try {
    if (seq !== rootProfileLoadSeq) return;
    const rootKey = normalizeId(rootId);
    const rootAuthorization = rootAuthorizationMap[rootKey];
    const rootProfileIds = normalizeIdList(rootAuthorization?.rootProfileIds || []);
    const rootProfiles = allProfileOptions.value.filter((item) => rootProfileIds.includes(normalizeId(item.id)));
    authorizeForm.profileIds = rootAuthorization?.authorized ? rootAuthorization.profileIds || [] : [];
    syncProfileAuthorizeState(rootProfiles);
  } finally {
    if (seq === rootProfileLoadSeq) {
      rootProfileLoading.value = false;
    }
  }
}

function normalizeId(id: string | number | undefined | null) {
  return id === undefined || id === null ? '' : String(id);
}

function normalizeIdList(idsValue: any[]) {
  return (idsValue || []).map((id) => normalizeId(id)).filter(Boolean);
}

function hasSelectedProfile(id: string | number) {
  const selectedIds = normalizeIdList(authorizeForm.profileIds || []);
  return selectedIds.includes(normalizeId(id));
}

function isAdminProfile(profile: any) {
  return profile?.name === ADMIN_PROFILE_NAME;
}

function isLockedAdminProfile(profile: any) {
  return isRaAuthorizeRequestor.value && activeRootAuthorized.value && isAdminProfile(profile);
}

function ensureRaAdminProfileSelected(profiles = profileOptions.value) {
  if (!isRaAuthorizeRequestor.value || !activeRootAuth.value?.authorized) {
    return;
  }
  const adminProfile = profiles.find((profile) => isAdminProfile(profile));
  if (!adminProfile) {
    return;
  }
  const selectedIds = normalizeIdList(authorizeForm.profileIds || []);
  if (!selectedIds.includes(normalizeId(adminProfile.id))) {
    authorizeForm.profileIds = [...(authorizeForm.profileIds || []), adminProfile.id];
  }
  activeRootAuth.value.profileIds = [...authorizeForm.profileIds];
}

function syncProfileAuthorizeState(profiles = profileOptions.value) {
  ensureRaAdminProfileSelected(profiles);
  profileOptions.value = profiles.map((profile) => ({
    ...profile,
    authorized: hasSelectedProfile(profile.id)
  }));
}

function syncAuthorizeProfileIds() {
  authorizeForm.profileIds = profileOptions.value.filter((profile) => profile.authorized).map((profile) => profile.id);
  ensureRaAdminProfileSelected();
  if (activeRootAuth.value) {
    activeRootAuth.value.profileIds = [...authorizeForm.profileIds];
  }
}

function handleProfileAuthorizeChange() {
  if (activeRootAuth.value && !activeRootAuth.value.authorized) {
    activeRootAuth.value.authorized = true;
    const root = rootOptions.value.find((item) => normalizeId(item.id) === activeRootKey.value);
    if (root) {
      root.authorized = true;
    }
  }
  syncAuthorizeProfileIds();
}

function selectAllRootProfiles() {
  authorizeForm.profileIds = [...allRootProfileIds.value];
  if (activeRootAuth.value) {
    activeRootAuth.value.authorized = true;
    const root = rootOptions.value.find((item) => normalizeId(item.id) === activeRootKey.value);
    if (root) {
      root.authorized = true;
    }
  }
  syncProfileAuthorizeState();
  syncAuthorizeProfileIds();
}

function clearRootProfiles() {
  authorizeForm.profileIds = [];
  ensureRaAdminProfileSelected();
  syncProfileAuthorizeState();
  syncAuthorizeProfileIds();
}

function handleRootRowClick(row: any) {
  activeRootId.value = row.id;
}

function handleRootAuthorizeChange(root: any) {
  const key = normalizeId(root.id);
  const authorization = rootAuthorizationMap[key];
  if (authorization) {
    authorization.authorized = !!root.authorized;
    if (root.authorized && !(authorization.profileIds || []).length) {
      authorization.profileIds = [...(authorization.rootProfileIds || [])];
    }
    if (isRaAuthorizeRequestor.value && root.authorized) {
      const adminProfile = allProfileOptions.value.find((profile) => isAdminProfile(profile));
      if (adminProfile && (authorization.rootProfileIds || []).includes(normalizeId(adminProfile.id))) {
        const profileIds = normalizeIdList(authorization.profileIds || []);
        if (!profileIds.includes(normalizeId(adminProfile.id))) {
          authorization.profileIds = [...(authorization.profileIds || []), adminProfile.id];
        }
      }
    }
  }
  activeRootId.value = root.id;
  loadRootProfileOptions(root.id);
}

function selectAllRoots() {
  rootOptions.value.forEach((root) => {
    root.authorized = true;
    const authorization = rootAuthorizationMap[normalizeId(root.id)];
    if (authorization) {
      authorization.authorized = true;
      if (!(authorization.profileIds || []).length) {
        authorization.profileIds = [...(authorization.rootProfileIds || [])];
      }
      if (isRaAuthorizeRequestor.value) {
        const adminProfile = allProfileOptions.value.find((profile) => isAdminProfile(profile));
        if (adminProfile && (authorization.rootProfileIds || []).includes(normalizeId(adminProfile.id))) {
          const profileIds = normalizeIdList(authorization.profileIds || []);
          if (!profileIds.includes(normalizeId(adminProfile.id))) {
            authorization.profileIds = [...(authorization.profileIds || []), adminProfile.id];
          }
        }
      }
    }
  });
  if (activeRootId.value) {
    loadRootProfileOptions(activeRootId.value);
  }
}

function clearAllRoots() {
  rootOptions.value.forEach((root) => {
    root.authorized = false;
    const authorization = rootAuthorizationMap[normalizeId(root.id)];
    if (authorization) {
      authorization.authorized = false;
      authorization.profileIds = [];
    }
  });
  if (activeRootId.value) {
    loadRootProfileOptions(activeRootId.value);
  }
}

async function handleViewProfile(profile: any) {
  try {
    const res = await getProfile(profile.id);
    const profileData = res.data;
    const conf = parseJson(profileData.conf);
    currentProfile.value = {
      ...profileData,
      metadata: {
        category: profileData.type || conf.certLevel || '证书模板',
        details: profileData.description || conf.description || ''
      },
      certLevel: conf.certLevel || profileData.type || profileData.certLevel || '',
      maxSize: conf.maxSize || '-',
      validity: conf.validity || '-',
      notBeforeTime: conf.notBeforeTime || '-',
      keypairGeneration: conf.keypairGeneration || '-',
      keyAlgorithms: parseKeyAlgorithms(conf.keyAlgorithms),
      subject: conf.subject || [],
      extensions: conf.extensions || []
    };
    profileDetailOpen.value = true;
  } catch (error) {
    ElMessage.error('获取模板详情失败');
  }
}

watch(
  () => activeRootId.value,
  (rootId) => {
    loadRootProfileOptions(rootId);
  }
);

function buildRequestorConf(data: any) {
  return JSON.stringify({
    certificatePem: data.certificatePem,
    status: data.status || 'ENABLED',
    remark: data.remark || ''
  });
}

function toRequestorForm(data: any) {
  const config = parseRequestorConf(data?.conf);
  return {
    ...data,
    requestorType: normalizeRequestorType(data),
    type: 'API,CMP',
    certificatePem: config.certificatePem || data?.certificatePem || data?.conf,
    status: data?.status || config.status || 'ENABLED',
    remark: data?.remark || config.remark || ''
  };
}

function parseRequestorConf(conf?: string) {
  if (!conf) return {} as any;
  try {
    return JSON.parse(conf);
  } catch (e) {
    return { certificatePem: conf };
  }
}

function normalizeRequestorRow(row: any) {
  const config = parseRequestorConf(row?.conf);
  return {
    ...row,
    requestorType: normalizeRequestorType(row),
    status: row?.status || config.status || 'ENABLED',
    subjectDn: row?.subjectDn || config.subjectDn,
    issuerDn: row?.issuerDn || config.issuerDn,
    serialNumber: row?.serialNumber || config.serialNumber,
    notBefore: row?.notBefore || config.notBefore,
    notAfter: row?.notAfter || config.notAfter,
    remark: row?.remark || config.remark
  };
}

function normalizeRequestorType(row: any) {
  const rawType = String(row?.requestorType || '').trim().toUpperCase();
  if (rawType === 'RA' || rawType === 'BUSINESS') {
    return rawType;
  }
  return String(row?.name || '').trim().toUpperCase() === 'RA' ? 'RA' : 'BUSINESS';
}

function parseFormCertificate() {
  if (!form.value.certificatePem) return;
  try {
    const x509 = new X509();
    x509.readCertPEM(form.value.certificatePem);
    (form.value as any).subjectDn = x509.getSubjectString();
  } catch (e) {
    ElMessage.warning('证书PEM格式不正确');
  }
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

.ra-requestor-auth-alert {
  margin-bottom: 14px;
}

.profile-auth-panel {
  width: 100%;
}

.profile-auth-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
