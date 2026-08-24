<template>
  <div class="app-container public-cert-page">
    <el-card shadow="never" class="query-card">
      <el-form :model="queryParams" inline>
        <el-form-item label="域名">
          <el-input v-model="queryParams.domainName" clearable placeholder="域名" style="width: 190px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="序列号" style="width: 170px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="系统">
          <el-input v-model="queryParams.systemName" clearable placeholder="使用系统" style="width: 160px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="queryParams.ownerKeyword" clearable placeholder="姓名/账号" style="width: 150px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="queryParams.approvalStatus" clearable placeholder="全部" style="width: 120px">
            <el-option label="草稿" value="DRAFT" />
            <el-option label="待审核" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已驳回" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书状态">
          <el-select v-model="queryParams.certStatus" clearable placeholder="全部" style="width: 120px">
            <el-option label="正常" value="NORMAL" />
            <el-option label="30天内过期" value="EXPIRING" />
            <el-option label="已过期" value="EXPIRED" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker
            v-model="notAfterRange"
            type="daterange"
            value-format="YYYY-MM-DD"
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
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8 toolbar-row">
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:add']" type="primary" plain icon="Plus" @click="openCreate">新增</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:export']" type="success" plain icon="Download" @click="handleExport">导出</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:type']" plain icon="Collection" @click="openTypes">证书类型</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:grant']" plain icon="UserFilled" @click="openGrants">录入授权</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
      </el-row>

      <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无公网证书台账">
        <el-table-column label="域名" prop="domainName" min-width="190" fixed show-overflow-tooltip />
        <el-table-column label="证书类型" prop="certTypeName" width="110" />
        <el-table-column label="序列号" prop="serialNumber" min-width="150" show-overflow-tooltip />
        <el-table-column label="使用系统" prop="systemName" min-width="150" show-overflow-tooltip />
        <el-table-column label="业务负责人" prop="businessOwnerName" width="110" show-overflow-tooltip />
        <el-table-column label="科室" prop="departmentName" min-width="140" show-overflow-tooltip />
        <el-table-column label="到期时间" prop="notAfter" width="166" align="center">
          <template #default="{ row }">{{ formatDateTime(row.notAfter) }}</template>
        </el-table-column>
        <el-table-column label="证书状态" width="112" align="center">
          <template #default="{ row }">
            <el-tag :type="certStatusType(row.certStatus)" effect="light">{{ row.certStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="approvalType(row.approvalStatus)" effect="plain">{{ row.approvalStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="负责人变更" width="106" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ownerChangeRequired" type="danger" effect="plain">需处理</el-tag>
            <el-tag v-else type="info" effect="plain">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="196" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button link type="primary" icon="View" @click="openDetail(row)" />
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ra:public-cert:edit']" link type="primary" icon="Edit" @click="openEdit(row)" />
            </el-tooltip>
            <el-tooltip content="提交" placement="top">
              <el-button
                v-if="['DRAFT', 'REJECTED'].includes(row.approvalStatus || '')"
                v-hasPermi="['ra:public-cert:add', 'ra:public-cert:edit']"
                link
                type="success"
                icon="Promotion"
                @click="handleSubmit(row)"
              />
            </el-tooltip>
            <el-tooltip content="审核" placement="top">
              <el-button v-if="row.approvalStatus === 'PENDING'" v-hasPermi="['ra:public-cert:audit']" link type="warning" icon="Finished" @click="openAudit(row)" />
            </el-tooltip>
            <el-tooltip content="归档" placement="top">
              <el-button v-hasPermi="['ra:public-cert:remove']" link type="danger" icon="Delete" @click="handleRemove(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <el-drawer v-model="formOpen" :title="form.id ? '修改公网证书' : '新增公网证书'" size="760px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="116px">
        <el-divider content-position="left">证书信息</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="证书类型" prop="certTypeId">
              <el-select v-model="form.certTypeId" filterable placeholder="请选择" style="width: 100%" @change="onTypeChange">
                <el-option v-for="item in types" :key="String(item.id)" :label="item.typeName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="域名" prop="domainName">
              <el-input v-model="form.domainName" clearable placeholder="example.faw-vw.com" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="证书序列号">
              <el-input v-model="form.serialNumber" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="颁发机构">
              <el-input v-model="form.issuer" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="供应商">
              <el-input v-model="form.vendor" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="过期提醒">
              <el-switch v-model="form.reminderEnabled" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="生效时间">
              <el-date-picker v-model="form.notBefore" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期时间" prop="notAfter">
              <el-date-picker v-model="form.notAfter" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">负责人</el-divider>
        <el-form-item label="证书维护人">
          <div class="inline-picker">
            <el-input v-model="form.maintainerName" clearable placeholder="证书维护人" />
            <el-button icon="User" @click="openEmployeePicker('maintainer')">选择</el-button>
          </div>
        </el-form-item>
        <el-form-item label="业务负责人" prop="businessOwnerName">
          <div class="inline-picker">
            <el-input v-model="form.businessOwnerName" clearable placeholder="业务负责人" />
            <el-button icon="User" @click="openEmployeePicker('owner')">选择</el-button>
          </div>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="负责人账号">
              <el-input v-model="form.businessOwnerAccount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责人邮箱">
              <el-input v-model="form.businessOwnerEmail" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="科室">
          <el-input v-model="form.departmentName" clearable />
        </el-form-item>

        <el-divider content-position="left">使用信息</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="使用系统" prop="systemName">
              <el-input v-model="form.systemName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="系统负责人">
              <el-input v-model="form.systemOwnerName" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="usage-head">
          <span>使用详情</span>
          <el-button type="primary" link icon="Plus" @click="addUsage">新增一条</el-button>
        </div>
        <div v-for="(item, index) in form.usages" :key="index" class="usage-row">
          <el-input v-model="item.systemName" placeholder="系统名称" />
          <el-input v-model="item.usageDomain" placeholder="使用域名" />
          <el-input v-model="item.usageScene" placeholder="使用场景" />
          <el-button link type="danger" icon="Delete" @click="removeUsage(index)" />
        </div>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm(false)">保存草稿</el-button>
        <el-button type="success" :loading="saving" @click="submitForm(true)">保存并提交</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="detailOpen" title="公网证书详情" size="680px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="域名">{{ detail.cert?.domainName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ formatDateTime(detail.cert?.notBefore) }} 至 {{ formatDateTime(detail.cert?.notAfter) }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">{{ detail.cert?.approvalStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务负责人">{{ detail.cert?.businessOwnerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ detail.cert?.departmentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="使用系统">{{ detail.cert?.systemName || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">使用详情</el-divider>
      <el-table :data="detail.usages || []" border size="small">
        <el-table-column label="系统" prop="systemName" min-width="130" />
        <el-table-column label="域名" prop="usageDomain" min-width="150" />
        <el-table-column label="场景" prop="usageScene" min-width="160" />
      </el-table>
      <el-divider content-position="left">附件</el-divider>
      <el-upload
        v-hasPermi="['ra:public-cert:attachment']"
        :show-file-list="false"
        :before-upload="beforeUpload"
        :http-request="uploadAttachment"
      >
        <el-button icon="Upload">上传压缩包</el-button>
      </el-upload>
      <el-table :data="detail.attachments || []" border size="small" class="mt12">
        <el-table-column label="文件名" prop="originalName" min-width="220" />
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ fileSize(row.fileSize) }}</template>
        </el-table-column>
      </el-table>
      <el-divider content-position="left">审核记录</el-divider>
      <el-timeline>
        <el-timeline-item v-for="log in detail.auditLogs || []" :key="String(log.id)" :timestamp="formatDateTime(log.createTime)">
          {{ log.operatorName || '-' }} {{ actionName(log.action) }}：{{ log.comment || '-' }}
        </el-timeline-item>
      </el-timeline>
    </el-drawer>

    <el-dialog v-model="auditOpen" title="公网证书审核" width="520px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="域名">{{ auditRow?.domainName }}</el-form-item>
        <el-form-item label="意见">
          <el-input v-model="auditComment" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditOpen = false">取消</el-button>
        <el-button type="danger" @click="handleReject">驳回</el-button>
        <el-button type="primary" @click="handleApprove">通过</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="employeeOpen" title="选择员工" width="940px" append-to-body>
      <el-form :model="employeeQuery" inline>
        <el-form-item label="关键词">
          <el-input v-model="employeeQuery.keyword" clearable placeholder="姓名/域账号/工号" style="width: 220px" @keyup.enter="loadEmployees" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="loadEmployees">搜索</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="employeeLoading" :data="employees" border stripe height="420" @row-dblclick="selectEmployee">
        <el-table-column label="姓名" prop="cnName" min-width="110" />
        <el-table-column label="域账号" prop="domainAccount" min-width="120" />
        <el-table-column label="工号" prop="employeeNo" min-width="110" />
        <el-table-column label="邮箱" prop="email" min-width="180" show-overflow-tooltip />
        <el-table-column label="科室" prop="departmentName" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="selectEmployee(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="employeeTotal > 0" v-model:page="employeeQuery.pageNum" v-model:limit="employeeQuery.pageSize" :total="employeeTotal" @pagination="loadEmployees" />
    </el-dialog>

    <el-dialog v-model="typeOpen" title="证书类型维护" width="760px" append-to-body>
      <el-form :model="typeDraft" inline class="mb12">
        <el-form-item label="编码">
          <el-input v-model="typeDraft.typeCode" clearable placeholder="如 SERVER_CERT" style="width: 180px" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="typeDraft.typeName" clearable placeholder="类型名称" style="width: 160px" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="typeDraft.sort" :min="1" :max="999" controls-position="right" style="width: 110px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Plus" @click="createType">新增</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="types" border stripe>
        <el-table-column label="编码" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.typeCode" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="130">
          <template #default="{ row }">
            <el-input v-model="row.typeName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="排序" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.sort" :min="1" :max="999" size="small" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="() => saveType(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="Check" @click="saveType(row)">保存</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="grantOpen" title="公网证书录入授权" width="940px" append-to-body>
      <el-form :model="grantQuery" inline>
        <el-form-item label="关键词">
          <el-input v-model="grantQuery.keyword" clearable placeholder="姓名/域账号" style="width: 220px" @keyup.enter="loadGrants" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="loadGrants">搜索</el-button>
          <el-button icon="User" @click="openEmployeePicker('grant')">新增授权</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="grants" border stripe>
        <el-table-column label="姓名" prop="employeeName" min-width="120" />
        <el-table-column label="域账号" prop="domainAccount" min-width="120" />
        <el-table-column label="邮箱" prop="employeeEmail" min-width="180" />
        <el-table-column label="科室" prop="departmentName" min-width="160" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="() => saveGrant(row)" />
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="grantTotal > 0" v-model:page="grantQuery.pageNum" v-model:limit="grantQuery.pageSize" :total="grantTotal" @pagination="loadGrants" />
    </el-dialog>
  </div>
</template>

<script setup name="RaPublicCert" lang="ts">
import FileSaver from 'file-saver';
import { ElMessage, ElMessageBox, FormInstance, FormRules, UploadRequestOptions } from 'element-plus';
import {
  approvePublicCert,
  exportPublicCerts,
  getPublicCert,
  grantPublicCertPermission,
  listPublicCertTypes,
  pagePublicCertPermissions,
  pagePublicCerts,
  PublicCert,
  PublicCertDetail,
  PublicCertPermission,
  PublicCertQuery,
  PublicCertType,
  rejectPublicCert,
  removePublicCert,
  savePublicCert,
  savePublicCertType,
  submitPublicCert,
  uploadPublicCertAttachment
} from '@/api/ra/publicCert';
import { FawvwEmployee, pageFawvwEmployees } from '@/api/ra/employee';

type PickerTarget = 'maintainer' | 'owner' | 'grant';

const rows = ref<PublicCert[]>([]);
const total = ref(0);
const loading = ref(false);
const showSearch = ref(true);
const formOpen = ref(false);
const detailOpen = ref(false);
const auditOpen = ref(false);
const employeeOpen = ref(false);
const typeOpen = ref(false);
const grantOpen = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const pickerTarget = ref<PickerTarget>('owner');
const auditRow = ref<PublicCert>();
const auditComment = ref('');

const queryParams = reactive<PublicCertQuery>({
  pageNum: 1,
  pageSize: 10,
  domainName: '',
  serialNumber: '',
  certTypeName: '',
  systemName: '',
  ownerKeyword: '',
  approvalStatus: '',
  certStatus: '',
  ownerChangeRequired: null,
  notAfterStart: '',
  notAfterEnd: ''
});
const notAfterRange = ref<string[]>([]);

const emptyForm = (): PublicCert => ({
  domainName: '',
  certTypeId: '',
  certTypeName: '',
  serialNumber: '',
  issuer: '',
  vendor: '',
  notBefore: '',
  notAfter: '',
  maintainerName: '',
  maintainerAccount: '',
  maintainerEmail: '',
  businessOwnerName: '',
  businessOwnerAccount: '',
  businessOwnerEmail: '',
  departmentName: '',
  systemName: '',
  systemOwnerName: '',
  systemOwnerAccount: '',
  systemOwnerEmail: '',
  reminderEnabled: true,
  remark: '',
  usages: []
});

const form = reactive<PublicCert>(emptyForm());
const rules: FormRules = {
  certTypeId: [{ required: true, message: '请选择证书类型', trigger: 'change' }],
  domainName: [{ required: true, message: '请输入域名', trigger: 'blur' }],
  businessOwnerName: [{ required: true, message: '请输入业务负责人', trigger: 'blur' }],
  systemName: [{ required: true, message: '请输入使用系统', trigger: 'blur' }],
  notAfter: [{ required: true, message: '请选择到期时间', trigger: 'change' }]
};

const detail = ref<Partial<PublicCertDetail>>({ cert: {}, usages: [], attachments: [], auditLogs: [] });
const types = ref<PublicCertType[]>([]);
const typeDraft = reactive<PublicCertType>({
  typeCode: '',
  typeName: '',
  sort: 100,
  enabled: true
});
const grants = ref<PublicCertPermission[]>([]);
const grantTotal = ref(0);
const grantQuery = reactive({ pageNum: 1, pageSize: 10, keyword: '', enabled: null as boolean | null });
const employees = ref<FawvwEmployee[]>([]);
const employeeTotal = ref(0);
const employeeLoading = ref(false);
const employeeQuery = reactive({ pageNum: 1, pageSize: 10, keyword: '', status: 'A' });

function unwrap<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function loadList() {
  loading.value = true;
  try {
    queryParams.notAfterStart = notAfterRange.value?.[0] || '';
    queryParams.notAfterEnd = notAfterRange.value?.[1] || '';
    const page = unwrap<any>(await pagePublicCerts(queryParams));
    rows.value = page.records || page.rows || [];
    total.value = Number(page.total || 0);
  } finally {
    loading.value = false;
  }
}

async function loadTypes(onlyEnabled = true) {
  types.value = unwrap<PublicCertType[]>(await listPublicCertTypes(onlyEnabled)) || [];
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}

function resetQuery() {
  Object.assign(queryParams, {
    pageNum: 1,
    pageSize: queryParams.pageSize,
    domainName: '',
    serialNumber: '',
    certTypeName: '',
    systemName: '',
    ownerKeyword: '',
    approvalStatus: '',
    certStatus: '',
    ownerChangeRequired: null,
    notAfterStart: '',
    notAfterEnd: ''
  });
  notAfterRange.value = [];
  loadList();
}

function resetForm() {
  Object.assign(form, emptyForm());
  formRef.value?.clearValidate();
}

async function openCreate() {
  await loadTypes(true);
  resetForm();
  formOpen.value = true;
}

async function openEdit(row: PublicCert) {
  await loadTypes(true);
  const data = unwrap<PublicCertDetail>(await getPublicCert(row.id!));
  resetForm();
  Object.assign(form, data.cert, { usages: data.usages || [] });
  formOpen.value = true;
}

async function openDetail(row: PublicCert) {
  detail.value = unwrap<PublicCertDetail>(await getPublicCert(row.id!));
  detailOpen.value = true;
}

async function submitForm(thenSubmit: boolean) {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const saved = unwrap<PublicCertDetail>(await savePublicCert(form));
    if (thenSubmit) {
      await submitPublicCert(saved.cert.id!);
      ElMessage.success('公网证书已提交审核');
    } else {
      ElMessage.success('公网证书已保存');
    }
    formOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function handleSubmit(row: PublicCert) {
  await submitPublicCert(row.id!);
  ElMessage.success('已提交审核');
  loadList();
}

function openAudit(row: PublicCert) {
  auditRow.value = row;
  auditComment.value = '';
  auditOpen.value = true;
}

async function handleApprove() {
  await approvePublicCert(auditRow.value!.id!, auditComment.value || '审核通过');
  ElMessage.success('已通过');
  auditOpen.value = false;
  loadList();
}

async function handleReject() {
  if (!auditComment.value.trim()) {
    ElMessage.warning('请输入驳回原因');
    return;
  }
  await rejectPublicCert(auditRow.value!.id!, auditComment.value);
  ElMessage.success('已驳回');
  auditOpen.value = false;
  loadList();
}

async function handleRemove(row: PublicCert) {
  await ElMessageBox.confirm(`确认归档公网证书 ${row.domainName}？`, '提示', { type: 'warning' });
  await removePublicCert(row.id!);
  ElMessage.success('已归档');
  loadList();
}

async function handleExport() {
  const res: any = await exportPublicCerts(queryParams);
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data || res]);
  FileSaver.saveAs(blob, 'fawvw-public-certs.csv');
}

function onTypeChange(value: string | number) {
  const type = types.value.find((item) => String(item.id) === String(value));
  form.certTypeName = type?.typeName || '';
}

function addUsage() {
  form.usages = form.usages || [];
  form.usages.push({ systemName: form.systemName || '', usageDomain: form.domainName || '', usageScene: '' });
}

function removeUsage(index: number) {
  form.usages?.splice(index, 1);
}

function openEmployeePicker(target: PickerTarget) {
  pickerTarget.value = target;
  employeeOpen.value = true;
  loadEmployees();
}

async function loadEmployees() {
  employeeLoading.value = true;
  try {
    const page = unwrap<any>(
      await pageFawvwEmployees({
        pageNum: employeeQuery.pageNum,
        pageSize: employeeQuery.pageSize,
        keyword: employeeQuery.keyword,
        status: employeeQuery.status
      })
    );
    employees.value = page.records || page.rows || [];
    employeeTotal.value = Number(page.total || 0);
  } finally {
    employeeLoading.value = false;
  }
}

async function selectEmployee(row: FawvwEmployee) {
  if (pickerTarget.value === 'maintainer') {
    Object.assign(form, {
      maintainerEmployeeId: row.id,
      maintainerIdentityKey: row.identityKey,
      maintainerName: row.cnName,
      maintainerAccount: row.domainAccount,
      maintainerEmail: row.email
    });
  } else if (pickerTarget.value === 'owner') {
    Object.assign(form, {
      businessOwnerEmployeeId: row.id,
      businessOwnerIdentityKey: row.identityKey,
      businessOwnerName: row.cnName,
      businessOwnerAccount: row.domainAccount,
      businessOwnerEmail: row.email,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      departmentPath: row.departmentNamePath
    });
  } else {
    await grantPublicCertPermission({
      employeeId: row.id,
      employeeIdentityKey: row.identityKey,
      domainAccount: row.domainAccount,
      employeeName: row.cnName,
      employeeEmail: row.email,
      departmentName: row.departmentName,
      enabled: true
    });
    ElMessage.success('授权已保存');
    loadGrants();
  }
  employeeOpen.value = false;
}

function openTypes() {
  typeOpen.value = true;
  loadTypes(false);
}

async function saveType(row: PublicCertType) {
  await savePublicCertType(row);
  ElMessage.success('证书类型已保存');
  loadTypes(false);
}

async function createType() {
  if (!typeDraft.typeCode?.trim() || !typeDraft.typeName?.trim()) {
    ElMessage.warning('请填写类型编码和名称');
    return;
  }
  await savePublicCertType(typeDraft);
  Object.assign(typeDraft, { typeCode: '', typeName: '', sort: 100, enabled: true });
  ElMessage.success('证书类型已新增');
  loadTypes(false);
}

function openGrants() {
  grantOpen.value = true;
  loadGrants();
}

async function loadGrants() {
  const page = unwrap<any>(await pagePublicCertPermissions(grantQuery));
  grants.value = page.records || page.rows || [];
  grantTotal.value = Number(page.total || 0);
}

async function saveGrant(row: PublicCertPermission) {
  await grantPublicCertPermission(row);
  ElMessage.success('授权已保存');
  loadGrants();
}

function beforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['zip', 'rar'].includes(ext || '')) {
    ElMessage.warning('附件仅支持 zip 或 rar');
    return false;
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.warning('附件不能超过 50MB');
    return false;
  }
  return true;
}

async function uploadAttachment(option: UploadRequestOptions) {
  await uploadPublicCertAttachment(detail.value.cert!.id!, option.file as File);
  ElMessage.success('附件已上传');
  await openDetail(detail.value.cert as PublicCert);
}

function certStatusType(status?: string) {
  if (status === 'EXPIRED') return 'danger';
  if (status === 'EXPIRING') return 'warning';
  return 'success';
}

function approvalType(status?: string) {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'info';
}

function actionName(action?: string) {
  return (
    {
      CREATE: '创建',
      UPDATE: '修改',
      SUBMIT: '提交',
      APPROVE: '通过',
      REJECT: '驳回',
      ATTACHMENT: '附件',
      ARCHIVE: '归档'
    } as Record<string, string>
  )[action || ''] || action;
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ') : '-';
}

function fileSize(value?: number) {
  if (!value) return '0B';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

onMounted(() => {
  loadTypes(true);
  loadList();
});
</script>

<style scoped lang="scss">
.public-cert-page {
  .query-card {
    margin-bottom: 12px;
  }

  .table-card {
    min-height: 520px;
  }

  .toolbar-row {
    align-items: center;
  }

  .inline-picker {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    width: 100%;
  }

  .usage-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    color: #303133;
    font-weight: 600;
  }

  .usage-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 8px;
    margin-bottom: 8px;
  }

  .mt12 {
    margin-top: 12px;
  }
}
</style>
