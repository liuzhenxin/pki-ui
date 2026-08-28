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
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="查看详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
          <el-tooltip content="录入证书管理系统" placement="top">
            <el-button link type="warning" icon="DocumentAdd" @click="openIntranetCertLedger(row)" />
          </el-tooltip>
          <el-tooltip v-if="row.keySource === 'KMC'" content="RSA密钥恢复" placement="top">
            <el-button link type="primary" icon="Key" @click="openRecover(row)" />
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
        <el-descriptions-item v-if="detail.status === 'HOLD'" label="冻结时间">{{ parseTime(detail.revocationTime) || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.status === 'HOLD'" label="冻结原因">证书挂起</el-descriptions-item>
        <el-descriptions-item v-if="detail.revoked && detail.status !== 'HOLD'" label="注销时间">{{
          parseTime(detail.revocationTime) || '-'
        }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.revoked && detail.status !== 'HOLD'" label="注销原因">{{
          revocationReasonName(detail.revocationReason)
        }}</el-descriptions-item>
        <el-descriptions-item v-if="kmcKeyStatus" label="KMC密钥标识">{{ kmcKeyStatus.keyId || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="kmcKeyStatus" label="KMC密钥状态"
          >{{ kmcKeyStatus.statusText || '-' }}（{{ kmcKeyStatus.algorithm || 'RSA' }} {{ kmcKeyStatus.keySize || '' }}）</el-descriptions-item
        >
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

    <el-dialog v-model="recoverOpen" title="RSA密钥恢复" width="560px" append-to-body @closed="resetRecoverForm">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="恢复会从KMC取出原RSA加密私钥。USBKey写入SKF导入信封；签发到文件则下载PKCS#12，序列号与有效期不变。"
      />
      <el-form ref="recoverFormRef" :model="recoverForm" :rules="recoverRules" label-width="110px" class="pkcs12-form">
        <el-form-item label="证书序列号">
          <el-input :model-value="recoveringCert?.serialNumber || '-'" disabled />
        </el-form-item>
        <el-form-item label="输出方式" prop="issueType">
          <el-radio-group v-model="recoverForm.issueType" @change="onRecoverIssueTypeChange">
            <el-radio-button value="usb_key">USB Key</el-radio-button>
            <el-radio-button value="file">签发到文件</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="recoverForm.issueType === 'usb_key'">
          <el-form-item label="厂商" prop="provider">
            <el-select v-model="recoverForm.provider" placeholder="请选择厂商" @change="onRecoverProviderChange">
              <el-option v-for="item in recoverProviders" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="设备" prop="device">
            <el-select v-model="recoverForm.device" placeholder="请选择设备" @change="onRecoverDeviceChange">
              <el-option v-for="item in recoverDevices" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="应用" prop="appName">
            <el-select v-model="recoverForm.appName" placeholder="请选择应用">
              <el-option v-for="item in recoverApps" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="新容器" prop="containerName">
            <el-input v-model="recoverForm.containerName" placeholder="恢复将写入新容器" />
          </el-form-item>
          <el-form-item label="PIN码" prop="pin">
            <el-input v-model="recoverForm.pin" type="password" show-password />
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="文件口令" prop="filePassword">
            <el-input v-model="recoverForm.filePassword" type="password" show-password autocomplete="new-password" />
          </el-form-item>
          <el-form-item label="确认口令" prop="confirmPassword">
            <el-input v-model="recoverForm.confirmPassword" type="password" show-password autocomplete="new-password" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="recoverOpen = false">取消</el-button>
        <el-button type="primary" :loading="recoverLoading" @click="submitRecover">确认恢复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaCert" lang="ts">
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import {
  downloadRaCert,
  downloadRaPkcs12,
  getRaCert,
  pageRaCert,
  queryRaKmcKeyStatus,
  recoverRaKey,
  RaCertStatus,
  RaCertSummary,
  RaKmcKeyStatus
} from '@/api/ra/cert';
import SKFClient from '@/api/skf/skf_api';

const rows = ref<RaCertSummary[]>([]);
const router = useRouter();
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
const kmcKeyStatus = ref<RaKmcKeyStatus | null>(null);
const recoverOpen = ref(false);
const recoverLoading = ref(false);
const recoveringCert = ref<RaCertSummary>();
const recoverFormRef = ref<FormInstance>();
const recoverProviders = ref<string[]>([]);
const recoverDevices = ref<string[]>([]);
const recoverApps = ref<string[]>([]);
const recoverForm = reactive({
  issueType: 'usb_key' as 'usb_key' | 'file',
  provider: '',
  device: '',
  appName: '',
  containerName: '',
  pin: '123456',
  filePassword: '',
  confirmPassword: ''
});
const recoverRules = computed<FormRules>(() => {
  const usb = recoverForm.issueType === 'usb_key';
  return {
    provider: usb ? [{ required: true, message: '请选择厂商', trigger: 'change' }] : [],
    device: usb ? [{ required: true, message: '请选择设备', trigger: 'change' }] : [],
    appName: usb ? [{ required: true, message: '请选择应用', trigger: 'change' }] : [],
    containerName: usb ? [{ required: true, message: '请输入容器名称', trigger: 'blur' }] : [],
    pin: usb ? [{ required: true, message: '请输入PIN码', trigger: 'blur' }] : [],
    filePassword: usb
      ? []
      : [
          { required: true, message: '请输入文件口令', trigger: 'blur' },
          { min: 8, message: '文件口令至少8个字符', trigger: 'blur' }
        ],
    confirmPassword: usb
      ? []
      : [
          { required: true, message: '请再次输入文件口令', trigger: 'blur' },
          {
            validator: (_rule, value, callback) => {
              if (value !== recoverForm.filePassword) {
                callback(new Error('两次输入的口令不一致'));
                return;
              }
              callback();
            },
            trigger: 'blur'
          }
        ]
  };
});
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
  { label: '已冻结', value: 'HOLD' },
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
  kmcKeyStatus.value = null;
  detailOpen.value = true;
  if (String(detail.value.keySource || row.keySource || '').toUpperCase() === 'KMC') {
    try {
      kmcKeyStatus.value = unwrapData<RaKmcKeyStatus>(await queryRaKmcKeyStatus(row.id));
    } catch {
      kmcKeyStatus.value = null;
    }
  }
}

function openIntranetCertLedger(row: RaCertSummary) {
  router.push({
    path: '/ra-certificate/ra-intranet-cert',
    query: {
      sourceCertId: String(row.id),
      serialNumber: row.serialNumber
    }
  });
}

function statusTagType(status?: RaCertStatus) {
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    VALID: 'success',
    NOT_YET_VALID: 'warning',
    EXPIRED: 'info',
    HOLD: 'warning',
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

let skfClientPromise: Promise<any> | null = null;
const getSkfClient = async () => {
  if (skfClientPromise) return skfClientPromise;
  const skf = new SKFClient('ws://127.0.0.1:9001');
  skfClientPromise = skf.connect().then(async (client: any) => {
    try {
      await client.setLanguage('CN');
    } catch {
      // ignore
    }
    return client;
  });
  return skfClientPromise;
};

function pemToBase64(pem: string) {
  return String(pem || '')
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '');
}

async function openRecover(row: RaCertSummary) {
  // 非 RSA（SM2 等）KMC 加密证书：RSA 密钥协议无法恢复，引导走 KMP
  if (String(row.keySource || '').toUpperCase() === 'KMC') {
    try {
      const status = unwrapData<RaKmcKeyStatus>(await queryRaKmcKeyStatus(row.id));
      if (status?.algorithm && status.algorithm.toUpperCase() !== 'RSA') {
        ElMessage.warning(`该证书为 ${status.algorithm} 加密证书，密钥恢复请到 KMC/CA 侧执行 KMP 密钥恢复`);
        return;
      }
    } catch {
      // 状态查询失败时放行，交由后端校验兜底
    }
  }
  recoveringCert.value = row;
  recoverForm.issueType = 'usb_key';
  recoverForm.containerName = `enc-${Date.now()}`;
  recoverOpen.value = true;
  await refreshRecoverProviders();
}

function resetRecoverForm() {
  recoveringCert.value = undefined;
  recoverForm.provider = '';
  recoverForm.device = '';
  recoverForm.appName = '';
  recoverForm.containerName = '';
  recoverForm.pin = '123456';
  recoverForm.filePassword = '';
  recoverForm.confirmPassword = '';
  recoverFormRef.value?.clearValidate();
}

async function onRecoverIssueTypeChange() {
  recoverFormRef.value?.clearValidate();
  if (recoverForm.issueType === 'usb_key') {
    await refreshRecoverProviders();
  }
}

async function refreshRecoverProviders() {
  recoverProviders.value = [];
  recoverDevices.value = [];
  recoverApps.value = [];
  try {
    skfClientPromise = null;
    const skf = await getSkfClient();
    recoverProviders.value = await skf.enumProvider();
    if (recoverProviders.value.length > 0) {
      recoverForm.provider = recoverProviders.value[0];
      await onRecoverProviderChange();
    }
  } catch (error: any) {
    ElMessage.error(`无法连接 SKF 服务: ${error?.message || error || '未知错误'}`);
  }
}

async function onRecoverProviderChange() {
  recoverDevices.value = [];
  recoverApps.value = [];
  recoverForm.device = '';
  recoverForm.appName = '';
  if (!recoverForm.provider) return;
  const skf = await getSkfClient();
  recoverDevices.value = await skf.enumDevice(recoverForm.provider);
  if (recoverDevices.value.length > 0) {
    recoverForm.device = recoverDevices.value[0];
    await onRecoverDeviceChange();
  }
}

async function onRecoverDeviceChange() {
  recoverApps.value = [];
  recoverForm.appName = '';
  if (!recoverForm.provider || !recoverForm.device) return;
  const skf = await getSkfClient();
  recoverApps.value = await skf.enumApplication(recoverForm.provider, recoverForm.device);
  if (recoverApps.value.length > 0) {
    recoverForm.appName = recoverApps.value[0];
  }
}

async function submitRecover() {
  if (!recoveringCert.value || !(await recoverFormRef.value?.validate().catch(() => false))) return;
  recoverLoading.value = true;
  try {
    if (recoverForm.issueType === 'file') {
      const res = unwrapData<any>(
        await recoverRaKey(recoveringCert.value.id, {
          issueType: 'file',
          filePassword: recoverForm.filePassword,
          fileFormat: 'PKCS12'
        })
      );
      if (!res?.fileBase64) {
        throw new Error('CA未返回PKCS#12文件');
      }
      const bytes = Uint8Array.from(atob(res.fileBase64), (char) => char.charCodeAt(0));
      saveBlob(new Blob([bytes], { type: 'application/x-pkcs12' }), res.fileName || `${recoveringCert.value.serialNumber}.p12`);
      ElMessage.success('RSA密钥已恢复并开始下载PKCS#12');
    } else {
      const skf = await getSkfClient();
      const appPath = `${recoverForm.provider}/${recoverForm.device}/${recoverForm.appName}`;
      await skf.checkPIN(appPath, recoverForm.pin);
      const wrapP10Res = await skf.createPKCS10(
        recoverForm.provider,
        recoverForm.device,
        recoverForm.appName,
        recoveringCert.value.subject,
        'RSA',
        2048,
        recoverForm.containerName
      );
      const wrappingCsrBase64 = pemToBase64(wrapP10Res?.pem || wrapP10Res?.csr || wrapP10Res);
      const res = unwrapData<any>(
        await recoverRaKey(recoveringCert.value.id, {
          issueType: 'usb_key',
          wrappingCsrBase64
        })
      );
      if (!res?.encryptionPrivateKey || !res?.wrapKey) {
        throw new Error('CA未返回可写入 USBKey 的 RSA 加密私钥材料');
      }
      await skf.importKeyPair(
        recoverForm.provider,
        recoverForm.device,
        recoverForm.appName,
        recoverForm.containerName,
        'RSA',
        res.encryptionPrivateKey,
        res.wrapKey,
        res.symmetricMode || 'ECB'
      );
      if (res.cert) {
        await skf.importCertificate(recoverForm.provider, recoverForm.device, recoverForm.appName, recoverForm.containerName, false, res.cert);
      }
      ElMessage.success('RSA密钥已恢复并写入 USB Key');
    }
    recoverOpen.value = false;
  } catch (error: any) {
    ElMessage.error('RSA密钥恢复失败: ' + (error?.message || error?.msg || '未知错误'));
  } finally {
    recoverLoading.value = false;
  }
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
