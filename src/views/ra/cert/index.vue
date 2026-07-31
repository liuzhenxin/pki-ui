<template>
  <div class="app-container ra-cert-page">
    <div v-show="showSearch" class="query-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="72px" class="query-form">
        <el-form-item label="序列号" prop="serialNumber">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="请输入证书序列号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书主题" prop="subject">
          <el-input v-model="queryParams.subject" clearable placeholder="请输入主题关键字" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书状态" prop="status">
          <el-select v-model="queryParams.status" clearable placeholder="全部状态">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" icon="Search" @click="handleQuery">查询</el-button>
          <el-button icon="RefreshLeft" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="list-toolbar">
      <div class="list-heading">
        <span class="list-title">证书列表</span>
        <el-tag type="info" effect="plain" round>{{ total }}</el-tag>
      </div>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </div>

    <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无证书数据" class="cert-table">
      <el-table-column label="证书序列号" prop="serialNumber" min-width="180" show-overflow-tooltip />
      <el-table-column label="证书主题" prop="subject" min-width="260" show-overflow-tooltip />
      <el-table-column label="所属部门" prop="deptName" min-width="140" show-overflow-tooltip />
      <el-table-column label="根证书" prop="rootName" min-width="150" show-overflow-tooltip />
      <el-table-column label="证书模板" prop="profileName" min-width="150" show-overflow-tooltip />
      <el-table-column label="生效时间" prop="notBefore" width="168" align="center">
        <template #default="{ row }">{{ parseTime(row.notBefore) || '-' }}</template>
      </el-table-column>
      <el-table-column label="失效时间" prop="notAfter" width="168" align="center">
        <template #default="{ row }">{{ parseTime(row.notAfter) || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="108" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="light">{{ row.statusName || statusName(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="查看详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
          <el-dropdown trigger="click" @command="(format: string) => handleDownload(format, row)">
            <el-button link type="primary" icon="Download" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pem">PEM 证书 (.pem)</el-dropdown-item>
                <el-dropdown-item command="cer">CER 证书 (.cer)</el-dropdown-item>
                <el-dropdown-item command="p7b">P7B 证书链 (.p7b)</el-dropdown-item>
                <el-dropdown-item v-if="row.pkcs12Available" command="pkcs12" divided>PKCS#12 (.p12)</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="detailOpen" title="证书详情" width="920px" append-to-body class="ra-cert-detail-dialog">
      <el-descriptions :column="2" border class="detail-descriptions">
        <el-descriptions-item label="证书序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书状态">
          <el-tag :type="statusTagType(detail.status)" effect="light">{{ detail.statusName || statusName(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="证书主题" :span="2">{{ detail.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="请求主题" :span="2">{{ detail.requestSubject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属部门">{{ detail.deptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请用户ID">{{ detail.userId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="根证书">{{ detail.rootName || detail.rootId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书模板">{{ detail.profileName || detail.profileId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生效时间">{{ parseTime(detail.notBefore) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="失效时间">{{ parseTime(detail.notAfter) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SHA-1指纹" :span="2">{{ detail.sha1 || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.revoked" label="注销时间">{{ parseTime(detail.revocationTime) || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.revoked" label="注销原因">{{ revocationReasonName(detail.revocationReason) }}</el-descriptions-item>
      </el-descriptions>

      <div class="pem-header">
        <span>PEM 证书</span>
        <div class="pem-actions">
          <el-button icon="CopyDocument" @click="copyPem">复制</el-button>
          <el-button type="primary" icon="Download" @click="downloadPem">下载 PEM</el-button>
        </div>
      </div>
      <el-input v-model="detail.cert" type="textarea" :rows="11" readonly class="pem-textarea" />

      <template #footer>
        <el-button type="primary" @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pkcs12Open" title="导出 PKCS#12" width="480px" append-to-body @closed="resetPkcs12Form">
      <el-alert type="warning" :closable="false" show-icon title="PKCS#12 包含证书私钥，请设置高强度导出口令并妥善保管。" />
      <el-form ref="pkcs12FormRef" :model="pkcs12Form" :rules="pkcs12Rules" label-width="92px" class="pkcs12-form">
        <el-form-item label="证书序列号">
          <el-input :model-value="selectedCert?.serialNumber || '-'" disabled />
        </el-form-item>
        <el-form-item label="导出口令" prop="password">
          <el-input v-model="pkcs12Form.password" type="password" show-password autocomplete="new-password" placeholder="请输入导出口令" />
        </el-form-item>
        <el-form-item label="确认口令" prop="confirmPassword">
          <el-input v-model="pkcs12Form.confirmPassword" type="password" show-password autocomplete="new-password" placeholder="请再次输入导出口令" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pkcs12Open = false">取消</el-button>
        <el-button type="primary" icon="Download" :loading="pkcs12Loading" @click="submitPkcs12Export">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaCert" lang="ts">
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { downloadRaCert, downloadRaPkcs12, getRaCert, pageRaCert, RaCertStatus, RaCertSummary } from '@/api/ra/cert';

const rows = ref<RaCertSummary[]>([]);
const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const detailOpen = ref(false);
const detail = ref<Record<string, any>>({});
const queryFormRef = ref<FormInstance>();
const pkcs12Open = ref(false);
const pkcs12Loading = ref(false);
const selectedCert = ref<RaCertSummary>();
const pkcs12FormRef = ref<FormInstance>();
const pkcs12Form = reactive({ password: '', confirmPassword: '' });
const pkcs12Rules: FormRules = {
  password: [
    { required: true, message: '请输入导出口令', trigger: 'blur' },
    { min: 8, message: '导出口令至少8个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入导出口令', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== pkcs12Form.password) {
          callback(new Error('两次输入的口令不一致'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ]
};

const statusOptions = [
  { label: '有效', value: 'VALID' },
  { label: '尚未生效', value: 'NOT_YET_VALID' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '已注销', value: 'REVOKED' }
];

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  serialNumber: '',
  subject: '',
  status: '' as RaCertStatus | ''
});

function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function getList() {
  loading.value = true;
  try {
    const page = unwrapData<any>(
      await pageRaCert({
        pageNum: queryParams.pageNum,
        pageSize: queryParams.pageSize,
        serialNumber: queryParams.serialNumber || undefined,
        subject: queryParams.subject || undefined,
        status: queryParams.status || undefined
      })
    );
    rows.value = page?.rows || page?.records || [];
    total.value = Number(page?.total || 0);
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
  queryParams.serialNumber = '';
  queryParams.subject = '';
  queryParams.status = '';
  handleQuery();
}

async function handleDetail(row: RaCertSummary) {
  const data = unwrapData<any>(await getRaCert(row.id));
  detail.value = { ...(data?.summary || row), ...data };
  detailOpen.value = true;
}

function statusTagType(status?: RaCertStatus) {
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    VALID: 'success',
    NOT_YET_VALID: 'warning',
    EXPIRED: 'info',
    REVOKED: 'danger'
  };
  return types[status || ''] || 'info';
}

function statusName(status?: RaCertStatus) {
  return statusOptions.find((item) => item.value === status)?.label || '未知';
}

function revocationReasonName(reason?: number) {
  const names: Record<number, string> = {
    0: '未指定',
    1: '密钥泄露',
    2: 'CA密钥泄露',
    3: '从属关系变更',
    4: '证书被替代',
    5: '停止运营',
    6: '证书挂起',
    9: '权限撤回',
    10: 'AA密钥泄露'
  };
  return names[Number(reason)] || `原因代码 ${reason ?? '-'}`;
}

async function copyPem() {
  if (!detail.value.cert) return;
  await navigator.clipboard.writeText(detail.value.cert);
  ElMessage.success('证书已复制');
}

function downloadPem() {
  if (!detail.value.cert) return;
  const blob = new Blob([detail.value.cert], { type: 'application/x-pem-file;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${detail.value.serialNumber || 'certificate'}.pem`;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleDownload(format: string, row: RaCertSummary) {
  if (format === 'pkcs12') {
    selectedCert.value = row;
    pkcs12Open.value = true;
    return;
  }
  try {
    const response = await downloadRaCert(row.id, format as 'pem' | 'cer' | 'p7b');
    const mimeTypes: Record<string, string> = {
      pem: 'application/x-pem-file',
      cer: 'application/pkix-cert',
      p7b: 'application/x-pkcs7-certificates'
    };
    saveBlob(toBlob(response, mimeTypes[format]), `${row.serialNumber}.${format}`);
  } catch {
    ElMessage.error('证书下载失败');
  }
}

async function submitPkcs12Export() {
  if (!selectedCert.value || !(await pkcs12FormRef.value?.validate().catch(() => false))) return;
  pkcs12Loading.value = true;
  try {
    const response = await downloadRaPkcs12(selectedCert.value.id, pkcs12Form.password);
    saveBlob(toBlob(response, 'application/x-pkcs12'), `${selectedCert.value.serialNumber}.p12`);
    pkcs12Open.value = false;
    ElMessage.success('PKCS#12 下载已开始');
  } catch {
    ElMessage.error('PKCS#12 导出失败');
  } finally {
    pkcs12Loading.value = false;
  }
}

function toBlob(response: any, mimeType: string) {
  const value = response?.data instanceof Blob ? response.data : response;
  return value instanceof Blob ? value : new Blob([value], { type: mimeType });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function resetPkcs12Form() {
  selectedCert.value = undefined;
  pkcs12Form.password = '';
  pkcs12Form.confirmPassword = '';
  pkcs12FormRef.value?.clearValidate();
}

onMounted(getList);
</script>

<style scoped lang="scss">
.ra-cert-page {
  .query-panel {
    margin-bottom: 12px;
    padding: 14px 16px 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-extra-light);
  }

  .query-form {
    display: flex;
    flex-wrap: wrap;

    :deep(.el-form-item) {
      margin-right: 18px;
      margin-bottom: 14px;
    }

    :deep(.el-input),
    :deep(.el-select) {
      width: 220px;
    }
  }

  .query-actions {
    margin-left: auto;
    margin-right: 0 !important;
  }

  .list-toolbar,
  .list-heading {
    display: flex;
    align-items: center;
  }

  .list-toolbar {
    justify-content: space-between;
    min-height: 42px;
  }

  .list-heading {
    gap: 8px;
  }

  .list-title {
    font-size: 15px;
    font-weight: 600;
  }

  .cert-table {
    :deep(.el-table__header th) {
      color: var(--el-text-color-regular);
      font-weight: 600;
      background: var(--el-fill-color-light);
    }
  }

  @media (max-width: 900px) {
    .query-form {
      display: block;

      :deep(.el-form-item) {
        display: flex;
        margin-right: 0;
      }

      :deep(.el-form-item__content),
      :deep(.el-input),
      :deep(.el-select) {
        width: 100%;
      }
    }

    .query-actions {
      margin-left: 0;

      :deep(.el-form-item__content) {
        justify-content: flex-end;
      }
    }
  }
}

:global(.ra-cert-detail-dialog) {
  max-width: calc(100vw - 32px);
}

:global(.ra-cert-detail-dialog .detail-descriptions .el-descriptions__label) {
  width: 112px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

:global(.ra-cert-detail-dialog .pem-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0 10px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

:global(.ra-cert-detail-dialog .pem-actions) {
  display: flex;
  gap: 8px;
}

:global(.ra-cert-detail-dialog .pem-textarea textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  line-height: 1.55;
}

.pkcs12-form {
  margin-top: 18px;

  :deep(.el-input) {
    width: 100%;
  }
}
</style>
