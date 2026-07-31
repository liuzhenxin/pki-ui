<template>
  <div class="app-container ra-admin-page">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="24" :md="6" :lg="5" :xl="4">
        <el-card shadow="never" class="dept-tree-card">
          <template #header>
            <div class="dept-tree-title">部门</div>
          </template>
          <el-input v-model="deptName" placeholder="请输入部门名称" prefix-icon="Search" clearable />
          <el-tree
            ref="deptTreeRef"
            class="dept-tree"
            node-key="id"
            :data="deptTreeOptions"
            :props="deptTreeProps"
            :expand-on-click-node="false"
            :filter-node-method="filterDeptNode"
            highlight-current
            default-expand-all
            @node-click="handleDeptNodeClick"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="18" :lg="19" :xl="20">
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
          <el-form-item label="业务角色" prop="roleId">
            <el-select v-model="queryParams.roleId" placeholder="全部业务角色" clearable style="width: 240px">
              <el-option v-for="role in raBizRoleOptions" :key="role.value" :label="role.label" :value="role.value" />
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
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['ra:admin']">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['ra:admin']">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="info" plain icon="Upload" @click="handleImport" v-hasPermi="['ra:admin']">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['ra:admin']">导出</el-button>
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
          <el-table-column label="证书状态" align="center" key="certSn" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.certSn ? 'success' : 'info'">{{ scope.row.certSn ? '已签发' : '未签发' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" v-if="columns[5].visible" width="160">
            <template #default="scope">
              <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="220" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-tooltip content="详情" placement="top">
                <el-button link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
              </el-tooltip>
              <el-tooltip content="签证" placement="top" v-if="scope.row.id !== 1 && !scope.row.certSn">
                <el-button link type="success" icon="Ticket" @click="handleIssueCert(scope.row)" v-hasPermi="['ra:admin']"></el-button>
              </el-tooltip>
              <el-tooltip content="修改" placement="top" v-if="scope.row.id !== 1">
                <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['ra:admin']"></el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top" v-if="scope.row.id !== 1">
                <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['ra:admin']"></el-button>
              </el-tooltip>
              <el-tooltip content="重置密码" placement="top" v-if="scope.row.id !== 1">
                <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)" v-hasPermi="['ra:admin']"></el-button>
              </el-tooltip>
              <el-tooltip content="分配角色" placement="top" v-if="scope.row.id !== 1">
                <el-button link type="primary" icon="CircleCheck" @click="handleAuthRole(scope.row)" v-hasPermi="['ra:admin']"></el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>

        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
      </el-col>
    </el-row>

    <!-- 添加或修改用户配置对话框 -->
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
            <el-form-item label="所属部门" prop="deptId">
              <el-tree-select
                v-model="form.deptId"
                :data="deptOptions"
                :props="{ value: 'id', label: 'name', children: 'children' } as any"
                value-key="id"
                placeholder="请选择所属部门"
                check-strictly
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" placeholder="请选择状态">
                <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="Number(dict.value)"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="业务角色" prop="roleIds">
              <el-select v-model="form.roleIds" multiple filterable placeholder="请选择业务角色" style="width: 100%">
                <el-option v-for="role in raBizRoleOptions" :key="role.value" :label="role.label" :value="role.value" />
              </el-select>
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

    <!-- 签发业务管理员证书对话框 -->
    <el-dialog v-model="certDialog.visible" title="签发业务管理员证书" width="680px" append-to-body @close="closeCertDialog">
      <el-form ref="certFormRef" :model="certForm" :rules="certRules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="用户名称">
              <el-input v-model="certForm.username" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="certForm.mail" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="根证书" prop="rootId">
          <el-select v-model="certForm.rootId" placeholder="请选择根证书" style="width: 100%" @change="handleCertRootChange">
            <el-option v-for="root in certRoots" :key="root.id" :label="root.name" :value="String(root.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书模板" prop="profileId">
          <el-select v-model="certForm.profileId" placeholder="请选择证书模板" style="width: 100%">
            <el-option v-for="profile in certProfileOptions" :key="profile.id" :label="profile.name" :value="String(profile.id)" />
          </el-select>
        </el-form-item>
        <el-divider content-position="left">证书主题信息</el-divider>
        <CertSubject v-model="certForm.subjectItems" propPrefix="subjectItems" />
        <el-divider content-position="left">USB KEY 写入</el-divider>
        <el-form-item label="设备提供商" prop="provider">
          <div class="cert-inline-control">
            <el-select v-model="certForm.provider" placeholder="请选择或刷新" style="flex: 1" @change="onCertProviderChange">
              <el-option v-for="provider in certProviders" :key="provider" :label="provider" :value="provider" />
            </el-select>
            <el-button icon="Refresh" circle @click="refreshCertProviders" />
          </div>
        </el-form-item>
        <el-form-item label="设备列表" prop="device">
          <el-select v-model="certForm.device" placeholder="请选择设备" style="width: 100%" @change="onCertDeviceChange">
            <el-option v-for="device in certDevices" :key="device" :label="device" :value="device" />
          </el-select>
        </el-form-item>
        <el-form-item label="应用" prop="appName">
          <el-select v-model="certForm.appName" placeholder="请选择应用" style="width: 100%">
            <el-option v-for="app in certApps" :key="app" :label="app" :value="app" />
          </el-select>
        </el-form-item>
        <el-form-item label="容器名" prop="containerName">
          <div class="cert-inline-control">
            <el-input v-model="certForm.containerName" placeholder="格式: admin-xxxxxx" style="flex: 1" />
            <el-tooltip content="随机生成" placement="top">
              <el-button icon="Refresh" circle @click="certForm.containerName = randomContainerName('admin')" />
            </el-tooltip>
          </div>
        </el-form-item>
        <el-form-item label="User PIN" prop="pin">
          <el-input v-model="certForm.pin" type="password" show-password placeholder="请输入 USB KEY User PIN" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="certDialog.loading" @click="submitCertForm">签 证</el-button>
          <el-button @click="closeCertDialog">取 消</el-button>
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

    <el-dialog v-model="detailOpen" title="业务管理员详情" width="720px" append-to-body class="ra-user-detail-dialog">
      <el-descriptions class="ra-user-detail" :column="2" border>
        <el-descriptions-item label="用户编号">{{ detail.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户名称">{{ detail.username || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号码">{{ detail.mobile || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.mail || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="Number(detail.status) === 0 ? 'success' : 'info'" size="small">{{ formatStatus(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ parseTime(detail.createTime) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书序列号" :span="2">
          <span class="detail-mono">{{ detail.certSn || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="证书详情" :span="2">
          <el-button v-if="detail.certPem" link type="primary" icon="View" @click="handleViewDetailCert">查看证书详情</el-button>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          <span class="detail-remark">{{ detail.remark || '-' }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailOpen = false">关 闭</el-button>
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
import {
  listAdminUser as listUser,
  getAdminUser as getUser,
  delAdminUser as delUser,
  updateAdminUser as updateUser,
  resetAdminUserPwd as resetUserPwd,
  changeAdminUserStatus as changeStatus,
  addAdminUser as addUser
} from '@/api/ra/adminUser';
import { getToken } from '@/utils/auth';
import { UserForm, UserQuery, UserVO } from '@/api/system/user/types';
import { FormInstance, FormRules } from 'element-plus';
import X509Cert from '@/components/X509Cert/index.vue';
import { listDeptSelectTree } from '@/api/ra/dept';
import { RaDeptTreeOption } from '@/api/ra/dept/types';
import { getAdminCertOptions, issueAdminAccountCert, unwrapRaData, RaAdminCertOptions, RaAdminCertRootOption } from '@/api/ra/init';
import SKFClient from '@/api/skf/skf_api';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';

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
const isDataLoaded = ref(false);
const raBizRoleOptions = [
  { label: '录入员', value: '503' },
  { label: '审核员', value: '504' },
  { label: '制证员', value: '505' }
];
const RA_BIZ_ROLE_IDS = raBizRoleOptions.map((role) => role.value);
const RA_DEFAULT_BIZ_ROLE_IDS = ['503'];
const ALL_DEPT_ID = '__ALL__';
const deptOptions = ref<RaDeptTreeOption[]>([]);
const deptName = ref('');
const deptTreeRef = ref<any>();
const deptTreeProps = { label: 'name', children: 'children' };
const deptTreeOptions = computed<RaDeptTreeOption[]>(() => [
  {
    id: ALL_DEPT_ID,
    name: '全部部门',
    children: deptOptions.value
  }
]);

const userRef = ref<FormInstance>();
const queryForm = ref<FormInstance>();

// 证书相关
const certPem = ref<string>('');
const showCertDialog = ref(false);
const detailOpen = ref(false);
const detail = ref<any>({});
const certFormRef = ref<FormInstance>();
const certDialog = reactive({
  visible: false,
  loading: false
});
const certOptions = ref<RaAdminCertOptions>({ roots: [], profileCount: 0 });
const certProviders = ref<string[]>([]);
const certDevices = ref<string[]>([]);
const certApps = ref<string[]>([]);
let skfClientPromise: Promise<SKFClient> | null = null;

const certForm = reactive({
  userId: '',
  username: '',
  mobile: '',
  mail: '',
  rootId: '',
  profileId: '',
  provider: '',
  device: '',
  appName: '',
  containerName: '',
  pin: '',
  subjectItems: [] as any[]
});

const certRules: FormRules = {
  rootId: [{ required: true, message: '请选择根证书', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  provider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入 User PIN', trigger: 'blur' }]
};

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
    roleId: undefined,
    roleIds: RA_BIZ_ROLE_IDS
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
    mobile: [{ pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: '请输入正确的手机号码', trigger: 'blur' }],
    deptId: [{ required: true, message: '所属部门不能为空', trigger: 'change' }],
    roleIds: [{ required: true, type: 'array', min: 1, message: '业务角色不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

function normalizeUserForm() {
  form.value.mail = form.value.mail?.trim() || undefined;
  form.value.mobile = form.value.mobile?.trim() || undefined;
}

function formatStatus(status: string | number | undefined) {
  const dict = sys_common_status.value.find((item: any) => String(item.value) === String(status));
  return dict?.label || '-';
}

const certRoots = computed(() => certOptions.value.roots || []);
const certProfileOptions = computed(() => {
  const root = certRoots.value.find((item) => String(item.id) === String(certForm.rootId));
  return root?.profiles || [];
});

function randomContainerName(_username: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `admin-${Date.now().toString(36)}-${suffix}`;
}

function buildDefaultSubjectItems(row: any) {
  return sortSubjectItems([
    { type: 'country', value: 'CN' },
    { type: 'organization', value: '注册认证中心' },
    { type: 'organizationalUnit', value: '业务管理员' },
    { type: 'commonName', value: row.username || '' },
    { type: 'emailAddress', value: row.mail || '' }
  ]);
}

function buildSubject(items: any[]) {
  return items
    .filter((item: any) => item.value)
    .map((item: any) => {
      const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
      return `${key}=${item.value}`;
    })
    .join(',');
}

function formatToPem(cert: string) {
  if (!cert || cert.includes('BEGIN CERTIFICATE')) {
    return cert;
  }
  const clean = cert.replace(/\s+/g, '');
  const lines = clean.match(/.{1,64}/g)?.join('\n') || clean;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
}

async function loadCertOptions() {
  const res = await getAdminCertOptions();
  const data = unwrapRaData<RaAdminCertOptions>(res) || { roots: [], profileCount: 0 };
  certOptions.value = {
    roots: data.roots || [],
    profileCount: Number(data.profileCount ?? 0)
  };
}

function pickAdminProfile(root?: RaAdminCertRootOption) {
  return root?.profiles?.find((profile) => profile.name === '管理员证书模板') || root?.profiles?.[0];
}

function handleCertRootChange() {
  const root = certRoots.value.find((item) => String(item.id) === String(certForm.rootId));
  const profile = pickAdminProfile(root);
  certForm.profileId = profile ? String(profile.id) : '';
}

async function loadDeptOptions() {
  const res = await listDeptSelectTree({});
  deptOptions.value = normalizeDeptTree((res.data || []) as RaDeptTreeOption[]);
}

function normalizeDeptTree(nodes: RaDeptTreeOption[]): RaDeptTreeOption[] {
  return nodes.map((node) => ({
    ...node,
    id: String(node.id),
    pid: node.pid == null ? undefined : String(node.pid),
    children: node.children ? normalizeDeptTree(node.children) : undefined
  }));
}

watch(
  deptName,
  (value) => {
    deptTreeRef.value?.filter(value);
  },
  { flush: 'post' }
);

function filterDeptNode(value: string, data: RaDeptTreeOption) {
  if (!value) {
    return true;
  }
  if (data.id === ALL_DEPT_ID) {
    return true;
  }
  return data.name?.includes(value);
}

function handleDeptNodeClick(data: RaDeptTreeOption) {
  queryParams.value.deptId = data.id === ALL_DEPT_ID ? undefined : data.id;
  handleQuery();
}

/** 查询用户列表 */
function getList() {
  loading.value = true;
  isDataLoaded.value = false;
  queryParams.value.roleIds = queryParams.value.roleId ? undefined : RA_BIZ_ROLE_IDS;
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

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = [];
  queryForm.value?.resetFields();
  queryParams.value.roleId = undefined;
  queryParams.value.roleIds = RA_BIZ_ROLE_IDS;
  queryParams.value.deptId = undefined;
  deptTreeRef.value?.setCurrentKey(ALL_DEPT_ID);
  handleQuery();
}

/** 删除按钮操作 */
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

/** 分配角色 */
function handleAuthRole(row: any) {
  const userId = row.id;
  proxy?.$router.push({
    path: '/ra-admin/user-auth/role/' + userId
  });
}

function handleDetail(row: any) {
  const userId = row.id;
  getUser(userId).then((response) => {
    detail.value = response.data || {};
    detailOpen.value = true;
  });
}

function handleViewDetailCert() {
  certPem.value = detail.value.certPem;
  showCertDialog.value = true;
}

/** 选择条数  */
function handleSelectionChange(selection: any) {
  ids.value = selection.map((item: any) => item.id);
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
    id: undefined,
    deptId: undefined,
    username: '',
    nickName: undefined,
    password: '',
    mobile: undefined,
    mail: undefined,
    sex: undefined,
    status: 0,
    remark: undefined,
    postIds: [],
    roleIds: [...RA_DEFAULT_BIZ_ROLE_IDS]
  };
  userRef.value?.resetFields();
  certPem.value = '';
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  reset();
}

/** 新增按钮操作 */
async function handleAdd() {
  reset();
  await loadDeptOptions();
  if (queryParams.value.deptId) {
    form.value.deptId = String(queryParams.value.deptId);
  }
  open.value = true;
  title.value = '添加业务管理员';
  form.value.password = initPassword.value || '';
}

/** 修改按钮操作 */
async function handleUpdate(row: any) {
  reset();
  await loadDeptOptions();
  const userId = row.id || ids.value[0];
  getUser(userId).then((response) => {
    form.value = response.data as any;
    form.value.deptId = form.value.deptId == null ? undefined : String(form.value.deptId);
    form.value.postIds = [];
    const roleIds = (form.value.roleIds || []).map((roleId: any) => String(roleId));
    const bizRoleIds = roleIds.filter((roleId) => raBizRoleOptions.some((role) => role.value === roleId));
    form.value.roleIds = bizRoleIds.length > 0 ? bizRoleIds : [...RA_DEFAULT_BIZ_ROLE_IDS];
    open.value = true;
    title.value = '修改业务管理员';
    form.value.password = '';
  });
}

/** 提交按钮 */
function submitForm() {
  proxy?.$refs['userRef'].validate(async (valid: any) => {
    if (valid) {
      form.value.roleIds = (form.value.roleIds || []).map((roleId: any) => String(roleId));
      normalizeUserForm();
      if (form.value.id != undefined) {
        updateUser(form.value).then(() => {
          proxy?.$modal.msgSuccess('修改成功');
          open.value = false;
          getList();
        });
      } else {
        try {
          await addUser(form.value);
        } catch (error) {
          ElMessage.error('新增业务管理员失败');
          return;
        }
        proxy?.$modal.msgSuccess('新增成功');
        open.value = false;
        getList();
      }
    }
  });
}

async function handleIssueCert(row: any) {
  try {
    await loadCertOptions();
    if (certOptions.value.profileCount === 0 || certRoots.value.length === 0) {
      ElMessage.error('请先同步 CA，获取已授权的根证书和管理员证书模板');
      return;
    }
    const defaultRoot = certRoots.value.find((root) => pickAdminProfile(root)?.name === '管理员证书模板') || certRoots.value[0];
    const defaultProfile = pickAdminProfile(defaultRoot);
    certForm.userId = String(row.id);
    certForm.username = row.username || '';
    certForm.mobile = row.mobile || '';
    certForm.mail = row.mail || '';
    certForm.rootId = defaultRoot ? String(defaultRoot.id) : '';
    certForm.profileId = defaultProfile ? String(defaultProfile.id) : '';
    certForm.provider = '';
    certForm.device = '';
    certForm.appName = '';
    certForm.containerName = randomContainerName(row.username);
    certForm.pin = '';
    certForm.subjectItems = buildDefaultSubjectItems(row);
    certDialog.visible = true;
    await refreshCertProviders();
  } catch (error: any) {
    ElMessage.error('加载签证信息失败: ' + (error.message || error));
  }
}

function getSkfClient(): Promise<SKFClient> {
  if (!skfClientPromise) {
    skfClientPromise = new Promise((resolve, reject) => {
      const client = new SKFClient('ws://127.0.0.1:9001');
      const timeout = setTimeout(() => {
        skfClientPromise = null;
        reject(new Error('连接 SKF 服务超时'));
      }, 5000);
      client
        .connect()
        .then(() => {
          clearTimeout(timeout);
          resolve(client);
        })
        .catch((err: any) => {
          clearTimeout(timeout);
          skfClientPromise = null;
          reject(err);
        });
      client.on('disconnect', () => {
        skfClientPromise = null;
      });
      client.on('error', () => {
        if (!client.isConnected()) {
          skfClientPromise = null;
        }
      });
    });
  }
  return skfClientPromise;
}

async function refreshCertProviders() {
  try {
    const skf = await getSkfClient();
    const providers = await skf.enumProvider();
    certProviders.value = providers;
    certForm.provider = providers[0] || '';
    if (certForm.provider) {
      await onCertProviderChange();
    } else {
      certDevices.value = [];
      certApps.value = [];
      certForm.device = '';
      certForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('SKF 服务连接失败: ' + (e.message || e));
  }
}

async function onCertProviderChange() {
  if (!certForm.provider) {
    return;
  }
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(certForm.provider);
    certDevices.value = devices;
    certForm.device = devices[0] || '';
    if (certForm.device) {
      await onCertDeviceChange();
    } else {
      certApps.value = [];
      certForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('获取设备列表失败: ' + (e.message || e));
  }
}

async function onCertDeviceChange() {
  if (!certForm.provider || !certForm.device) {
    return;
  }
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(certForm.provider, certForm.device);
    certApps.value = apps;
    certForm.appName = apps[0] || '';
  } catch (e: any) {
    ElMessage.error('获取应用列表失败: ' + (e.message || e));
  }
}

async function submitCertForm() {
  certFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || certDialog.loading) {
      return;
    }
    certDialog.loading = true;
    try {
      const skf = await getSkfClient();
      const subject = buildSubject(certForm.subjectItems);
      ElMessage.info('正在验证 PIN...');
      await skf.checkPIN(`${certForm.provider}/${certForm.device}/${certForm.appName}`, certForm.pin);

      ElMessage.info('正在从 USB KEY 生成 CSR...');
      const csrRes = await skf.createPKCS10(certForm.provider, certForm.device, certForm.appName, subject, 'SM2', 256, certForm.containerName);

      ElMessage.info('正在请求 CA 签发证书...');
      const issueRes = await issueAdminAccountCert({
        rootId: certForm.rootId,
        profileId: certForm.profileId,
        role: '业务管理员',
        subject,
        csrPem: csrRes.pem
      });
      const issueData = unwrapRaData<{ cert: string; serialNumber?: string; certSn?: string }>(issueRes) || ({} as any);
      const issuedCertPem = formatToPem(issueData.cert || '');
      if (!issuedCertPem) {
        throw new Error('CA 未返回签发证书');
      }

      ElMessage.info('正在将证书写入 USB KEY...');
      await skf.importCertificate(certForm.provider, certForm.device, certForm.appName, csrRes.container, true, issuedCertPem);

      ElMessage.info('正在更新业务管理员证书信息...');
      const userDataRes = await getUser(certForm.userId);
      const userData = userDataRes.data as any;
      const userRoleIds = (userData.roleIds || [])
        .map((roleId: any) => String(roleId))
        .filter((roleId: string) => raBizRoleOptions.some((role) => role.value === roleId));
      await updateUser({
        id: userData.id,
        userId: userData.id,
        deptId: userData.deptId,
        username: userData.username,
        password: '',
        mobile: userData.mobile,
        mail: userData.mail,
        status: userData.status,
        remark: userData.remark || '',
        postIds: [],
        roleIds: userRoleIds.length > 0 ? userRoleIds : [...RA_DEFAULT_BIZ_ROLE_IDS],
        certSn: issueData.serialNumber || issueData.certSn || '',
        cert: issuedCertPem
      } as any);

      ElMessage.success('签证成功，证书已写入 USB KEY');
      certDialog.visible = false;
      await getList();
    } catch (error: any) {
      ElMessage.error('签证失败: ' + (error.message || error));
    } finally {
      certDialog.loading = false;
    }
  });
}

function closeCertDialog() {
  certDialog.visible = false;
  certDialog.loading = false;
  certFormRef.value?.resetFields();
}

async function initPage() {
  await loadDeptOptions();
  nextTick(() => {
    deptTreeRef.value?.setCurrentKey(ALL_DEPT_ID);
  });
  getList();
}

initPage();
</script>

<style scoped lang="scss">
.ra-admin-page {
  .dept-tree-card {
    margin-bottom: 12px;
  }

  .dept-tree-title {
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  .dept-tree {
    margin-top: 10px;
    min-height: 360px;
    max-height: calc(100vh - 220px);
    overflow: auto;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

:deep(.ra-user-detail-dialog .el-dialog__body) {
  padding-top: 8px;
}

:deep(.ra-user-detail .el-descriptions__label) {
  width: 108px;
  color: var(--el-text-color-regular);
  font-weight: 600;
  background: var(--el-fill-color-lighter);
}

:deep(.ra-user-detail .el-descriptions__content) {
  min-width: 180px;
  color: var(--el-text-color-primary);
  line-height: 22px;
  word-break: break-word;
}

.detail-mono {
  display: inline-block;
  max-width: 100%;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.detail-remark {
  display: block;
  min-height: 22px;
  white-space: pre-wrap;
}

.cert-inline-control {
  display: flex;
  gap: 8px;
  width: 100%;
}

:deep(.el-divider__text) {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-color-primary);
}

:deep(.el-dialog__body) {
  padding-top: 8px;
}
</style>
