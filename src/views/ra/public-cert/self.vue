<template>
  <div class="public-cert-self">
    <div v-if="!portalReady" class="portal-login-shell">
      <el-card class="portal-login-card" shadow="never">
        <h1>公网证书申请</h1>
        <p>请输入域账号完成身份认证后继续。</p>
        <el-form @submit.prevent="handleLogin">
          <el-form-item label="域账号">
            <el-input v-model="loginAccount" clearable placeholder="例如 ext0085" @keyup.enter="handleLogin" />
          </el-form-item>
          <el-button type="primary" :loading="loginLoading" class="login-button" @click="handleLogin">前往身份认证</el-button>
        </el-form>
      </el-card>
    </div>

    <div v-else class="self-shell">
      <header class="self-header">
        <div>
          <h1>公网证书申请</h1>
          <span>{{ access.employeeName || access.domainAccount || '-' }}</span>
        </div>
        <div class="header-actions">
          <el-button type="primary" icon="Plus" :disabled="!access.granted" @click="openCreate">新增证书</el-button>
          <el-button @click="handleLogout">退出</el-button>
        </div>
      </header>

      <el-alert v-if="!access.granted" title="当前账号未开通公网证书录入权限，请联系证书管理员授权。" type="warning" show-icon :closable="false" />

      <el-card v-else shadow="never">
        <el-form :model="queryParams" inline>
          <el-form-item label="域名">
            <el-input v-model="queryParams.domainName" clearable placeholder="域名" style="width: 220px" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="审核状态">
            <el-select v-model="queryParams.approvalStatus" clearable placeholder="全部" style="width: 130px">
              <el-option label="草稿" value="DRAFT" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已驳回" value="REJECTED" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loading" :data="rows" border stripe>
          <el-table-column label="域名" prop="domainName" min-width="200" fixed show-overflow-tooltip />
          <el-table-column label="证书类型" prop="certTypeName" width="110" />
          <el-table-column label="使用系统" prop="systemName" min-width="150" show-overflow-tooltip />
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
          <el-table-column label="操作" width="136" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" icon="View" @click="openDetail(row)" />
              <el-button v-if="row.approvalStatus !== 'PENDING'" link type="primary" icon="Edit" @click="openEdit(row)" />
              <el-button
                v-if="['DRAFT', 'REJECTED'].includes(row.approvalStatus || '')"
                link
                type="success"
                icon="Promotion"
                @click="handleSubmit(row)"
              />
            </template>
          </el-table-column>
        </el-table>

        <pagination
          v-show="total > 0"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          :total="total"
          @pagination="loadList"
        />
      </el-card>
    </div>

    <el-drawer v-model="formOpen" :title="form.id ? '修改公网证书' : '新增公网证书'" size="720px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="116px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="证书类型" prop="certTypeId">
              <el-select v-model="form.certTypeId" style="width: 100%" @change="onTypeChange">
                <el-option v-for="item in types" :key="String(item.id)" :label="item.typeName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="域名" prop="domainName">
              <el-input v-model="form.domainName" clearable />
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
            <el-form-item label="到期时间" prop="notAfter">
              <el-date-picker v-model="form.notAfter" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="业务负责人" prop="businessOwnerName">
              <el-input v-model="form.businessOwnerName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责人邮箱">
              <el-input v-model="form.businessOwnerEmail" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="科室">
              <el-input v-model="form.departmentName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="使用系统" prop="systemName">
              <el-input v-model="form.systemName" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="使用详情">
          <div class="usage-editor">
            <div v-for="(item, index) in form.usages" :key="index" class="usage-row">
              <el-input v-model="item.systemName" placeholder="系统名称" />
              <el-input v-model="item.usageDomain" placeholder="使用域名" />
              <el-input v-model="item.usageScene" placeholder="使用场景" />
              <el-button link type="danger" icon="Delete" @click="removeUsage(index)" />
            </div>
            <el-button type="primary" link icon="Plus" @click="addUsage">新增使用详情</el-button>
          </div>
        </el-form-item>
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

    <el-drawer v-model="detailOpen" title="公网证书详情" size="620px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="域名">{{ detail.cert?.domainName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">{{ detail.cert?.approvalStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核意见">{{ detail.cert?.approvalComment || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务负责人">{{ detail.cert?.businessOwnerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="使用系统">{{ detail.cert?.systemName || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">使用详情</el-divider>
      <el-table :data="detail.usages || []" border size="small">
        <el-table-column label="系统" prop="systemName" min-width="130" />
        <el-table-column label="域名" prop="usageDomain" min-width="150" />
        <el-table-column label="场景" prop="usageScene" min-width="160" />
      </el-table>
      <el-divider content-position="left">附件</el-divider>
      <el-upload :show-file-list="false" :before-upload="beforeUpload" :http-request="uploadAttachment">
        <el-button icon="Upload">上传压缩包</el-button>
      </el-upload>
      <el-table :data="detail.attachments || []" border size="small" class="mt12">
        <el-table-column label="文件名" prop="originalName" min-width="220" />
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ fileSize(row.fileSize) }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup name="RaPublicCertSelf" lang="ts">
import { ElMessage, FormInstance, FormRules, UploadRequestOptions } from 'element-plus';
import { PublicCert, PublicCertDetail, PublicCertQuery, PublicCertType, SelfAccess } from '@/api/ra/publicCert';
import {
  getPublicCertPortal,
  getPublicCertPortalAccess,
  listPublicCertPortalTypes,
  loginPublicCertPortal,
  logoutPublicCertPortal,
  pagePublicCertPortal,
  savePublicCertPortal,
  submitPublicCertPortal,
  uploadPublicCertPortalAttachment
} from '@/api/ra/publicCertPortal';

const portalStorageKey = 'fawvw-public-cert-portal-token';
const portalToken = ref(sessionStorage.getItem(portalStorageKey) || '');
const portalReady = ref(false);
const loginAccount = ref('');
const loginLoading = ref(false);

const access = ref<SelfAccess>({ granted: false });
const rows = ref<PublicCert[]>([]);
const total = ref(0);
const loading = ref(false);
const formOpen = ref(false);
const detailOpen = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const types = ref<PublicCertType[]>([]);
const detail = ref<Partial<PublicCertDetail>>({ cert: {}, usages: [], attachments: [], auditLogs: [] });

const queryParams = reactive<PublicCertQuery>({
  pageNum: 1,
  pageSize: 10,
  domainName: '',
  approvalStatus: ''
});

const emptyForm = (): PublicCert => ({
  domainName: '',
  certTypeId: '',
  certTypeName: '',
  serialNumber: '',
  issuer: '',
  vendor: '',
  notAfter: '',
  businessOwnerName: access.value.employeeName || '',
  businessOwnerAccount: access.value.domainAccount || '',
  systemName: '',
  reminderEnabled: true,
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

async function loadAccess() {
  access.value = await getPublicCertPortalAccess(portalToken.value);
}

async function loadTypes() {
  types.value = (await listPublicCertPortalTypes(portalToken.value)) || [];
}

async function loadList() {
  if (!access.value.granted) return;
  loading.value = true;
  try {
    const page = await pagePublicCertPortal(portalToken.value, queryParams);
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
  queryParams.domainName = '';
  queryParams.approvalStatus = '';
  loadList();
}

function resetForm() {
  Object.assign(form, emptyForm());
  formRef.value?.clearValidate();
}

async function openCreate() {
  await loadTypes();
  resetForm();
  formOpen.value = true;
}

async function openEdit(row: PublicCert) {
  await loadTypes();
  const data = await getPublicCertPortal(portalToken.value, row.id!);
  resetForm();
  Object.assign(form, data.cert, { usages: data.usages || [] });
  formOpen.value = true;
}

async function openDetail(row: PublicCert) {
  detail.value = await getPublicCertPortal(portalToken.value, row.id!);
  detailOpen.value = true;
}

async function submitForm(thenSubmit: boolean) {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const saved = await savePublicCertPortal(portalToken.value, form);
    if (thenSubmit) {
      await submitPublicCertPortal(portalToken.value, saved.cert.id!);
      ElMessage.success('已提交审核');
    } else {
      ElMessage.success('已保存草稿');
    }
    formOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function handleSubmit(row: PublicCert) {
  await submitPublicCertPortal(portalToken.value, row.id!);
  ElMessage.success('已提交审核');
  loadList();
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

function beforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['zip', 'rar'].includes(ext || '')) {
    ElMessage.warning('附件仅支持 zip 或 rar');
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('附件不能超过 10MB');
    return false;
  }
  return true;
}

async function uploadAttachment(option: UploadRequestOptions) {
  await uploadPublicCertPortalAttachment(portalToken.value, detail.value.cert!.id!, option.file as File);
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

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ') : '-';
}

function fileSize(value?: number) {
  if (!value) return '0B';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

async function initialisePortal() {
  if (!portalToken.value) return;
  try {
    await loadAccess();
    portalReady.value = true;
    await loadTypes();
    await loadList();
  } catch (error: any) {
    portalToken.value = '';
    sessionStorage.removeItem(portalStorageKey);
    ElMessage.warning(error?.message || '登录已失效，请重新认证');
  }
}

async function handleLogin() {
  if (!loginAccount.value.trim()) {
    ElMessage.warning('请输入域账号');
    return;
  }
  loginLoading.value = true;
  try {
    const result = await loginPublicCertPortal(loginAccount.value.trim());
    portalToken.value = result.token;
    sessionStorage.setItem(portalStorageKey, result.token);
    access.value = result.access;
    portalReady.value = true;
    await loadTypes();
    await loadList();
  } catch (error: any) {
    ElMessage.error(error?.message || '身份认证失败');
  } finally {
    loginLoading.value = false;
  }
}

async function handleLogout() {
  try {
    await logoutPublicCertPortal(portalToken.value);
  } catch {
    // The local session still needs to be cleared after a network failure.
  }
  portalToken.value = '';
  portalReady.value = false;
  rows.value = [];
  access.value = { granted: false };
  sessionStorage.removeItem(portalStorageKey);
}

onMounted(initialisePortal);
</script>

<style scoped lang="scss">
.public-cert-self {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 24px;
}

.self-shell {
  max-width: 1280px;
  margin: 0 auto;
}

.portal-login-shell {
  min-height: calc(100vh - 48px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.portal-login-card {
  width: min(420px, 100%);

  h1 {
    margin: 0 0 10px;
    font-size: 22px;
    color: #1f2d3d;
  }

  p {
    margin: 0 0 22px;
    color: #606266;
  }
}

.login-button {
  width: 100%;
}

.self-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h1 {
    margin: 0 0 4px;
    font-size: 22px;
    line-height: 30px;
    color: #1f2d3d;
  }

  span {
    color: #606266;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.usage-editor {
  width: 100%;
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
</style>
