<template>
  <div class="app-container ra-apply-page">
    <el-form ref="queryFormRef" v-show="showSearch" :model="queryParams" :inline="true" label-width="80px">
      <el-form-item label="申请用户" prop="userName">
        <el-input v-model="queryParams.userName" placeholder="请输入申请用户" clearable style="width: 220px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="申请状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable style="width: 180px">
          <el-option v-for="item in applyStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="申请日期">
        <el-date-picker
          v-model="dateRange"
          value-format="YYYY-MM-DD"
          type="daterange"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增申请</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="applyList" border>
      <el-table-column label="申请编号" prop="id" align="center" width="170" />
      <el-table-column label="申请用户" prop="userName" min-width="150" show-overflow-tooltip />
      <el-table-column label="所属部门" prop="deptName" min-width="150" show-overflow-tooltip />
      <el-table-column label="用户类别" align="center" width="110">
        <template #default="{ row }">
          <el-tag type="info">{{ userCategoryLabel(row.userCategory) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="根证书" prop="rootName" min-width="180" show-overflow-tooltip />
      <el-table-column label="签发类型" align="center" width="110">
        <template #default="{ row }">
          <el-tag>{{ certModeLabel(row.certMode) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="证书模板" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ profileText(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ row.statusName || statusName(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" prop="createTime" align="center" width="170">
        <template #default="{ row }">
          <span>{{ parseTime(row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="90" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog v-model="open" title="新增证书申请" width="620px" append-to-body>
      <el-form ref="applyFormRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="用户类别" prop="userCategory">
          <el-select v-model="form.userCategory" clearable placeholder="请选择用户类别" style="width: 100%" @change="handleUserCategoryChange">
            <el-option v-for="item in userCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请用户" prop="userId">
          <el-input :model-value="selectedUserText" readonly placeholder="请选择申请用户">
            <template #append>
              <el-button icon="Search" @click="openUserPicker">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="根证书" prop="rootId">
          <el-select v-model="form.rootId" filterable clearable placeholder="请选择根证书" style="width: 100%" @change="handleRootChange">
            <el-option v-for="root in rootOptions" :key="String(root.id)" :label="rootLabel(root)" :value="String(root.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="签发类型" prop="certMode">
          <el-radio-group v-model="form.certMode" @change="handleCertModeChange">
            <el-radio-button label="single">单证书</el-radio-button>
            <el-radio-button label="dual" :disabled="!isSm2Root">双证书</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.certMode !== 'dual'" label="证书模板" prop="profileId">
          <el-select v-model="form.profileId" filterable clearable placeholder="请选择证书模板" style="width: 100%" @change="handleProfileChange">
            <el-option v-for="profile in profileOptions" :key="String(profile.id)" :label="profile.name" :value="String(profile.id)" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="证书模板" prop="dualProfileIndex">
          <el-select v-model="form.dualProfileIndex" filterable clearable placeholder="请选择双证书模板" style="width: 100%" @change="handleDualProfileChange">
            <el-option v-for="(pair, index) in dualProfileOptions" :key="index" :label="dualPairLabel(pair)" :value="index" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitLoading" @click="submitForm">确 定</el-button>
          <el-button @click="open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="userPickerOpen" title="选择申请用户" width="980px" append-to-body destroy-on-close class="ra-user-picker-dialog">
      <div class="user-picker-layout">
        <aside class="user-picker-dept">
          <el-input v-model="deptFilter" placeholder="请输入部门名称" prefix-icon="Search" clearable />
          <el-tree
            ref="deptTreeRef"
            class="user-picker-tree"
            node-key="id"
            :data="deptOptions"
            :props="deptTreeProps"
            :expand-on-click-node="false"
            :filter-node-method="filterDeptNode"
            highlight-current
            default-expand-all
            @node-click="handlePickerDeptClick"
          />
        </aside>
        <section class="user-picker-main">
          <el-form :model="userPickerQuery" :inline="true" label-width="72px" class="user-picker-query">
            <el-form-item label="用户名称">
              <el-input v-model="userPickerQuery.username" placeholder="请输入用户名称" clearable style="width: 180px" @keyup.enter="handleUserPickerQuery" />
            </el-form-item>
            <el-form-item label="手机号码">
              <el-input v-model="userPickerQuery.mobile" placeholder="请输入手机号码" clearable style="width: 180px" @keyup.enter="handleUserPickerQuery" />
            </el-form-item>
            <el-form-item label="用户类别">
              <el-select v-model="userPickerQuery.userCategory" placeholder="全部类别" clearable style="width: 150px">
                <el-option v-for="item in userCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleUserPickerQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetUserPickerQuery">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table v-loading="userPickerLoading" :data="userPickerList" border height="360" highlight-current-row @row-dblclick="selectPickerUser">
            <el-table-column label="用户名称" prop="username" min-width="150" show-overflow-tooltip />
            <el-table-column label="所属部门" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <span>{{ userDeptName(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="用户类别" width="110" align="center">
              <template #default="{ row }">
                <el-tag type="info">{{ userCategoryLabel(row.userCategory) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="手机号" prop="mobile" width="130" show-overflow-tooltip />
            <el-table-column label="邮箱" prop="mail" min-width="170" show-overflow-tooltip />
            <el-table-column label="操作" width="90" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="selectPickerUser(row)">选择</el-button>
              </template>
            </el-table-column>
          </el-table>

          <pagination
            v-show="userPickerTotal > 0"
            v-model:page="userPickerQuery.pageNum"
            v-model:limit="userPickerQuery.pageSize"
            :total="userPickerTotal"
            @pagination="loadPickerUsers"
          />
        </section>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeUserPicker">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailOpen" title="证书申请详情" width="620px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="申请编号">{{ detail.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请用户">{{ detail.userName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属部门">{{ detail.deptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户类别">{{ userCategoryLabel(detail.userCategory) }}</el-descriptions-item>
        <el-descriptions-item label="根证书">{{ detail.rootName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="根证书算法">{{ detail.rootAlgorithm || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签发类型">{{ certModeLabel(detail.certMode) }}</el-descriptions-item>
        <el-descriptions-item label="证书模板">{{ profileText(detail) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(detail.status)">{{ detail.statusName || statusName(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ parseTime(detail.createTime) || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup name="RaApply" lang="ts">
import { pageRaApply, getRaApply, saveRaApply, RaApplyForm, RaApplyVO } from '@/api/ra/apply';
import { listUser } from '@/api/ra/user';
import { listDeptSelectTree } from '@/api/ra/dept';
import { RaDeptTreeOption } from '@/api/ra/dept/types';
import { listMyUserCertScopeOptions, RaUserCertScopeDualPair, RaUserCertScopeProfile, RaUserCertScopeRoot } from '@/api/ra/userCertScope';
import { FormInstance, FormRules } from 'element-plus';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const applyList = ref<RaApplyVO[]>([]);
const rootOptions = ref<RaUserCertScopeRoot[]>([]);
const deptOptions = ref<RaDeptTreeOption[]>([]);
const deptFilter = ref('');
const open = ref(false);
const userPickerOpen = ref(false);
const detailOpen = ref(false);
const loading = ref(false);
const userPickerLoading = ref(false);
const submitLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const userPickerTotal = ref(0);
const dateRange = ref<string[]>([]);
const detail = ref<Partial<RaApplyVO>>({});
const userPickerList = ref<any[]>([]);

const queryFormRef = ref<FormInstance>();
const applyFormRef = ref<FormInstance>();
const deptTreeRef = ref<any>();
const deptTreeProps = { label: 'name', children: 'children' };

const applyStatusOptions = [
  { label: '新申请', value: 0 },
  { label: '待签发', value: 1 },
  { label: '审核拒绝', value: 2 },
  { label: '已签发', value: 3 }
];
const userCategoryOptions = [
  { label: '个人用户', value: 'individual' },
  { label: '企业用户', value: 'organization' },
  { label: '设备用户', value: 'device' }
];

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  userName: '',
  status: '' as number | string,
  startTime: undefined as string | undefined,
  endTime: undefined as string | undefined
});

const userPickerQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  username: '',
  mobile: '',
  userCategory: undefined as string | undefined,
  deptId: undefined as string | number | undefined,
  superAdmin: 0
});

const form = reactive<RaApplyForm>({
  userId: undefined,
  userName: undefined,
  deptName: undefined,
  userCategory: undefined,
  rootId: undefined,
  rootName: undefined,
  rootAlgorithm: undefined,
  certMode: 'single',
  profileId: undefined,
  profileName: undefined,
  dualProfileIndex: undefined,
  signProfileId: undefined,
  signProfileName: undefined,
  encryptProfileId: undefined,
  encryptProfileName: undefined
});

const rules: FormRules = {
  userCategory: [{ required: true, message: '用户类别不能为空', trigger: 'change' }],
  userId: [{ required: true, message: '申请用户不能为空', trigger: 'change' }],
  rootId: [{ required: true, message: '根证书不能为空', trigger: 'change' }],
  certMode: [{ required: true, message: '签发类型不能为空', trigger: 'change' }],
  profileId: [{ validator: validateProfile, trigger: 'change' }],
  dualProfileIndex: [{ validator: validateDualProfile, trigger: 'change' }]
};

const selectedUserText = computed(() => {
  if (!form.userId) {
    return '';
  }
  const parts = [form.userName, userCategoryLabel(form.userCategory), form.deptName].filter((item) => item && item !== '-');
  return parts.join(' / ');
});

const selectedRoot = computed<RaUserCertScopeRoot | undefined>(() => {
  const rootId = form.rootId === undefined ? undefined : String(form.rootId);
  return rootOptions.value.find((root) => String(root.id) === rootId);
});

const isSm2Root = computed(() => (selectedRoot.value?.algorithm || form.rootAlgorithm || '').toUpperCase() === 'SM2');

const profileOptions = computed<RaUserCertScopeProfile[]>(() => {
  const rootId = form.rootId === undefined ? undefined : String(form.rootId);
  return rootOptions.value.find((root) => String(root.id) === rootId)?.profiles || [];
});

const dualProfileOptions = computed<RaUserCertScopeDualPair[]>(() => {
  const rootId = form.rootId === undefined ? undefined : String(form.rootId);
  return rootOptions.value.find((root) => String(root.id) === rootId)?.dualProfiles || [];
});

function validateProfile(_: any, value: any, callback: any) {
  if (form.certMode !== 'dual' && !value) {
    callback(new Error('证书模板不能为空'));
    return;
  }
  callback();
}

function validateDualProfile(_: any, value: any, callback: any) {
  if (form.certMode === 'dual' && (value === undefined || value === null || value === '')) {
    callback(new Error('双证书模板不能为空'));
    return;
  }
  callback();
}

function parsePage(res: any) {
  const page = res.data || res;
  return {
    rows: page.rows || page.records || [],
    total: page.total || 0
  };
}

const deptNameMap = computed(() => {
  const map = new Map<string, string>();
  const walk = (list: RaDeptTreeOption[]) => {
    list.forEach((dept) => {
      map.set(String(dept.id), dept.name);
      if (dept.children?.length) {
        walk(dept.children);
      }
    });
  };
  walk(deptOptions.value);
  return map;
});

async function getList() {
  loading.value = true;
  try {
    queryParams.startTime = dateRange.value?.[0];
    queryParams.endTime = dateRange.value?.[1];
    const res = await pageRaApply(queryParams);
    const page = parsePage(res);
    applyList.value = page.rows;
    total.value = page.total;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  dateRange.value = [];
  queryParams.startTime = undefined;
  queryParams.endTime = undefined;
  handleQuery();
}

function resetForm() {
  form.userId = undefined;
  form.userName = undefined;
  form.deptName = undefined;
  form.userCategory = undefined;
  form.rootId = undefined;
  form.rootName = undefined;
  form.rootAlgorithm = undefined;
  form.certMode = 'single';
  form.profileId = undefined;
  form.profileName = undefined;
  form.dualProfileIndex = undefined;
  form.signProfileId = undefined;
  form.signProfileName = undefined;
  form.encryptProfileId = undefined;
  form.encryptProfileName = undefined;
  applyFormRef.value?.resetFields();
}

async function loadRootOptions() {
  const res = await listMyUserCertScopeOptions();
  rootOptions.value = (res.data || []) as RaUserCertScopeRoot[];
}

async function loadDeptOptions() {
  if (deptOptions.value.length > 0) {
    return;
  }
  const res = await listDeptSelectTree({});
  deptOptions.value = (res.data || []) as RaDeptTreeOption[];
}

async function handleAdd() {
  resetForm();
  await Promise.all([loadDeptOptions(), loadRootOptions()]);
  open.value = true;
}

function handleUserCategoryChange() {
  form.userId = undefined;
  form.userName = undefined;
  form.deptName = undefined;
  userPickerQuery.userCategory = form.userCategory;
  if (userPickerOpen.value) {
    handleUserPickerQuery();
  }
}

async function openUserPicker() {
  await loadDeptOptions();
  userPickerQuery.pageNum = 1;
  userPickerQuery.username = '';
  userPickerQuery.mobile = '';
  userPickerQuery.userCategory = form.userCategory;
  userPickerQuery.deptId = undefined;
  deptFilter.value = '';
  userPickerOpen.value = true;
  await nextTick();
  deptTreeRef.value?.setCurrentKey(undefined);
  await loadPickerUsers();
}

async function loadPickerUsers() {
  userPickerLoading.value = true;
  try {
    const query = {
      pageNum: userPickerQuery.pageNum,
      pageSize: userPickerQuery.pageSize,
      username: userPickerQuery.username,
      mobile: userPickerQuery.mobile,
      userCategory: userPickerQuery.userCategory,
      deptId: userPickerQuery.deptId,
      superAdmin: 0
    };
    const res = await listUser(query as any);
    const page = parsePage(res);
    userPickerList.value = page.rows;
    userPickerTotal.value = Number(page.total || 0);
  } finally {
    userPickerLoading.value = false;
  }
}

function handleUserPickerQuery() {
  userPickerQuery.pageNum = 1;
  loadPickerUsers();
}

function resetUserPickerQuery() {
  userPickerQuery.pageNum = 1;
  userPickerQuery.username = '';
  userPickerQuery.mobile = '';
  userPickerQuery.userCategory = form.userCategory;
  userPickerQuery.deptId = undefined;
  deptFilter.value = '';
  deptTreeRef.value?.setCurrentKey(undefined);
  loadPickerUsers();
}

function filterDeptNode(value: string, data: RaDeptTreeOption) {
  if (!value) {
    return true;
  }
  return data.name?.includes(value);
}

function handlePickerDeptClick(data: RaDeptTreeOption) {
  userPickerQuery.deptId = data.id;
  handleUserPickerQuery();
}

function selectPickerUser(user: any) {
  form.userId = String(user.id);
  form.userName = user.username || user.userName || '';
  form.deptName = userDeptName(user);
  form.userCategory = user.userCategory || form.userCategory;
  userPickerQuery.userCategory = form.userCategory;
  closeUserPicker();
  applyFormRef.value?.clearValidate(['userId', 'userCategory']);
}

function closeUserPicker() {
  userPickerOpen.value = false;
}

function handleRootChange(rootId?: string | number) {
  const root = rootOptions.value.find((item) => String(item.id) === String(rootId));
  form.rootName = root?.name;
  form.rootAlgorithm = root?.algorithm;
  if ((root?.algorithm || '').toUpperCase() !== 'SM2') {
    form.certMode = 'single';
  }
  clearProfiles();
}

function handleCertModeChange() {
  clearProfiles();
}

function clearProfiles() {
  form.profileId = undefined;
  form.profileName = undefined;
  form.dualProfileIndex = undefined;
  form.signProfileId = undefined;
  form.signProfileName = undefined;
  form.encryptProfileId = undefined;
  form.encryptProfileName = undefined;
}

function handleProfileChange(profileId?: string | number) {
  const profile = profileOptions.value.find((item) => String(item.id) === String(profileId));
  form.profileName = profile?.name;
}

function handleDualProfileChange(index?: number) {
  if (index === undefined || index === null) {
    clearProfiles();
    return;
  }
  const pair = dualProfileOptions.value[index];
  if (!pair) {
    clearProfiles();
    return;
  }
  form.signProfileId = pair.signProfileId;
  form.signProfileName = pair.signProfileName;
  form.encryptProfileId = pair.encryptProfileId;
  form.encryptProfileName = pair.encryptProfileName;
  form.profileId = pair.signProfileId;
  form.profileName = pair.signProfileName;
}

function submitForm() {
  applyFormRef.value?.validate(async (valid) => {
    if (!valid) {
      return;
    }
    submitLoading.value = true;
    try {
      await saveRaApply(form);
      proxy?.$modal.msgSuccess('新增成功');
      open.value = false;
      await getList();
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleDetail(row: RaApplyVO) {
  const res = await getRaApply(row.id);
  detail.value = res.data || row;
  detailOpen.value = true;
}

function userDeptName(user: any) {
  return user.deptName || user.dept?.name || deptNameMap.value.get(String(user.deptId)) || '-';
}

function userCategoryLabel(value?: string) {
  return userCategoryOptions.find((item) => item.value === value)?.label || '-';
}

function certModeLabel(value?: string) {
  return value === 'dual' ? '双证书' : '单证书';
}

function rootLabel(root: RaUserCertScopeRoot) {
  return root.algorithm ? `${root.name}（${root.algorithm}）` : root.name;
}

function dualPairLabel(pair: RaUserCertScopeDualPair) {
  if (pair.pairName) {
    return pair.pairName;
  }
  return `签名：${pair.signProfileName} / 加密：${pair.encryptProfileName}`;
}

function profileText(row: Partial<RaApplyVO>) {
  if (row.certMode === 'dual') {
    const signName = row.signProfileName || row.profileName || '-';
    const encryptName = row.encryptProfileName || '-';
    return `签名：${signName} / 加密：${encryptName}`;
  }
  return row.profileName || '-';
}

function statusName(status?: number) {
  return applyStatusOptions.find((item) => item.value === Number(status || 0))?.label || '新申请';
}

function statusType(status?: number) {
  if (Number(status) === 1) {
    return 'warning';
  }
  if (Number(status) === 2) {
    return 'danger';
  }
  if (Number(status) === 3) {
    return 'success';
  }
  return 'warning';
}

onMounted(() => {
  getList();
});

watch(
  deptFilter,
  (value) => {
    deptTreeRef.value?.filter(value);
  },
  { flush: 'post' }
);
</script>

<style scoped lang="scss">
.ra-apply-page {
  .el-table {
    width: 100%;
  }
}

.user-picker-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 14px;
  min-height: 470px;
}

.user-picker-dept {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 12px;
}

.user-picker-tree {
  margin-top: 10px;
  height: 420px;
  overflow: auto;
}

.user-picker-main {
  min-width: 0;
}

.user-picker-query {
  margin-bottom: 8px;
}

:deep(.ra-user-picker-dialog .el-dialog__body) {
  padding-top: 10px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .user-picker-layout {
    grid-template-columns: 1fr;
  }

  .user-picker-tree {
    height: 220px;
  }
}
</style>
