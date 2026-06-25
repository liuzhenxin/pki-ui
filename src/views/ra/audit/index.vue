<template>
  <div class="app-container ra-audit-page">
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
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['ra:audit:manager']">新增审计员</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['ra:audit:manager']">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['ra:audit:manager']">删除</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>

        <el-table v-loading="loading" border :data="userList" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="50" align="center" />
          <el-table-column label="用户名称" align="center" prop="username" :show-overflow-tooltip="true" />
          <el-table-column label="手机号码" align="center" prop="mobile" width="120" />
          <el-table-column label="邮箱" align="center" prop="mail" width="200" :show-overflow-tooltip="true" />
          <el-table-column label="状态" align="center" width="80">
            <template #default="scope">
              <el-switch
                v-model="scope.row.status"
                :active-value="0"
                :inactive-value="1"
                active-color="#13ce66"
                inactive-color="#ff4949"
                @change="(val: number) => handleStatusChange(scope.row, val)"
              />
            </template>
          </el-table-column>
          <el-table-column label="证书状态" align="center" prop="certSn" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.certSn ? 'success' : 'info'">{{ scope.row.certSn ? '已签发' : '未签发' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" width="180">
            <template #default="scope">
              <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="260" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['ra:audit:manager']">修改</el-button>
              <el-button v-if="!scope.row.certSn" link type="success" icon="Document" @click="handleIssueCert(scope.row)" v-hasPermi="['ra:audit:manager']">签发证书</el-button>
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['ra:audit:manager']">删除</el-button>
              <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)" v-hasPermi="['ra:audit:manager']">重置密码</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
      </el-col>
    </el-row>

    <!-- 添加/修改审计员对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="userRef" :model="form" :rules="rules" label-width="80px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="mobile">
              <el-input v-model="form.mobile" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="邮箱" prop="mail">
              <el-input v-model="form.mail" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户密码" prop="password" v-if="!form.userId">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="20" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="所属部门" prop="deptId">
              <el-tree-select
                v-model="form.deptId"
                :data="deptOptions"
                :props="{ label: 'name', value: 'id', children: 'children' }"
                placeholder="请选择所属部门"
                check-strictly
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="0">正常</el-radio>
                <el-radio :value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入内容" />
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

    <!-- 签发证书对话框 -->
    <el-dialog v-model="certDialog.visible" title="签发审计员证书" width="800px" append-to-body :close-on-click-modal="false">
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
            <el-input v-model="certForm.containerName" placeholder="格式: audit-xxxxxx" style="flex: 1" />
            <el-tooltip content="随机生成" placement="top">
              <el-button icon="Refresh" circle @click="certForm.containerName = randomContainerName('audit')" />
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

    <!-- 证书详情弹窗 -->
    <el-dialog v-model="showCertDialog" title="证书详情" width="60%">
      <X509Cert v-if="showCertDialog" :certPem="certPem" />
    </el-dialog>
  </div>
</template>

<script setup name="RaAuditManager" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted, nextTick, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { FormInstance, FormRules } from 'element-plus';
import { listUser, getUser, delUser, updateUser, resetUserPwd, changeStatus, addUser } from '@/api/ra/user';
import { UserForm, UserQuery, UserVO } from '@/api/system/user/types';
import { listDeptSelectTree } from '@/api/ra/dept';
import { RaDeptTreeOption } from '@/api/ra/dept/types';
import { getAdminCertOptions, issueAdminAccountCert, unwrapRaData, RaAdminCertOptions, RaAdminCertRootOption } from '@/api/ra/init';
import SKFClient from '@/api/skf/skf_api';
import X509Cert from '@/components/X509Cert/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_common_status } = toRefs<any>(proxy!.useDict('sys_common_status'));

// 审计员角色 ID（更新后角色模型）
const RA_AUDITOR_ROLE_ID = '506';
const RA_AUDITOR_ROLE_IDS = [RA_AUDITOR_ROLE_ID];
const ALL_DEPT_ID = '__ALL__';

const userList = ref<UserVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<number | string>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const isDataLoaded = ref(false);

// 证书相关
const certPem = ref('');
const showCertDialog = ref(false);
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

const deptName = ref('');
const deptTreeRef = ref<any>();
const deptTreeProps = { label: 'name', children: 'children' };
const deptOptions = ref<RaDeptTreeOption[]>([]);
const deptTreeOptions = computed<RaDeptTreeOption[]>(() => [
  {
    id: ALL_DEPT_ID,
    name: '全部部门',
    children: deptOptions.value
  }
]);

const userRef = ref<FormInstance>();
const queryForm = ref<FormInstance>();

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
    roleId: RA_AUDITOR_ROLE_ID,
    roleIds: RA_AUDITOR_ROLE_IDS
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
    deptId: [{ required: true, message: '所属部门不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

// 证书选项计算属性
const certRoots = computed(() => certOptions.value.roots || []);
const certProfileOptions = computed(() => {
  const root = certRoots.value.find((item) => String(item.id) === String(certForm.rootId));
  return root?.profiles || [];
});

function randomContainerName(_username: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `audit-${Date.now().toString(36)}-${suffix}`;
}

function buildDefaultSubjectItems(row: any) {
  return sortSubjectItems([
    { type: 'country', value: 'CN' },
    { type: 'organization', value: '注册认证中心' },
    { type: 'organizationalUnit', value: '审计员' },
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
  deptOptions.value = (res.data || []) as RaDeptTreeOption[];
}

watch(
  deptName,
  (value) => {
    deptTreeRef.value?.filter(value);
  },
  { flush: 'post' }
);

function filterDeptNode(value: string, data: RaDeptTreeOption) {
  if (!value) return true;
  if (data.id === ALL_DEPT_ID) return true;
  return data.name?.includes(value);
}

function handleDeptNodeClick(data: RaDeptTreeOption) {
  queryParams.value.deptId = data.id === ALL_DEPT_ID ? undefined : data.id;
  handleQuery();
}

/** 查询审计员列表 */
function getList() {
  loading.value = true;
  isDataLoaded.value = false;
  queryParams.value.roleIds = RA_AUDITOR_ROLE_IDS;
  listUser(queryParams.value).then((res) => {
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
  queryForm.value?.resetFields();
  queryParams.value.roleId = RA_AUDITOR_ROLE_ID;
  queryParams.value.roleIds = RA_AUDITOR_ROLE_IDS;
  queryParams.value.deptId = undefined;
  deptTreeRef.value?.setCurrentKey(ALL_DEPT_ID);
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

/** 用户状态修改 */
function handleStatusChange(row: any, newStatus: number) {
  if (!isDataLoaded.value) return;
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

/** 删除按钮操作 */
function handleDelete(row: any) {
  const userIds = row.id || ids.value;
  const username = row.username || '选中的用户';
  proxy?.$modal
    .confirm('确认要删除审计员"' + username + '"吗？')
    .then(function () {
      return delUser(userIds);
    })
    .then(() => {
      getList();
      proxy?.$modal.msgSuccess('删除成功');
    })
    .catch(() => {});
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
    roleIds: [...RA_AUDITOR_ROLE_IDS]
  };
  userRef.value?.resetFields();
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
    form.value.deptId = Number(queryParams.value.deptId);
  }
  open.value = true;
  title.value = '添加审计员';
}

/** 修改按钮操作 */
async function handleUpdate(row: any) {
  reset();
  await loadDeptOptions();
  const userId = row.id || ids.value[0];
  getUser(userId).then((response) => {
    form.value = response.data as any;
    form.value.postIds = [];
    form.value.roleIds = [...RA_AUDITOR_ROLE_IDS];
    open.value = true;
    title.value = '修改审计员';
    form.value.password = '';
  });
}

/** 提交按钮 */
function submitForm() {
  proxy?.$refs['userRef'].validate(async (valid: any) => {
    if (valid) {
      form.value.roleIds = [...RA_AUDITOR_ROLE_IDS];
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
          ElMessage.error('新增审计员失败');
          return;
        }
        proxy?.$modal.msgSuccess('新增成功');
        open.value = false;
        getList();
      }
    }
  });
}

/** 签发证书按钮操作 */
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
  if (!certForm.provider) return;
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
  if (!certForm.provider || !certForm.device) return;
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
    if (!valid || certDialog.loading) return;
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
        role: '审计员',
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

      // 更新用户证书信息
      const serialNumber = issueData.serialNumber || issueData.certSn || '';
      const userDataRes = await getUser(certForm.userId);
      const userData = userDataRes.data as any;
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
        roleIds: [...RA_AUDITOR_ROLE_IDS],
        certSn: serialNumber,
        cert: issuedCertPem
      });

      ElMessage.success('审计员证书签发成功');
      certDialog.visible = false;
      getList();
    } catch (error: any) {
      ElMessage.error('证书签发失败: ' + (error.message || error));
    } finally {
      certDialog.loading = false;
    }
  });
}

/** 关闭签发证书对话框 */
function closeCertDialog() {
  certDialog.visible = false;
  certFormRef.value?.resetFields();
}

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.ra-audit-page {
  padding: 0;

  .dept-tree-card {
    .dept-tree-title {
      font-size: 14px;
      font-weight: bold;
    }

    .dept-tree {
      margin-top: 10px;
      max-height: calc(100vh - 260px);
      overflow-y: auto;
    }
  }

  .mb8 {
    margin-bottom: 10px;
  }

  .dialog-footer {
    text-align: right;
  }

  .cert-inline-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
