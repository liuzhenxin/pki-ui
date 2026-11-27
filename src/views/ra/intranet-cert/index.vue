<template>
  <div class="app-container intranet-cert-page">
    <BusinessNoticeSettingsDialog ref="businessNoticeSettings" module="intranet" />
    <el-card v-show="showSearch" shadow="never" class="query-card">
      <el-form :model="queryParams" label-width="100px" class="query-form">
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="证书序列号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="系统名称">
          <el-input v-model="queryParams.systemName" clearable placeholder="系统名称" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="申请人">
          <el-input v-model="queryParams.applicantKeyword" clearable placeholder="姓名、域账号或科室" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书信息">
          <el-input v-model="queryParams.certificateInfo" clearable placeholder="模板名称或颁发机构" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书状态">
          <el-select v-model="queryParams.certStatus" clearable placeholder="全部">
            <el-option label="正常" value="NORMAL" />
            <el-option label="30天内过期" value="EXPIRING" />
            <el-option label="已过期" value="EXPIRED" />
          </el-select>
        </el-form-item>
        <el-form-item label="人员状态">
          <el-select v-model="queryParams.applicantStatus" clearable placeholder="全部">
            <el-option label="在职" value="ACTIVE" />
            <el-option label="离职" value="LEFT" />
          </el-select>
        </el-form-item>
        <el-form-item label="提醒状态">
          <el-select v-model="queryParams.reminderEnabled" clearable :value-on-clear="null" placeholder="全部">
            <el-option label="开启" :value="true" />
            <el-option label="关闭" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker
            v-model="expiryRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            unlink-panels
          />
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8 toolbar-row">
        <el-col :span="1.5">
          <el-button v-if="auth.hasPermi('ra:intranet-cert:add')" type="primary" plain icon="Plus" @click="openCreate">新增</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-dropdown trigger="click" :disabled="!selectedRows.length" @command="batchLedgerAction">
            <el-button class="mr8" plain icon="Operation" :disabled="!selectedRows.length">操作</el-button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item v-if="auth.hasPermi('ra:intranet-cert:remind')" command="enable">开启提醒</el-dropdown-item>
              <el-dropdown-item v-if="auth.hasPermi('ra:intranet-cert:remind')" command="disable">关闭提醒</el-dropdown-item>
              <el-dropdown-item v-if="auth.hasPermi('ra:intranet-cert:remove')" command="delete">批量删除</el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
          <el-button v-if="auth.hasPermi('ra:intranet-cert:export')" type="success" plain icon="Download" @click="handleExport">导出</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-if="auth.hasPermi('ra:intranet-cert:remind')" plain icon="RefreshRight" @click="refreshOwnerStatus">刷新状态</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-if="auth.hasPermi('ra:intranet-cert:template')" plain icon="Bell" @click="businessNoticeSettings?.open()">通知设置</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList">
          <template #prepend>
            <el-tooltip content="通知记录">
              <el-button circle icon="Document" aria-label="通知记录" @click="deliveryLogsOpen = true" />
            </el-tooltip>
          </template>
        </right-toolbar>
      </el-row>

      <el-table v-loading="loading" :data="rows" @selection-change="selectedRows = $event" border stripe class="cert-table" empty-text="暂无内网证书台账">
        <el-table-column type="selection" width="48" />
        <el-table-column label="序列号" prop="serialNumber" min-width="170" fixed show-overflow-tooltip>
          <template #default="{ row }"><el-button link type="primary" @click="openCertificateSerial(row)">{{ row.serialNumber }}</el-button></template>
        </el-table-column>
        <el-table-column label="证书模板" prop="profileName" min-width="135" show-overflow-tooltip />
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
            <el-tag :type="businessCertificateValidity(row.notAfter, 30).type" effect="light">{{ businessCertificateValidity(row.notAfter, 30).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人员状态" width="98" align="center">
          <template #default="{ row }">
            <el-tag :type="row.applicantStatus === 'LEFT' ? 'danger' : 'success'" effect="plain">{{ row.applicantStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提醒结果" width="112" align="center">
          <template #default="{ row }"><BusinessReminderResultTag :result="reminderResults[String(row.id)]" :unavailable="reminderResultsFailed" /></template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="228" align="center">
          <template #default="{ row }">
            <span :title="businessCertificateNoticeBlocked(row.notAfter) ? '证书过期已超过一个月，不可发送通知' : '到期提醒'">
              <el-switch v-if="auth.hasPermi('ra:intranet-cert:remind')" size="small" :model-value="row.reminderEnabled"
                :loading="reminderSaving.has(row.id)" :disabled="businessCertificateNoticeBlocked(row.notAfter)" @change="(value) => toggleReminder(row, !!value)" />
            </span>
            <CertRowAction label="查看详情" icon="View" @click="openDetail(row)" />
            <CertRowAction v-if="row.sourceType === 'ISSUED' && row.sourceCertId" label="下载证书" icon="Download"
              @command="(format) => downloadCertificate(row, format as 'cer' | 'pem' | 'p7b')">
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="cer">CER 证书</el-dropdown-item>
                  <el-dropdown-item command="pem">PEM 证书</el-dropdown-item>
                  <el-dropdown-item command="p7b">P7B 证书链</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </CertRowAction>
            <CertRowAction v-if="auth.hasPermi('ra:intranet-cert:edit')" label="修改" icon="Edit" @click="openEdit(row)" />
            <CertRowAction v-if="auth.hasPermi('ra:intranet-cert:remind')" :label="businessCertificateNoticeBlocked(row.notAfter) ? '证书过期已超过一个月，不可发送通知' : '发送通知'" icon="Message"
              :disabled="sendingNotice || businessCertificateNoticeBlocked(row.notAfter)" @click="sendNotice(row)" />
            <CertRowAction v-if="auth.hasPermi('ra:intranet-cert:remove')" label="删除" type="danger" icon="Delete" @click="handleRemove(row)" />
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" :auto-scroll="false" @pagination="loadList" />
    </el-card>

    <el-dialog v-model="deliveryLogsOpen" title="通知记录" width="min(1120px, 96vw)" append-to-body>
      <BusinessDeliveryLogs v-if="deliveryLogsOpen" module="intranet" @certificate="(id) => { deliveryLogsOpen = false; openDetail({ id }); }" />
    </el-dialog>
    <RaCertDetailDialog ref="certificateDetail" />

    <el-drawer v-model="formOpen" :title="form.id ? '修改内网证书台账' : form.sourceCertId ? '同步到内网证书管理' : '新增内网证书台账'" size="680px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="112px">
        <el-divider content-position="left">证书信息</el-divider>
        <el-form-item label="证书来源">
          <el-tag :type="form.sourceCertId ? 'success' : 'info'" effect="plain">{{ form.sourceCertId ? '已签发证书' : '手工录入' }}</el-tag>
        </el-form-item>
        <el-form-item label="证书序列号" prop="serialNumber">
          <el-input v-model="form.serialNumber" :readonly="!!form.id || !!form.sourceCertId" clearable placeholder="请输入证书序列号" />
        </el-form-item>
        <el-form-item label="证书主题">
          <el-input v-model="form.subject" :readonly="!!form.id || !!form.sourceCertId" type="textarea" :rows="2" placeholder="证书主题" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="颁发者">
              <el-input v-model="form.issuer" :readonly="!!form.id || !!form.sourceCertId" clearable placeholder="证书颁发者" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证书模板">
              <el-input v-model="form.profileName" :readonly="!!form.id || !!form.sourceCertId" clearable placeholder="证书模板名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="生效时间">
              <el-date-picker v-model="form.notBefore" :disabled="!!form.id || !!form.sourceCertId" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="生效时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期时间">
              <el-date-picker v-model="form.notAfter" :disabled="!!form.id || !!form.sourceCertId" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="到期时间" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">业务信息</el-divider>
        <el-form-item label="申请人" prop="applicantName">
          <div class="employee-line">
            <el-input v-model="form.applicantName" readonly placeholder="请选择申请人" />
            <el-button icon="User" @click="openEmployeePicker">{{ form.applicantEmployeeId ? '重新选择' : '选择' }}</el-button>
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
        <el-form-item label="系统名称" prop="systemName">
          <el-input v-model="form.systemName" clearable placeholder="请输入系统名称" />
        </el-form-item>
        <el-form-item label="使用场景">
          <el-input v-model="form.usageScenario" type="textarea" :rows="2" placeholder="请输入使用场景" />
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
        <el-descriptions-item label="证书模板">{{ detail.profileName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ formatCertificateSubject(detail.subject) }}</el-descriptions-item>
        <el-descriptions-item label="颁发者">{{ detail.issuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="系统名称">{{ detail.systemName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="使用场景">{{ detail.usageScenario || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicantName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域账号">{{ detail.applicantAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.applicantEmail || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请科室">{{ detail.applicantDeptPath || detail.applicantDeptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ parseDateTime(detail.notBefore) }} 至 {{ parseDateTime(detail.notAfter) }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">通知记录</el-divider>
      <BusinessDeliveryLogs v-if="detailOpen && detail.id != null" module="intranet" :certificate-id="detail.id" timeline />
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
            <el-tag :type="employeeIsActive(row) ? 'success' : 'danger'" effect="plain">{{ row.sourceStatusName || '-' }}</el-tag>
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

  </div>
</template>

<script setup name="RaIntranetCert" lang="ts">
import { formatCertificateSubject } from '@/utils/raCertificateSubject';
import CertRowAction from '../components/CertRowAction.vue';
import { notifyBusinessCertificates, setBusinessCertificateReminder } from '@/api/ra/businessNoticeSettings';
import { businessCertificateValidity, confirmManualBusinessNotice, businessCertificateExpired, businessCertificateNoticeBlocked, confirmExpiredCertificateNotice } from '@/utils/businessCertificateNotice';
import BusinessReminderResultTag from '../components/BusinessReminderResultTag.vue';
import { getBusinessReminderResults, type BusinessReminderResult } from '@/api/ra/businessNoticeSettings';
import BusinessDeliveryLogs from '../components/BusinessDeliveryLogs.vue';
import RaCertDetailDialog from '../components/RaCertDetailDialog.vue';
import { pageRaCert, type RaCertSummary } from '@/api/ra/cert';
import BusinessNoticeSettingsDialog from '../components/BusinessNoticeSettingsDialog.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import FileSaver from 'file-saver';
import auth from '@/plugins/auth';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';
import { isFawvwEmployeeSourceActive } from '@/utils/fawvwEmployeeStatus';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import {
  downloadIntranetCert,
  exportIntranetCerts,
  getIntranetCert,
  IntranetCert,
  IntranetCertPrefill,
  IntranetCertQuery,
  pageIntranetCerts,
  prefillIntranetCert,
  refreshIntranetOwnerStatus,
  removeIntranetCert,
  saveIntranetCert
} from '@/api/ra/intranetCert';
import { FawvwEmployee, pageFawvwEmployees } from '@/api/ra/employee';

const route = useRoute();
const router = useRouter();

const deliveryLogsOpen = ref(false);
const selectedRows = ref<IntranetCert[]>([]);
const certificateDetail = ref<InstanceType<typeof RaCertDetailDialog>>();
const businessNoticeSettings = ref<InstanceType<typeof BusinessNoticeSettingsDialog>>();
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
  certificateInfo: '',
  certStatus: '',
  reminderEnabled: null,
  applicantStatus: '',
  ownerChangeRequired: null
});
const expiryRange = ref<[string, string] | null>(null);

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

const reminderSaving = reactive(new Set<NonNullable<IntranetCert['id']>>());
const sendingNotice = ref(false);

function unwrap<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

function queryPayload(): IntranetCertQuery {
  return { ...queryParams, notAfterStart: expiryRange.value?.[0], notAfterEnd: expiryRange.value?.[1] };
}

const reminderResults = ref<Record<string, BusinessReminderResult>>({});
const reminderResultsFailed = ref(false);

let listVersion = 0;

async function loadList() {
  const version = ++listVersion;
  loading.value = true;
  try {
    const page = unwrap<any>(await pageIntranetCerts(queryPayload()));
    if (version !== listVersion) return;
    rows.value = page.records || page.rows || [];
    reminderResults.value = {};
    reminderResultsFailed.value = false;
    const noticeIds = rows.value.flatMap(row => row.id == null ? [] : [row.id]);
    if (noticeIds.length) {
      void getBusinessReminderResults('intranet', noticeIds).then(response => {
        if (version === listVersion) reminderResults.value = response.data || {};
      }).catch(() => {
        if (version === listVersion) reminderResultsFailed.value = true;
      });
    }
    total.value = Number(page.total || 0);
  } finally {
    if (version === listVersion) loading.value = false;
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
    certificateInfo: '',
    certStatus: '',
    reminderEnabled: null,
    applicantStatus: '',
    ownerChangeRequired: null
  });
  expiryRange.value = null;
  loadList();
}

function resetForm() {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
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

async function openCertificateSerial(row: IntranetCert) {
  if (row.sourceCertId != null) {
    await certificateDetail.value?.open({ id: row.sourceCertId } as RaCertSummary);
    return;
  }
  try {
    const page = unwrap<{ records?: RaCertSummary[] }>(await pageRaCert({ pageNum: 1, pageSize: 100, serialNumber: row.serialNumber }));
    const matches = (page.records || []).filter((item) => item.serialNumber.toLowerCase() === row.serialNumber.toLowerCase()
      && (!row.rootId || String(item.rootId) === String(row.rootId)));
    if (matches.length === 1) await certificateDetail.value?.open(matches[0]);
    else await openDetail(row);
  } catch {
    await openDetail(row);
  }
}

async function batchLedgerAction(command: 'enable' | 'disable' | 'delete') {
  const selected = [...selectedRows.value];
  if (!selected.length) return;
  const label = { enable: '开启提醒', disable: '关闭提醒', delete: '删除' }[command];
  if (!(await ElMessageBox.confirm(`确认${label}所选 ${selected.length} 条证书？`, '确认操作', { type: 'warning' }).then(() => true, () => false))) return;
  let completed = 0;
  for (const row of selected) {
    try {
      if (command === 'delete') await removeIntranetCert(row.id!);
      else if (command === 'disable' || !businessCertificateNoticeBlocked(row.notAfter)) {
        const expired = command === 'enable' && businessCertificateExpired(row.notAfter);
        const send = expired ? await confirmExpiredCertificateNotice() : undefined;
        if (expired && send === undefined) continue;
        await setBusinessCertificateReminder('intranet', row.id!, command === 'enable', send);
      } else continue;
      completed++;
    } catch { /* The request layer reports failures for individual certificates. */ }
  }
  ElMessage.info(`已完成 ${completed} 条，其余 ${selected.length - completed} 条未变更`);
  await loadList();
}

async function openDetail(row: Pick<IntranetCert, 'id'>) {
  detail.value = unwrap<IntranetCert>(await getIntranetCert(row.id!));
  detailOpen.value = true;
}

async function downloadCertificate(row: IntranetCert, format: 'cer' | 'pem' | 'p7b') {
  try {
    const response = await downloadIntranetCert(row.id!, format);
    const blob = await certificateDownloadBlob(response, 'application/octet-stream');
    FileSaver.saveAs(blob, `${row.serialNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.${format}`);
  } catch (error: any) {
    ElMessage.error(error?.message || '证书下载失败');
  }
}

async function submitForm() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const creating = form.id == null;
    const saved = unwrap<IntranetCert>(await saveIntranetCert(form));
    if (creating && !saved.reminderEnabled && businessCertificateExpired(saved.notAfter)) {
      await ElMessageBox.alert('证书已过期，自动通知已关闭。如需提醒，可在台账中手动开启。', '证书已过期', { type: 'warning' }).catch(() => undefined);
    } else {
      ElMessage.success('内网证书台账已保存');
    }
    formOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function handleRemove(row: IntranetCert) {
  await ElMessageBox.confirm(`确认删除证书台账 ${row.serialNumber}？`, '提示', { type: 'warning' });
  await removeIntranetCert(row.id!);
  ElMessage.success('台账已删除');
  loadList();
}

async function toggleReminder(row: IntranetCert, value: boolean) {
  const id = row.id;
  if (id == null || reminderSaving.has(id) || businessCertificateNoticeBlocked(row.notAfter)) return;
  reminderSaving.add(id);
  try {
    const expired = value && businessCertificateExpired(row.notAfter);
    const send = expired ? await confirmExpiredCertificateNotice() : undefined;
    if (expired && send === undefined) return;
    await setBusinessCertificateReminder('intranet', id, value, send);
    row.reminderEnabled = value;
    ElMessage.success(value ? '已开启提醒' : '已关闭提醒');
    if (send) void loadList();
  } finally {
    reminderSaving.delete(id);
  }
}

async function sendNotice(row: IntranetCert) {
  if (row.id == null || sendingNotice.value || businessCertificateNoticeBlocked(row.notAfter)) return;
  if (!(await confirmManualBusinessNotice('intranet', row.notAfter))) return;
  sendingNotice.value = true;
  try {
    const count = unwrap<number>(await notifyBusinessCertificates('intranet', [row.id]));
    ElMessage.info(count ? '通知已入队，发送结果请查看提醒结果' : '没有可发送的通知，请检查通知渠道和收件范围');
    if (count) void loadList();
  } finally {
    sendingNotice.value = false;
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

function employeeIsActive(row: FawvwEmployee) {
  return row.identityStatus !== 'LEFT' && isFawvwEmployeeSourceActive(row.sourceStatus);
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
    applicantStatus: employeeIsActive(row) ? 'ACTIVE' : 'LEFT'
  });
  employeeOpen.value = false;
}

async function handleExport() {
  const response: any = await exportIntranetCerts(queryPayload());
  const blob = response?.data instanceof Blob ? response.data : response;
  FileSaver.saveAs(blob, `fawvw_intranet_certs_${Date.now()}.csv`);
}

async function refreshOwnerStatus() {
  const count = unwrap<number>(await refreshIntranetOwnerStatus());
  ElMessage.success('人员状态已刷新');
  loadList();
}

async function loadPrefillFromRoute(path: string, source: unknown, serial: unknown) {
  const sourceCertId = typeof source === 'string' ? source : undefined;
  const serialNumber = typeof serial === 'string' ? serial : undefined;
  if (!path.endsWith('/ra-intranet-cert') || (!sourceCertId && !serialNumber)) return;
  const isCurrent = () => path === route.path && source === route.query.sourceCertId && serial === route.query.serialNumber;
  try {
    const data = unwrap<IntranetCertPrefill>(await prefillIntranetCert({ sourceCertId, serialNumber }));
    if (!isCurrent()) return;
    if (data.existing?.id) {
      formOpen.value = false;
      detail.value = data.existing;
      detailOpen.value = true;
      ElMessage.info('该证书已录入台账，已打开现有记录');
    } else if (data.cert) {
      detailOpen.value = false;
      resetForm();
      const { id, ...cert } = data.cert;
      Object.assign(form, cert, data.applicant, { sourceType: 'ISSUED', sourceCertId: id });
      formOpen.value = true;
    }
  } catch {
    // The request interceptor displays the error.
  } finally {
    if (isCurrent()) router.replace({ path, query: { ...route.query, sourceCertId: undefined, serialNumber: undefined } });
  }
}

function certStatusTag(status?: string) {
  const types: Record<string, string> = {
    VALID: 'success',
    NOT_YET_VALID: 'warning',
    EXPIRED: 'info',
    HOLD: 'warning',
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

watch(() => [route.path, route.query.sourceCertId, route.query.serialNumber] as const,
  ([path, source, serial]) => loadPrefillFromRoute(path, source, serial), { immediate: true });
onMounted(loadList);
useRaListRefreshOnReturn(loadList);
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
  .query-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
    gap: 12px 16px;

    :deep(.el-form-item) {
      min-width: 0;
      margin-bottom: 0;
    }

    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
      min-width: 0;
    }

    .query-actions {
      grid-column: -2 / -1;
    }

    .query-actions :deep(.el-form-item__content) {
      justify-content: flex-end;
    }
  }
  @media (max-width: 560px) {
    .query-form :deep(.el-form-item:not(.query-actions)) {
      display: block;
    }
    .query-form :deep(.el-form-item__label) {
      justify-content: flex-start;
    }
    .query-form :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }
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
