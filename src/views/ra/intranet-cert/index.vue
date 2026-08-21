<template>
  <div class="app-container intranet-cert-page">
    <el-card shadow="never" class="query-card">
      <el-form :model="queryParams" inline>
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="证书序列号" style="width: 190px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="系统名称">
          <el-input v-model="queryParams.systemName" clearable placeholder="系统名称" style="width: 180px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="申请人">
          <el-input v-model="queryParams.applicantKeyword" clearable placeholder="姓名/域账号" style="width: 160px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="科室">
          <el-input v-model="queryParams.deptName" clearable placeholder="申请科室" style="width: 160px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书状态">
          <el-select v-model="queryParams.certStatus" clearable placeholder="全部" style="width: 130px">
            <el-option label="有效" value="VALID" />
            <el-option label="未生效" value="NOT_YET_VALID" />
            <el-option label="已过期" value="EXPIRED" />
            <el-option label="已吊销" value="REVOKED" />
            <el-option label="未知" value="UNKNOWN" />
          </el-select>
        </el-form-item>
        <el-form-item label="人员状态">
          <el-select v-model="queryParams.applicantStatus" clearable placeholder="全部" style="width: 120px">
            <el-option label="在职" value="ACTIVE" />
            <el-option label="离职" value="LEFT" />
            <el-option label="未知" value="UNKNOWN" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8 toolbar-row">
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:intranet-cert:add']" type="primary" plain icon="Plus" @click="openCreate">新增</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:intranet-cert:export']" type="success" plain icon="Download" @click="handleExport">导出</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:intranet-cert:remind']" plain icon="RefreshRight" @click="refreshOwnerStatus">刷新离职状态</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:intranet-cert:template']" plain icon="Message" @click="openTemplates">提醒模板</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
      </el-row>

      <el-table v-loading="loading" :data="rows" border stripe class="cert-table" empty-text="暂无内网证书台账">
        <el-table-column label="序列号" prop="serialNumber" min-width="170" fixed show-overflow-tooltip />
        <el-table-column label="系统名称" prop="systemName" min-width="150" show-overflow-tooltip />
        <el-table-column label="申请人" prop="applicantName" min-width="110" show-overflow-tooltip />
        <el-table-column label="域账号" prop="applicantAccount" min-width="120" show-overflow-tooltip />
        <el-table-column label="申请科室" prop="applicantDeptName" min-width="150" show-overflow-tooltip />
        <el-table-column label="邮箱" prop="applicantEmail" min-width="190" show-overflow-tooltip />
        <el-table-column label="到期时间" prop="notAfter" width="166" align="center">
          <template #default="{ row }">{{ parseDateTime(row.notAfter) }}</template>
        </el-table-column>
        <el-table-column label="证书状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="certStatusTag(row.certStatus)" effect="light">{{ row.certStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提醒" width="82" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.reminderEnabled"
              v-hasPermi="['ra:intranet-cert:remind']"
              inline-prompt
              active-text="开"
              inactive-text="关"
              @change="(value: boolean) => toggleReminder(row, value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="人员状态" width="98" align="center">
          <template #default="{ row }">
            <el-tag :type="row.applicantStatus === 'LEFT' ? 'danger' : 'success'" effect="plain">{{ row.applicantStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="负责人变更" width="112" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ownerChangeRequired" type="danger" effect="plain">需处理</el-tag>
            <el-tag v-else type="info" effect="plain">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button link type="primary" icon="View" @click="openDetail(row)" />
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ra:intranet-cert:edit']" link type="primary" icon="Edit" @click="openEdit(row)" />
            </el-tooltip>
            <el-tooltip content="作废" placement="top">
              <el-button v-hasPermi="['ra:intranet-cert:remove']" link type="danger" icon="Delete" @click="handleRemove(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <el-drawer v-model="formOpen" :title="form.id ? '修改内网证书台账' : '新增内网证书台账'" size="680px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="112px">
        <el-divider content-position="left">证书信息</el-divider>
        <el-form-item label="证书来源">
          <el-tag :type="form.sourceCertId ? 'success' : 'info'" effect="plain">{{ form.sourceCertId ? '已签发证书' : '手工录入' }}</el-tag>
        </el-form-item>
        <el-form-item label="证书序列号" prop="serialNumber">
          <el-input v-model="form.serialNumber" clearable placeholder="请输入证书序列号" />
        </el-form-item>
        <el-form-item label="证书主题">
          <el-input v-model="form.subject" type="textarea" :rows="2" placeholder="证书主题" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="根证书">
              <el-input v-model="form.rootName" clearable placeholder="根证书名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证书模板">
              <el-input v-model="form.profileName" clearable placeholder="证书模板名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="生效时间">
              <el-date-picker v-model="form.notBefore" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="生效时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期时间">
              <el-date-picker v-model="form.notAfter" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="到期时间" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">业务信息</el-divider>
        <el-form-item label="申请人" prop="applicantName">
          <div class="employee-line">
            <el-input v-model="form.applicantName" readonly placeholder="请选择申请人" />
            <el-button icon="User" @click="openEmployeePicker">选择</el-button>
          </div>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="域账号">
              <el-input v-model="form.applicantAccount" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="form.applicantEmail" readonly />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="申请科室">
          <el-input v-model="form.applicantDeptName" readonly />
        </el-form-item>
        <el-form-item label="系统名称" prop="systemName">
          <el-input v-model="form.systemName" clearable placeholder="请输入系统名称" />
        </el-form-item>
        <el-form-item label="使用场景">
          <el-input v-model="form.usageScenario" type="textarea" :rows="2" placeholder="请输入使用场景" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="证书管理员">
              <el-input v-model="form.managerName" clearable placeholder="管理员姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="管理员邮箱">
              <el-input v-model="form.managerEmail" clearable placeholder="管理员邮箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="过期提醒">
          <el-switch v-model="form.reminderEnabled" />
          <el-input v-model="form.reminderDays" clearable placeholder="90,60,30,7" class="reminder-days" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="detailOpen" title="内网证书详情" size="620px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ detail.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="系统名称">{{ detail.systemName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="使用场景">{{ detail.usageScenario || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicantName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域账号">{{ detail.applicantAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.applicantEmail || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请科室">{{ detail.applicantDeptPath || detail.applicantDeptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ parseDateTime(detail.notBefore) }} 至 {{ parseDateTime(detail.notAfter) }}</el-descriptions-item>
        <el-descriptions-item label="提醒天数">{{ detail.reminderEnabled ? detail.reminderDays : '关闭' }}</el-descriptions-item>
        <el-descriptions-item label="负责人变更">{{ detail.ownerChangeRequired ? '需要处理' : '正常' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="employeeOpen" title="选择申请人" width="980px" append-to-body>
      <el-form :model="employeeQuery" inline>
        <el-form-item label="关键词">
          <el-input v-model="employeeQuery.keyword" clearable placeholder="姓名/域账号/工号" style="width: 210px" @keyup.enter="loadEmployees" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="employeeQuery.status" clearable placeholder="全部" style="width: 120px">
            <el-option label="在职" value="A" />
            <el-option label="离职" value="I" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="loadEmployees">搜索</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="employeeLoading" :data="employees" border stripe height="420" @row-dblclick="selectEmployee">
        <el-table-column label="姓名" prop="cnName" min-width="120" />
        <el-table-column label="域账号" prop="domainAccount" min-width="120" />
        <el-table-column label="工号" prop="employeeNo" min-width="110" />
        <el-table-column label="邮箱" prop="email" min-width="190" show-overflow-tooltip />
        <el-table-column label="科室" prop="departmentName" min-width="150" show-overflow-tooltip />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.sourceStatus === 'A' ? 'success' : 'danger'" effect="plain">{{ row.sourceStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="selectEmployee(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="employeeTotal > 0" v-model:page="employeeQuery.pageNum" v-model:limit="employeeQuery.pageSize" :total="employeeTotal" @pagination="loadEmployees" />
    </el-dialog>

    <el-dialog v-model="templateOpen" title="提醒模板" width="900px" append-to-body>
      <el-table v-loading="templateLoading" :data="templates" border stripe>
        <el-table-column label="编码" prop="templateCode" width="180" />
        <el-table-column label="渠道" prop="channel" width="100" />
        <el-table-column label="标题" prop="title" min-width="180" />
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="() => saveTemplate(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="Edit" @click="editTemplate(row)" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="templateEditOpen" title="编辑提醒模板" width="720px" append-to-body>
      <el-form :model="templateForm" label-width="90px">
        <el-form-item label="编码">
          <el-input v-model="templateForm.templateCode" disabled />
        </el-form-item>
        <el-form-item label="渠道">
          <el-input v-model="templateForm.channel" disabled />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="templateForm.title" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="templateForm.content" type="textarea" :rows="8" />
        </el-form-item>
        <el-form-item label="变量">
          <el-tag v-for="item in templateVariables" :key="item" class="variable-tag" effect="plain">{{ item }}</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateEditOpen = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate(templateForm)">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaIntranetCert" lang="ts">
import FileSaver from 'file-saver';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import {
  exportIntranetCerts,
  getIntranetCert,
  IntranetCert,
  IntranetCertQuery,
  IntranetReminderTemplate,
  listIntranetCertTemplates,
  pageIntranetCerts,
  prefillIntranetCert,
  refreshIntranetOwnerStatus,
  removeIntranetCert,
  saveIntranetCert,
  saveIntranetCertTemplate,
  updateIntranetCertReminder
} from '@/api/ra/intranetCert';
import { FawvwEmployee, pageFawvwEmployees } from '@/api/ra/employee';

const route = useRoute();
const router = useRouter();

const rows = ref<IntranetCert[]>([]);
const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const formOpen = ref(false);
const detailOpen = ref(false);
const employeeOpen = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const detail = ref<Partial<IntranetCert>>({});

const queryParams = reactive<IntranetCertQuery>({
  pageNum: 1,
  pageSize: 10,
  serialNumber: '',
  systemName: '',
  applicantKeyword: '',
  deptName: '',
  certStatus: '',
  reminderEnabled: null,
  applicantStatus: '',
  ownerChangeRequired: null,
  notAfterStart: '',
  notAfterEnd: ''
});

const emptyForm = (): Partial<IntranetCert> => ({
  sourceType: 'MANUAL',
  serialNumber: '',
  subject: '',
  issuer: '',
  rootName: '',
  profileName: '',
  notBefore: '',
  notAfter: '',
  applicantName: '',
  applicantAccount: '',
  applicantEmail: '',
  applicantDeptName: '',
  applicantDeptPath: '',
  applicantStatus: 'UNKNOWN',
  systemName: '',
  usageScenario: '',
  managerName: '',
  managerEmail: '',
  reminderEnabled: true,
  reminderDays: '90,60,30,7',
  remark: ''
});

const form = reactive<Partial<IntranetCert>>(emptyForm());
const rules: FormRules = {
  serialNumber: [{ required: true, message: '请输入证书序列号', trigger: 'blur' }],
  applicantName: [{ required: true, message: '请选择申请人', trigger: 'change' }],
  systemName: [{ required: true, message: '请输入系统名称', trigger: 'blur' }]
};

const employeeLoading = ref(false);
const employees = ref<FawvwEmployee[]>([]);
const employeeTotal = ref(0);
const employeeQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  domainAccount: '',
  departmentId: '',
  employeeTypeId: '',
  foreignFlag: null as boolean | null,
  status: 'A'
});

const templateOpen = ref(false);
const templateEditOpen = ref(false);
const templateLoading = ref(false);
const templates = ref<IntranetReminderTemplate[]>([]);
const templateForm = reactive<IntranetReminderTemplate>({
  templateCode: '',
  channel: '',
  title: '',
  content: '',
  enabled: true
});
const templateVariables = ['${applicantName}', '${domainAccount}', '${systemName}', '${serialNumber}', '${notAfter}', '${daysLeft}', '${managerName}'];

function unwrap<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function loadList() {
  loading.value = true;
  try {
    const page = unwrap<any>(await pageIntranetCerts(queryParams));
    rows.value = page.records || page.rows || [];
    total.value = Number(page.total || 0);
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}

function resetQuery() {
  Object.assign(queryParams, {
    pageNum: 1,
    pageSize: queryParams.pageSize,
    serialNumber: '',
    systemName: '',
    applicantKeyword: '',
    deptName: '',
    certStatus: '',
    reminderEnabled: null,
    applicantStatus: '',
    ownerChangeRequired: null,
    notAfterStart: '',
    notAfterEnd: ''
  });
  loadList();
}

function resetForm() {
  Object.assign(form, emptyForm());
  formRef.value?.clearValidate();
}

function openCreate() {
  resetForm();
  formOpen.value = true;
}

async function openEdit(row: IntranetCert) {
  const data = unwrap<IntranetCert>(await getIntranetCert(row.id!));
  resetForm();
  Object.assign(form, data);
  formOpen.value = true;
}

async function openDetail(row: IntranetCert) {
  detail.value = unwrap<IntranetCert>(await getIntranetCert(row.id!));
  detailOpen.value = true;
}

async function submitForm() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await saveIntranetCert(form);
    ElMessage.success('内网证书台账已保存');
    formOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function handleRemove(row: IntranetCert) {
  await ElMessageBox.confirm(`确认作废证书台账 ${row.serialNumber}？`, '提示', { type: 'warning' });
  await removeIntranetCert(row.id!);
  ElMessage.success('台账已作废');
  loadList();
}

async function toggleReminder(row: IntranetCert, value: boolean) {
  try {
    await updateIntranetCertReminder(row.id!, { reminderEnabled: value, reminderDays: row.reminderDays || '90,60,30,7' });
    ElMessage.success(value ? '已开启提醒' : '已关闭提醒');
  } catch {
    row.reminderEnabled = !value;
  }
}

function openEmployeePicker() {
  employeeOpen.value = true;
  loadEmployees();
}

async function loadEmployees() {
  employeeLoading.value = true;
  try {
    const page = unwrap<any>(await pageFawvwEmployees(employeeQuery));
    employees.value = page.records || page.rows || [];
    employeeTotal.value = Number(page.total || 0);
  } finally {
    employeeLoading.value = false;
  }
}

function selectEmployee(row: FawvwEmployee) {
  Object.assign(form, {
    applicantEmployeeId: row.id,
    applicantIdentityKey: row.identityKey,
    applicantName: row.cnName,
    applicantAccount: row.domainAccount,
    applicantEmail: row.email,
    applicantDeptId: row.departmentId,
    applicantDeptName: row.departmentName,
    applicantDeptPath: row.departmentNamePath,
    applicantStatus: row.sourceStatus === 'A' ? 'ACTIVE' : 'LEFT'
  });
  employeeOpen.value = false;
}

async function handleExport() {
  const response: any = await exportIntranetCerts(queryParams);
  const blob = response?.data instanceof Blob ? response.data : response;
  FileSaver.saveAs(blob, `fawvw_intranet_certs_${Date.now()}.csv`);
}

async function refreshOwnerStatus() {
  const count = unwrap<number>(await refreshIntranetOwnerStatus());
  ElMessage.success(`刷新完成，需处理负责人 ${count || 0} 条`);
  loadList();
}

async function openTemplates() {
  templateOpen.value = true;
  templateLoading.value = true;
  try {
    templates.value = unwrap<IntranetReminderTemplate[]>(await listIntranetCertTemplates()) || [];
  } finally {
    templateLoading.value = false;
  }
}

function editTemplate(row: IntranetReminderTemplate) {
  Object.assign(templateForm, row);
  templateEditOpen.value = true;
}

async function saveTemplate(row: IntranetReminderTemplate) {
  const saved = unwrap<IntranetReminderTemplate>(await saveIntranetCertTemplate(row));
  const index = templates.value.findIndex((item) => item.templateCode === saved.templateCode);
  if (index >= 0) {
    templates.value[index] = saved;
  }
  ElMessage.success('模板已保存');
  templateEditOpen.value = false;
}

async function loadPrefillFromRoute() {
  const sourceCertId = route.query.sourceCertId as string | undefined;
  const serialNumber = route.query.serialNumber as string | undefined;
  if (!sourceCertId && !serialNumber) return;
  const data = unwrap<any>(await prefillIntranetCert({ sourceCertId, serialNumber }));
  if (data?.existing?.id) {
    Object.assign(form, data.existing);
    ElMessage.info('该证书已录入台账，已打开现有记录');
  } else if (data?.cert) {
    Object.assign(form, emptyForm(), {
      sourceType: 'ISSUED',
      sourceCertId: data.cert.id,
      serialNumber: data.cert.serialNumber,
      subject: data.cert.subject,
      rootId: data.cert.rootId,
      rootName: data.cert.rootName,
      profileId: data.cert.profileId,
      profileName: data.cert.profileName,
      notBefore: data.cert.notBefore,
      notAfter: data.cert.notAfter
    });
  }
  formOpen.value = true;
  router.replace({ path: route.path, query: {} });
}

function certStatusTag(status?: string) {
  const types: Record<string, string> = {
    VALID: 'success',
    NOT_YET_VALID: 'warning',
    EXPIRED: 'info',
    REVOKED: 'danger',
    UNKNOWN: 'info'
  };
  return types[status || 'UNKNOWN'] || 'info';
}

function parseDateTime(value?: string) {
  return normalizeDateTime(value) || '-';
}

function normalizeDateTime(value?: string) {
  return value ? String(value).replace('T', ' ').slice(0, 19) : '';
}

onMounted(async () => {
  await loadList();
  await loadPrefillFromRoute();
});
</script>

<style scoped lang="scss">
.intranet-cert-page {
  .query-card,
  .table-card {
    border-radius: 6px;
  }

  .query-card {
    margin-bottom: 12px;
  }

  .toolbar-row {
    align-items: center;
  }

  .cert-table {
    width: 100%;
  }

  .employee-line {
    display: flex;
    width: 100%;
    gap: 8px;
  }

  .reminder-days {
    width: 180px;
    margin-left: 12px;
  }

  .variable-tag {
    margin: 0 8px 8px 0;
  }
}
</style>
