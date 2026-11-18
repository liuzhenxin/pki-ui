<template>
  <div class="app-container ra-apply-page">
    <el-form ref="queryFormRef" v-show="showSearch" :model="queryParams" label-width="80px" class="apply-query" @submit.prevent="handleQuery">
      <el-form-item label="申请用户" prop="userName">
        <el-input v-model="queryParams.userName" placeholder="请输入申请用户" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="申请状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable>
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
        />
      </el-form-item>
      <el-form-item class="apply-query-actions">
        <el-button type="primary" icon="Search" native-type="submit">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="apply-toolbar">
      <div class="apply-actions">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增申请</el-button>
        <el-button v-hasPermi="['ra:admin']" icon="FolderChecked" @click="openUnresolved">核定存量归属</el-button>
      </div>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </div>

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
      <el-table-column label="操作" align="center" width="130" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
          <el-tooltip v-if="Number(row.status) === 0" content="转办" placement="top">
            <el-button v-hasPermi="['ra:admin']" link type="primary" icon="Switch" @click="openTransfer(row)" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :auto-scroll="false" @pagination="getList" />

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
        <el-alert title="仅展示当前业务管理员已授权的根证书和证书模板。" type="info" :closable="false" show-icon class="mb12" />
        <el-form-item label="签发类型" prop="certMode">
          <el-radio-group v-model="form.certMode" @change="handleCertModeChange">
            <el-radio-button label="single">单证书</el-radio-button>
            <el-radio-button label="dual" :disabled="!supportsDualRoot">双证书</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.certMode !== 'dual'">
          <el-form-item label="证书模板" prop="profileId">
            <el-select v-model="form.profileId" filterable clearable placeholder="请选择证书模板" style="width: 100%" @change="handleProfileChange">
              <el-option
                v-for="profile in profileOptions"
                :key="String(profile.id)"
                :label="profileApplyLabel(profile)"
                :value="String(profile.id)"
              />
            </el-select>
          </el-form-item>
          <el-alert
            v-if="isRsaKmcEncryption"
            class="rsa-kmc-alert"
            type="info"
            :closable="false"
            show-icon
            title="该模板为 RSA 加密单证：密钥由 KMC 生成，签发时无需提交 CSR。"
          />
        </template>
        <el-form-item v-else label="证书模板" prop="dualProfileIndex">
          <el-select
            v-model="form.dualProfileIndex"
            filterable
            clearable
            placeholder="请选择双证书模板"
            style="width: 100%"
            @change="handleDualProfileChange"
          >
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

    <el-dialog v-model="userPickerOpen" title="选择申请用户" width="min(1060px, 96vw)" append-to-body destroy-on-close class="ra-user-picker-dialog" @close="clearPickerRequests">
      <div class="user-picker-layout">
        <aside class="user-picker-dept">
          <el-input v-model="deptFilter" placeholder="搜索组织科室或部门" prefix-icon="Search" clearable />
          <el-tree
            ref="deptTreeRef"
            class="user-picker-tree"
            node-key="id"
            :data="pickerTree"
            :props="deptTreeProps"
            :expand-on-click-node="false"
            :filter-node-method="filterDeptNode"
            :current-node-key="userPickerQuery.deptId || allPickerDepartments"
            :default-expanded-keys="[allPickerDepartments]"
            highlight-current
            @node-click="handlePickerDeptClick"
          />
        </aside>
        <section class="user-picker-main">
          <el-form :model="userPickerQuery" :inline="true" label-width="72px" class="user-picker-query">
            <el-form-item label="关键词">
              <el-input
                v-model="userPickerQuery.username"
                placeholder="姓名 / 工号 / 域账号"
                clearable
                style="width: 180px"
                @keyup.enter="handleUserPickerQuery"
              />
            </el-form-item>
            <el-form-item label="域账号">
              <el-input v-model="userPickerQuery.domainAccount" clearable placeholder="请输入域账号" style="width: 180px" @keyup.enter="handleUserPickerQuery" />
            </el-form-item>
            <el-form-item label="手机号码">
              <el-input
                v-model="userPickerQuery.mobile"
                placeholder="请输入手机号码"
                clearable
                style="width: 180px"
                @keyup.enter="handleUserPickerQuery"
              />
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

          <el-table v-loading="userPickerLoading" :data="userPickerList" border height="360" highlight-current-row @row-dblclick="selectPickerRow">
            <el-table-column label="姓名 / 用户名" prop="name" min-width="116" show-overflow-tooltip />
            <el-table-column label="来源" width="100"><template #default="{ row }">{{ row.source === 'API' ? '大众同步' : '本地创建' }}</template></el-table-column>
            <el-table-column label="域账号" prop="domainAccount" min-width="110" show-overflow-tooltip />
            <el-table-column label="所属部门" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <span>{{ row.department || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="用户类别" width="100" align="center">
              <template #default="{ row }">
                <el-tag type="info">{{ userCategoryLabel(row.applicant?.userCategory) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="手机号" prop="applicant.mobile" width="120" show-overflow-tooltip />
            <el-table-column label="邮箱" prop="email" min-width="145" show-overflow-tooltip />
            <el-table-column label="操作" width="126" align="center" fixed="right">
              <template #default="{ row }">
                <span v-if="pickerBlockReason(row)" class="picker-blocked">{{ pickerBlockReason(row) }}</span>
                <el-button v-else link type="primary" @click="selectPickerRow(row)">选择</el-button>
              </template>
            </el-table-column>
          </el-table>

          <pagination
            v-show="userPickerTotal > 0"
            v-model:page="userPickerQuery.pageNum"
            v-model:limit="userPickerQuery.pageSize"
            :total="userPickerTotal"
            :auto-scroll="false"
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

    <el-dialog v-model="unresolvedOpen" title="待核定申请归属" width="760px" append-to-body>
      <el-table :data="unresolvedRows" v-loading="unresolvedLoading" max-height="380" border>
        <el-table-column label="申请编号" prop="id" min-width="155" />
        <el-table-column label="申请用户ID" prop="user_id" min-width="145" />
        <el-table-column label="申请时间" prop="create_time" min-width="180" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button link type="primary" @click="openTransfer(row, true)">核定</el-button></template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="transferOpen" :title="transferResolve ? '核定申请归属' : '转办申请'" width="500px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="申请编号">{{ transferId }}</el-form-item>
        <el-form-item label="接手部门" required>
          <el-tree-select v-model="transferDepartmentId" :data="deptOptions" :props="{ label: 'name', children: 'children', value: 'id' }" node-key="id" check-strictly filterable style="width: 100%" />
        </el-form-item>
        <el-form-item label="核定依据" required>
          <el-input v-model="transferReason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="填写历史记录依据或转办原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferOpen = false">取消</el-button>
        <el-button type="primary" :loading="transferSaving" @click="saveTransfer">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaApply" lang="ts">
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import { pageRaApply, getRaApply, saveRaApply, transferRaApplyDepartment, listUnresolvedApplyDepartments, resolveRaApplyDepartment, RaApplyForm, RaApplyVO } from '@/api/ra/apply';
import type { RaApplicantUserInfo } from '@/api/ra/user';
import { getEmployeeDirectoryDetails, getFawvwEmployee, getFawvwEmployeeApplicant, pageEmployeeDirectory, type EmployeeDirectoryRow, type FawvwEmployee } from '@/api/ra/employee';
import auth from '@/plugins/auth';
import { isFawvwEmployeeSourceActive } from '@/utils/fawvwEmployeeStatus';
import { useRoute } from 'vue-router';
import { listDeptSelectTree } from '@/api/ra/dept';
import { RaDeptTreeOption } from '@/api/ra/dept/types';
import { listMyUserCertScopeOptions, RaUserCertScopeDualPair, RaUserCertScopeProfile, RaUserCertScopeRoot } from '@/api/ra/userCertScope';
import { parseJson } from '@/utils/json';
import { FormInstance, FormRules } from 'element-plus';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const route = useRoute();

const applyList = ref<RaApplyVO[]>([]);
const rootOptions = ref<RaUserCertScopeRoot[]>([]);
const deptOptions = ref<RaDeptTreeOption[]>([]);
const deptFilter = ref('');
type PickerDepartment = { id: string; name: string; children?: PickerDepartment[] };
type PickerDepartmentInput = { id: string | number; name?: string; label?: string; children?: PickerDepartmentInput[] };
type PickerRow = {
  name?: string; domainAccount?: string; department?: string; email?: string;
  employee?: FawvwEmployee; applicant?: RaApplicantUserInfo; source?: string; eligible?: boolean;
};
const allPickerDepartments = 'all';
let pickerRequest = 0;
const pickerTree = computed<PickerDepartment[]>(() => [{
  id: allPickerDepartments, name: '全部部门',
  children: mapPickerDepartments(deptOptions.value)
}]);
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
const userPickerList = ref<PickerRow[]>([]);
const unresolvedOpen = ref(false);
const unresolvedLoading = ref(false);
const unresolvedRows = ref<Array<{ id: string | number; user_id: string | number; create_time: string }>>([]);
const transferOpen = ref(false);
const transferResolve = ref(false);
const transferId = ref<string | number>('');
const transferDepartmentId = ref<string | number>();
const transferReason = ref('');
const transferSaving = ref(false);

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
  domainAccount: '',
  mobile: '',
  userCategory: undefined as string | undefined,
  deptId: undefined as string | undefined
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

const supportsDualRoot = computed(() => {
  const algorithm = (selectedRoot.value?.algorithm || form.rootAlgorithm || '').toUpperCase();
  return dualProfileOptions.value.length > 0 || algorithm === 'SM2' || algorithm.includes('ML-DSA') || algorithm.includes('MLDSA');
});

const profileOptions = computed<RaUserCertScopeProfile[]>(() => {
  const rootId = form.rootId === undefined ? undefined : String(form.rootId);
  return rootOptions.value.find((root) => String(root.id) === rootId)?.profiles || [];
});

const selectedProfile = computed<RaUserCertScopeProfile | undefined>(() => {
  const profileId = form.profileId === undefined ? undefined : String(form.profileId);
  return profileOptions.value.find((profile) => String(profile.id) === profileId);
});

const isRsaKmcEncryption = computed(() => {
  if (form.certMode === 'dual') {
    return false;
  }
  const algorithm = (selectedRoot.value?.algorithm || form.rootAlgorithm || '').toUpperCase();
  return algorithm.includes('RSA') && isEncryptionProfile(selectedProfile.value);
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

let listVersion = 0;

async function getList() {
  const version = ++listVersion;
  loading.value = true;
  try {
    queryParams.startTime = dateRange.value?.[0];
    queryParams.endTime = dateRange.value?.[1];
    const res = await pageRaApply(queryParams);
    if (version !== listVersion) return;
    const page = parsePage(res);
    applyList.value = page.rows;
    total.value = page.total;
  } finally {
    if (version === listVersion) loading.value = false;
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
  const entryPath = route.fullPath;
  resetForm();
  await Promise.all([loadDeptOptions(), loadRootOptions()]);
  if (entryPath !== route.fullPath) return;
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

function mapPickerDepartments(nodes: PickerDepartmentInput[]): PickerDepartment[] {
  return nodes.map((node) => ({
    id: String(node.id), name: node.label || node.name || String(node.id), children: mapPickerDepartments(node.children || [])
  }));
}

async function openUserPicker() {
  await loadDeptOptions();
  userPickerOpen.value = true;
  await resetUserPickerQuery();
}

async function loadPickerUsers() {
  const request = ++pickerRequest;
  userPickerLoading.value = true;
  userPickerList.value = [];
  try {
    const { pageNum, pageSize, username, domainAccount, mobile, userCategory, deptId } = userPickerQuery;
    const res = await pageEmployeeDirectory({ pageNum, pageSize, keyword: username.trim(), domainAccount: domainAccount.trim(),
      mobile: mobile.trim(), userCategory, departmentId: deptId });
    if (request !== pickerRequest || !userPickerOpen.value) return;
    const page = parsePage(res);
    userPickerList.value = (page.rows as EmployeeDirectoryRow[]).map(({ employee, applicant, name, source, eligible }) => ({
      employee, applicant, name, source, eligible, domainAccount: applicant?.domainAccount,
      email: applicant?.mail, department: applicant ? userDeptName(applicant) : undefined
    }));
    userPickerTotal.value = Number(page.total || 0);
  } catch {
    if (request === pickerRequest) userPickerTotal.value = 0;
  } finally {
    if (request === pickerRequest) userPickerLoading.value = false;
  }
}

function handleUserPickerQuery() {
  userPickerQuery.pageNum = 1;
  return loadPickerUsers();
}

function resetUserPickerQuery() {
  userPickerQuery.pageNum = 1;
  userPickerQuery.username = '';
  userPickerQuery.domainAccount = '';
  userPickerQuery.mobile = '';
  userPickerQuery.userCategory = form.userCategory;
  userPickerQuery.deptId = undefined;
  deptFilter.value = '';
  deptTreeRef.value?.setCurrentKey(allPickerDepartments);
  return loadPickerUsers();
}

function filterDeptNode(value: string, data: PickerDepartment) {
  return data.id === allPickerDepartments || data.name.toLowerCase().includes(value.trim().toLowerCase());
}

function handlePickerDeptClick(data: PickerDepartment) {
  userPickerQuery.deptId = data.id === allPickerDepartments ? undefined : data.id;
  return handleUserPickerQuery();
}

function pickerBlockReason(row: PickerRow) {
  if (row.eligible === false) return '不可办理';
  const employee = row.employee;
  if (employee) {
    if (employee.identityStatus !== 'VALID' || employee.localEnabled === false
        || (employee.recordSource === 'API' && !isFawvwEmployeeSourceActive(employee.sourceStatus))) return '不可办理';
  }
  if (row.applicant?.status != null && Number(row.applicant.status) !== 0) {
    return '账号已停用';
  }
  return '';
}

function selectPickerRow(row: PickerRow) {
  if (userPickerLoading.value || pickerBlockReason(row) || row.applicant?.id == null) return;
  selectPickerUser(row.applicant, row.name);
}

function selectPickerUser(user: RaApplicantUserInfo, employeeName?: string) {
  form.userId = String(user.id);
  form.userName = employeeName || user.username || user.userName || '';
  form.deptName = userDeptName(user);
  form.userCategory = user.userCategory || form.userCategory;
  userPickerQuery.userCategory = form.userCategory;
  closeUserPicker();
  applyFormRef.value?.clearValidate(['userId', 'userCategory']);
}

function closeUserPicker() {
  userPickerOpen.value = false;
}

function clearPickerRequests() {
  pickerRequest++;
  userPickerLoading.value = false;
}

function handleRootChange(rootId?: string | number) {
  const root = rootOptions.value.find((item) => String(item.id) === String(rootId));
  form.rootName = root?.name;
  form.rootAlgorithm = root?.algorithm;
  const algorithm = (root?.algorithm || '').toUpperCase();
  if (algorithm !== 'SM2' && !algorithm.includes('ML-DSA') && !algorithm.includes('MLDSA')) {
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

function profileApplyLabel(profile: RaUserCertScopeProfile) {
  return isEncryptionProfile(profile) &&
    String(selectedRoot.value?.algorithm || form.rootAlgorithm || '')
      .toUpperCase()
      .includes('RSA')
    ? `${profile.name}（KMC加密）`
    : profile.name;
}

function isEncryptionProfile(profile?: RaUserCertScopeProfile) {
  if (!profile) {
    return false;
  }
  const name = String(profile.name || '');
  const upperName = name.toUpperCase();
  if (name.includes('加密') || upperName.includes('ENCRYPTION') || upperName.includes('TLS_ENC') || upperName.includes('TLS-ENC')) {
    return true;
  }
  const type = String(profile.type || '').toUpperCase();
  if (type === 'TLS_ENC' || type.includes('ENCRYPTION')) {
    return true;
  }
  let conf: any = {};
  try {
    conf = parseJson(profile.conf || '{}') || {};
  } catch {
    conf = {};
  }
  const category = String(conf.profileCategory || conf.certLevel || conf.metadata?.category || '').toUpperCase();
  if (category === 'DUAL_ENC' || category === 'TLS_ENC' || category.includes('ENCRYPTION')) {
    return true;
  }
  if (String(conf.dualCert?.role || '').toUpperCase() === 'ENCRYPTION') {
    return true;
  }
  const usages: string[] = [];
  const push = (value: any) => {
    if (value == null) {
      return;
    }
    if (typeof value === 'string') {
      usages.push(value.toLowerCase());
      return;
    }
    if (typeof value === 'object') {
      const token = String(value.value || value.description || value.oid || '').toLowerCase();
      if (token) {
        usages.push(token);
      }
    }
  };
  if (Array.isArray(conf.certUsages)) {
    conf.certUsages.forEach(push);
  }
  const extensions = Array.isArray(conf.extensions) ? conf.extensions : [];
  extensions.forEach((ext: any) => {
    const items = ext?.keyUsage?.usages || ext?.usages;
    if (Array.isArray(items)) {
      items.forEach(push);
    }
  });
  const hasSign = usages.some(
    (usage) => usage.includes('digitalsignature') || usage.includes('nonrepudiation') || usage.includes('contentcommitment')
  );
  const hasEnc = usages.some((usage) => usage.includes('encipher') || usage.includes('encrypt'));
  return hasEnc && !hasSign;
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

async function openUnresolved() {
  unresolvedOpen.value = true;
  unresolvedLoading.value = true;
  try {
    unresolvedRows.value = (await listUnresolvedApplyDepartments()).data || [];
  } finally {
    unresolvedLoading.value = false;
  }
}

async function openTransfer(row: { id: string | number }, resolve = false) {
  await loadDeptOptions();
  transferId.value = row.id;
  transferResolve.value = resolve;
  transferDepartmentId.value = undefined;
  transferReason.value = '';
  transferOpen.value = true;
}

async function saveTransfer() {
  if (!transferDepartmentId.value || !transferReason.value.trim()) {
    proxy?.$modal.msgError('请填写接手部门和核定依据');
    return;
  }
  transferSaving.value = true;
  try {
    const payload = { departmentId: transferDepartmentId.value, reason: transferReason.value.trim() };
    if (transferResolve.value) await resolveRaApplyDepartment(transferId.value, payload);
    else await transferRaApplyDepartment(transferId.value, payload);
    transferOpen.value = false;
    proxy?.$modal.msgSuccess('操作成功');
    if (transferResolve.value) await openUnresolved();
    await getList();
  } finally {
    transferSaving.value = false;
  }
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

watch(() => route.fullPath, async (entryPath, _, onCleanup) => {
  if (!/^\/ra-certificate\/ra-cert-apply\/?$/.test(route.path)) {
    open.value = false;
    userPickerOpen.value = false;
    return;
  }
  const employeeId = route.query.employeeId;
  const applicantId = route.query.applicantId;
  if (typeof employeeId !== 'string' && typeof applicantId !== 'string') return;
  let cancelled = false;
  onCleanup(() => { cancelled = true; });
  const isCurrent = () => !cancelled && entryPath === route.fullPath;
  try {
    let selectedApplicant: RaApplicantUserInfo;
    let selectedName: string | undefined;
    if (typeof employeeId === 'string') {
      const { data: employee } = await getFawvwEmployee(employeeId);
      if (!isCurrent()) return;
      if (!employee || pickerBlockReason({ employee })) {
        proxy?.$modal.msgError('当前员工不可办理证书申请');
        return;
      }
      const { data: applicant } = await getFawvwEmployeeApplicant(employeeId);
      if (!isCurrent() || applicant?.id == null || pickerBlockReason({ applicant })) return;
      selectedApplicant = applicant;
      selectedName = employee.cnName;
    } else if (typeof applicantId === 'string') {
      const { data: { person } } = await getEmployeeDirectoryDetails(applicantId);
      if (!isCurrent()) return;
      if (pickerBlockReason(person)) {
        proxy?.$modal.msgError('当前人员不可办理证书申请');
        return;
      }
      selectedApplicant = person.applicant;
      selectedName = person.name;
    } else {
      return;
    }
    resetForm();
    await Promise.all([loadDeptOptions(), loadRootOptions()]);
    if (!isCurrent()) return;
    selectPickerUser(selectedApplicant, selectedName);
    open.value = true;
  } catch {
    if (isCurrent()) proxy?.$modal.msgError('无法加载员工申请资格');
  }
}, { immediate: true });

watch(
  deptFilter,
  (value) => {
    deptTreeRef.value?.filter(value);
  },
  { flush: 'post' }
);
useRaListRefreshOnReturn(getList);
</script>

<style scoped lang="scss">
.ra-apply-page {
  .el-table {
    width: 100%;
  }
}

.apply-query,
.apply-toolbar,
.apply-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.apply-query {
  padding: 14px 16px 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  gap: 0 16px;
  margin-bottom: 12px;

  :deep(.el-form-item) {
    flex: 1 1 240px;
    min-width: 0;
    margin: 0 0 14px;
  }

  :deep(.el-form-item__label) {
    flex-shrink: 0;
    white-space: nowrap;
  }

  :deep(.el-form-item__content) {
    min-width: 0;
  }

  :deep(.el-input),
  :deep(.el-select),
  :deep(.el-date-editor) {
    width: 100%;
    min-width: 0;
  }
}

.apply-query-actions {
  flex: 0 0 auto !important;
  margin-left: auto !important;

  :deep(.el-form-item__content) {
    flex-wrap: nowrap;
  }

  :deep(.el-button + .el-button) {
    margin-left: 8px;
  }
}

@media (max-width: 560px) {
  .apply-query :deep(.el-form-item) {
    display: block;
  }
  .apply-query :deep(.el-form-item__label) {
    justify-content: flex-start;
  }
  .apply-query :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}

.apply-toolbar {
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 8px;
}

.apply-actions {
  gap: 8px;

  :deep(.el-button + .el-button) {
    margin-left: 0;
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

  :deep(.el-tree-node__label) {
    white-space: nowrap;
  }
}

.user-picker-main {
  min-width: 0;
}

.user-picker-query {
  margin-bottom: 8px;
}

.picker-blocked {
  color: var(--el-text-color-secondary);
}

:deep(.ra-user-picker-dialog .el-dialog__body) {
  padding-top: 10px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.rsa-kmc-alert {
  margin: 0 0 12px;
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
