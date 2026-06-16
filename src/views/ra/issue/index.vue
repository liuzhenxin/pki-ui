<template>
  <div class="app-container ra-cert-issue-page">
    <el-form ref="queryFormRef" v-show="showSearch" :model="queryParams" :inline="true" label-width="80px">
      <el-form-item label="业务类型" prop="businessType">
        <el-select v-model="queryParams.businessType" clearable placeholder="全部" style="width: 180px">
          <el-option v-for="item in businessTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字" prop="keyword">
        <el-input v-model="queryParams.keyword" clearable placeholder="用户/部门/序列号/主题" style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Stamp" @click="getList">刷新</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column label="业务编号" prop="businessId" width="120" align="center" />
      <el-table-column label="业务类型" prop="businessTypeName" width="120" align="center" />
      <el-table-column label="申请用户" prop="userName" min-width="140" show-overflow-tooltip />
      <el-table-column label="所属部门" prop="deptName" min-width="140" show-overflow-tooltip />
      <el-table-column label="原证书序列号" prop="serialNumber" min-width="170" show-overflow-tooltip />
      <el-table-column label="证书主题" prop="subject" min-width="220" show-overflow-tooltip />
      <el-table-column label="证书模板" prop="profileName" min-width="150" show-overflow-tooltip />
      <el-table-column label="申请原因" prop="reason" min-width="160" show-overflow-tooltip />
      <el-table-column label="审核完成时间" prop="submitTime" width="170" align="center">
        <template #default="{ row }">
          <span>{{ parseTime(row.submitTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag type="warning">{{ row.issueStatusName || '待签发' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="130" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="签发" placement="top">
            <el-button link type="primary" icon="Stamp" @click="handleIssue(row)" />
          </el-tooltip>
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog v-model="issueOpen" title="证书签发" width="1180px" append-to-body top="3vh" class="cert-issue-dialog" @close="closeIssueDialog">
      <el-alert v-if="issueStep" class="issue-step-alert" :title="issueStep" type="info" show-icon :closable="false" />
      <el-form ref="issueFormRef" :model="issueForm" :rules="rules" label-width="108px" class="issue-form">
        <div class="issue-section-grid">
          <div class="form-section user-section">
            <div class="section-title">用户信息</div>
            <el-descriptions :column="2" border size="small" class="issue-descriptions">
              <el-descriptions-item label="申请用户">{{ current.userName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="所属部门">{{ current.deptName || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="form-section apply-section">
            <div class="section-title">
              <span>申请信息</span>
              <el-tag type="warning" effect="plain">{{ current.issueStatusName || '待签发' }}</el-tag>
            </div>
            <el-descriptions :column="2" border size="small" class="issue-descriptions">
              <el-descriptions-item label="业务类型">{{ current.businessTypeName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="业务编号">{{ current.businessId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="原证书序列号">{{ current.serialNumber || '-' }}</el-descriptions-item>
              <el-descriptions-item label="申请原因">{{ current.reason || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="form-section issue-info-section">
            <div class="section-title">签发信息</div>
            <div class="issue-info-grid">
              <el-form-item class="issue-type-item" label="CSR来源" prop="issueType">
                <el-segmented v-model="issueForm.issueType" :options="issueTypeOptions" @change="handleIssueTypeChange" />
              </el-form-item>
              <el-form-item label="根证书">
                <el-input :model-value="current.rootName || current.rootId || '-'" disabled />
              </el-form-item>
              <el-form-item label="证书模板">
                <el-input :model-value="current.profileName || '-'" disabled />
              </el-form-item>
            </div>
            <el-alert
              v-if="dualCertInfo?.certMode === 'dual' && isDualRootSm2"
              type="success"
              :closable="false"
              show-icon
              style="margin-bottom: 12px"
            >
              <template #title>
                双证书签发：签名模板「{{ dualCertInfo.signProfileName }}」+ 加密模板「{{ dualCertInfo.encryptProfileName }}」 — 签名证书由 USB Key
                生成，加密证书由 KMC 生成
              </template>
            </el-alert>
            <el-alert v-if="dualCertInfo?.certMode === 'dual' && !isDualRootSm2" type="error" :closable="false" show-icon style="margin-bottom: 12px">
              <template #title> 双证书签发异常：当前根证书不是 SM2 算法，无法签发双证书。请联系管理员更换为 SM2 根证书。 </template>
            </el-alert>
            <el-form-item v-if="issueForm.issueType === 'csr'" label="CSR" prop="csr" class="csr-form-item">
              <el-input v-model="issueForm.csr" type="textarea" :rows="8" placeholder="请输入证书请求CSR" />
            </el-form-item>
            <template v-if="issueForm.issueType === 'usb_key'">
              <el-alert class="usb-key-tip" type="info" show-icon :closable="false" title="请确认 USB Key 已插入，应用已创建，User PIN 正确。" />
              <div class="issue-info-grid">
                <el-form-item label="设备提供商" prop="provider">
                  <div class="issue-device-row">
                    <el-select v-model="issueForm.provider" placeholder="请选择或刷新" style="flex: 1" @change="onCertProviderChange">
                      <el-option v-for="item in certProviders" :key="item" :label="item" :value="item" />
                    </el-select>
                    <el-button icon="Refresh" circle @click="refreshCertProviders" />
                  </div>
                </el-form-item>
                <el-form-item label="设备列表" prop="device">
                  <el-select v-model="issueForm.device" placeholder="请选择设备" @change="onCertDeviceChange">
                    <el-option v-for="item in certDevices" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
                <el-form-item label="应用" prop="appName">
                  <el-select v-model="issueForm.appName" placeholder="请选择应用">
                    <el-option v-for="item in certApps" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
                <el-form-item label="容器名" prop="containerName">
                  <el-input v-model="issueForm.containerName" placeholder="请输入或使用自动生成的容器名" />
                </el-form-item>
                <el-form-item label="User PIN" prop="pin">
                  <el-input v-model="issueForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
                </el-form-item>
              </div>
            </template>
            <template v-if="issueForm.issueType === 'file'">
              <div class="issue-info-grid compact">
                <el-form-item label="文件格式" prop="fileFormat">
                  <el-radio-group v-model="issueForm.fileFormat">
                    <el-radio-button value="PKCS12">PKCS12</el-radio-button>
                    <el-radio-button value="JKS">JKS</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="文件密码" prop="filePassword">
                  <el-input v-model="issueForm.filePassword" type="password" show-password placeholder="请输入 P12/JKS 文件密码" />
                </el-form-item>
              </div>
            </template>
          </div>

          <div class="form-section subject-section">
            <div class="section-title">证书主题</div>
            <template v-if="issueForm.issueType !== 'csr'">
              <div v-if="issueForm.subjectItems.length > 0" class="subject-scroll-area">
                <CertSubject v-model="issueForm.subjectItems" propPrefix="subjectItems" />
              </div>
              <el-form-item v-else label="证书主题" prop="subject">
                <el-input v-model="issueForm.subject" clearable placeholder="请输入证书主题，例如：CN=user,O=org,C=CN" />
              </el-form-item>
            </template>
            <el-descriptions v-else :column="1" border size="small" class="issue-descriptions">
              <el-descriptions-item label="证书主题">{{ current.subject || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="form-section extension-section">
            <div class="section-title">扩展信息</div>
            <div v-if="issueForm.extensionItems.length > 0" class="extension-scroll-area">
              <div v-for="(ext, extIndex) in issueForm.extensionItems" :key="ext.key" class="issue-extension-item">
                <div class="issue-extension-title">
                  <span>{{ ext.label }}</span>
                  <el-tag v-if="ext.required" type="danger" size="small" effect="plain">必填</el-tag>
                  <el-tag v-else type="info" size="small" effect="plain">可选</el-tag>
                </div>
                <template v-if="ext.kind === 'subjectAlternativeName'">
                  <div v-for="(name, nameIndex) in ext.names" :key="`${ext.key}-${nameIndex}`" class="san-row">
                    <el-select v-model="name.type" placeholder="类型" style="width: 130px">
                      <el-option v-for="mode in ext.modes" :key="mode" :label="getSanModeLabel(mode)" :value="mode" />
                    </el-select>
                    <el-input v-model="name.value" :placeholder="getSanPlaceholder(name.type)" />
                    <el-button icon="Delete" circle :disabled="ext.names.length <= 1" @click="removeSanName(extIndex, nameIndex)" />
                  </div>
                  <el-button type="primary" link icon="Plus" @click="addSanName(extIndex)">添加备用名称</el-button>
                </template>
                <template v-else-if="ext.kind === 'keyUsage'">
                  <el-checkbox-group v-model="ext.usages" class="key-usage-checkbox-group">
                    <el-checkbox v-for="usage in keyUsageOptions" :key="usage.value" :value="usage.value">
                      {{ usage.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </template>
                <template v-else-if="ext.kind === 'extendedKeyUsage'">
                  <el-checkbox-group v-model="ext.usages" class="key-usage-checkbox-group">
                    <el-checkbox v-for="usage in extendedKeyUsageOptions" :key="usage.value" :value="usage.value">
                      {{ usage.label }}
                    </el-checkbox>
                  </el-checkbox-group>
                </template>
                <template v-else>
                  <el-input v-model="ext.value" type="textarea" :rows="3" :placeholder="`请输入 ${ext.label} 的 JSON 或文本值`" />
                </template>
              </div>
            </div>
            <el-empty v-else description="无扩展信息" :image-size="64" />
          </div>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitLoading" @click="submitIssue">签 发</el-button>
          <el-button @click="issueOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="issueResultOpen" title="证书签发结果" width="920px" append-to-body>
      <el-descriptions :column="2" border class="result-section">
        <el-descriptions-item label="证书ID">{{ issueResult.certId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ issueResult.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题" :span="2">{{ issueResult.subject || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="result-actions">
        <el-button icon="CopyDocument" @click="copyCert(issueResult.cert)">复制证书</el-button>
        <el-button type="primary" icon="Download" @click="downloadCert(issueResult)">下载证书</el-button>
        <el-button v-if="issueResult.fileBase64" type="success" icon="Download" @click="downloadKeyStore(issueResult)"
          >下载{{ issueResult.fileFormat }}</el-button
        >
      </div>
      <el-input v-model="issueResult.cert" type="textarea" :rows="10" readonly class="cert-result-textarea" />
      <div v-if="issueResult.encCert" style="margin-top: 16px">
        <el-divider content-position="left">加密证书</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="加密证书ID">{{ issueResult.encCertId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="加密序列号">{{ issueResult.encSerialNumber || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin: 8px 0">
          <el-button icon="CopyDocument" @click="copyCert(issueResult.encCert)">复制加密证书</el-button>
          <el-button type="primary" icon="Download" @click="downloadCertPem(issueResult.encCert, issueResult.encSerialNumber || 'enc-cert')"
            >下载加密证书</el-button
          >
        </div>
        <el-input v-model="issueResult.encCert" type="textarea" :rows="8" readonly class="cert-result-textarea" />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="issueResultOpen = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailOpen" title="待签发详情" width="720px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="业务类型">{{ detail.businessTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务编号">{{ detail.businessId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请用户">{{ detail.userName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属部门">{{ detail.deptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="原证书序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ detail.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="根证书">{{ detail.rootName || detail.rootId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书模板">{{ detail.profileName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请原因">{{ detail.reason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="CSR">
          <pre class="csr-preview">{{ detail.csr || '-' }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup name="RaCertIssue" lang="ts">
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { getRaCertIssue, issueRaCert, pageRaCertIssue, RaCertIssue, RaCertIssueResult, DualCertIssueInfo } from '@/api/ra/certIssue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { parseJson } from '@/utils/json';
import SKFClient from '@/api/skf/skf_api';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const businessTypeOptions = [
  { label: '证书申请', value: 'cert_apply' },
  { label: '证书补办', value: 'cert_reissue' },
  { label: '证书续签', value: 'cert_renewal' },
  { label: '证书更新', value: 'cert_update' }
];

const rows = ref<RaCertIssue[]>([]);
const loading = ref(false);
const submitLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const issueOpen = ref(false);
const detailOpen = ref(false);
const issueResultOpen = ref(false);
const issueStep = ref('');
const current = ref<Partial<RaCertIssue>>({});
const detail = ref<Partial<RaCertIssue>>({});
const issueResult = ref<Partial<RaCertIssueResult>>({});
const dualCertInfo = ref<DualCertIssueInfo | null>(null);
const isDualRootSm2 = computed(() => {
  const rootName = (current.value.rootName || '').toUpperCase();
  return rootName.includes('SM2');
});
const queryFormRef = ref<FormInstance>();
const issueFormRef = ref<FormInstance>();
const certProviders = ref<string[]>([]);
const certDevices = ref<string[]>([]);
const certApps = ref<string[]>([]);
let skfClientPromise: Promise<any> | null = null;

const issueTypeOptions = [
  { label: 'CSR', value: 'csr' },
  { label: 'USB Key', value: 'usb_key' },
  { label: '签发到文件', value: 'file' }
];

const keyUsageOptions = [
  { value: 'digitalSignature', label: '数字签名' },
  { value: 'nonRepudiation', label: '不可否认性' },
  { value: 'contentCommitment', label: '内容承诺' },
  { value: 'keyEncipherment', label: '密钥加密' },
  { value: 'dataEncipherment', label: '数据加密' },
  { value: 'keyAgreement', label: '密钥协商' },
  { value: 'keyCertSign', label: '证书签名' },
  { value: 'cRLSign', label: 'CRL签名' },
  { value: 'encipherOnly', label: '仅加密' },
  { value: 'decipherOnly', label: '仅解密' }
];

const extendedKeyUsageOptions = [
  { value: 'serverAuth', label: '服务器身份验证' },
  { value: 'clientAuth', label: '客户端身份验证' },
  { value: 'codeSigning', label: '代码签名' },
  { value: 'emailProtection', label: '电子邮件保护' },
  { value: 'timeStamping', label: '时间戳' },
  { value: 'OCSPSigning', label: 'OCSP签名' },
  { value: 'ipsecEndSystem', label: 'IPSec终端系统' },
  { value: 'ipsecTunnel', label: 'IPSec隧道' },
  { value: 'ipsecUser', label: 'IPSec用户' },
  { value: 'anyExtendedKeyUsage', label: '任意增强密钥用法' }
];

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  businessType: '',
  keyword: ''
});

const issueForm = reactive({
  issueType: 'csr' as 'csr' | 'usb_key' | 'file',
  csr: '',
  subject: '',
  subjectItems: [] as any[],
  extensionItems: [] as any[],
  provider: '',
  device: '',
  appName: '',
  containerName: '',
  pin: '',
  fileFormat: 'PKCS12' as 'PKCS12' | 'JKS',
  filePassword: ''
});

const rules: FormRules = {
  issueType: [{ required: true, message: '请选择CSR来源', trigger: 'change' }],
  csr: [
    {
      validator: (_rule, value, callback) => {
        if (issueForm.issueType === 'csr' && !String(value || '').trim()) {
          callback(new Error('CSR不能为空'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  subject: [
    {
      validator: (_rule, value, callback) => {
        if (issueForm.issueType !== 'csr' && issueForm.subjectItems.length === 0 && !String(value || '').trim()) {
          callback(new Error('证书主题不能为空'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  provider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入User PIN', trigger: 'blur' }],
  fileFormat: [{ required: true, message: '请选择文件格式', trigger: 'change' }],
  filePassword: [{ required: true, message: '请输入文件密码', trigger: 'blur' }]
};

function parsePage(res: any) {
  const page = res.data || res;
  return {
    rows: page.rows || page.records || [],
    total: page.total || 0
  };
}

async function getList() {
  loading.value = true;
  try {
    const res = await pageRaCertIssue({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      businessType: queryParams.businessType || undefined,
      keyword: queryParams.keyword || undefined
    });
    const page = parsePage(res);
    rows.value = page.rows;
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
  queryParams.businessType = '';
  queryParams.keyword = '';
  handleQuery();
}

async function handleIssue(row: RaCertIssue) {
  const res = await getRaCertIssue(row.businessType, row.businessId);
  current.value = res.data || row;
  // 解析conf中的双证书信息
  dualCertInfo.value = null;
  if (current.value.conf) {
    try {
      const confData = typeof current.value.conf === 'string' ? JSON.parse(current.value.conf) : current.value.conf;
      if (confData?.certMode === 'dual') {
        dualCertInfo.value = {
          certMode: 'dual',
          signProfileId: confData.signProfileId || current.value.profileId,
          signProfileName: confData.signProfileName || current.value.profileName,
          encryptProfileId: confData.encryptProfileId,
          encryptProfileName: confData.encryptProfileName
        };
      }
    } catch (e) {
      /* ignore parse error */
    }
  }
  resetIssueForm();
  issueForm.csr = current.value.csr || '';
  issueForm.subject = current.value.subject || '';
  issueForm.subjectItems = buildSubjectItems(current.value.profileConf, current.value.subject);
  issueForm.extensionItems = buildIssueExtensionItems(parseJson(current.value.profileConf || '{}')?.extensions || []);
  issueStep.value = '';
  issueOpen.value = true;
}

async function handleDetail(row: RaCertIssue) {
  const res = await getRaCertIssue(row.businessType, row.businessId);
  detail.value = res.data || row;
  detailOpen.value = true;
}

function submitIssue() {
  issueFormRef.value?.validate(async (valid) => {
    if (!valid || !current.value.businessType || current.value.businessId === undefined) {
      return;
    }
    if (!validateIssueExtensions()) {
      return;
    }
    submitLoading.value = true;
    issueStep.value = '正在调用 CA 执行证书签发...';
    try {
      const subject = resolveIssueSubject();
      let csr = issueForm.csr;
      if (issueForm.issueType === 'usb_key') {
        issueStep.value = '正在连接 SKF 服务并验证 USB Key PIN...';
        const skf = await getSkfClient();
        const appPath = `${issueForm.provider}/${issueForm.device}/${issueForm.appName}`;
        await withTimeout(skf.checkPIN(appPath, issueForm.pin), 15000, '验证 PIN 超时');
        issueStep.value = '正在 USB Key 中生成密钥并创建 CSR...';
        const p10Res = await withTimeout(
          skf.createPKCS10(
            issueForm.provider,
            issueForm.device,
            issueForm.appName,
            subject,
            resolveKeyAlgorithm(),
            resolveKeySize(),
            issueForm.containerName
          ),
          30000,
          '生成 CSR 超时'
        );
        csr = p10Res?.pem || p10Res?.csr || p10Res;
      }
      const res = await issueRaCert(current.value.businessType, current.value.businessId, {
        issueType: issueForm.issueType,
        csr: csr || undefined,
        subject: subject || undefined,
        extensions: buildIssueExtensionsPayload(),
        fileFormat: issueForm.issueType === 'file' ? issueForm.fileFormat : undefined,
        filePassword: issueForm.issueType === 'file' ? issueForm.filePassword : undefined
      });
      if (issueForm.issueType === 'usb_key' && res.data?.cert) {
        issueStep.value = '正在写入证书到 USB Key...';
        const skf = await getSkfClient();
        await withTimeout(
          skf.importCertificate(issueForm.provider, issueForm.device, issueForm.appName, issueForm.containerName, true, res.data.cert),
          30000,
          '写入 USB Key 证书超时'
        );
      }
      issueStep.value = '证书签发成功，正在刷新待签发列表...';
      issueResult.value = res.data || {};
      proxy?.$modal.msgSuccess(`签发成功，证书序列号：${res.data?.serialNumber || '-'}`);
      issueOpen.value = false;
      issueResultOpen.value = true;
      await getList();
    } finally {
      submitLoading.value = false;
      issueStep.value = '';
    }
  });
}

function closeIssueDialog() {
  issueStep.value = '';
  issueFormRef.value?.clearValidate();
}

function resetIssueForm() {
  issueForm.issueType = 'csr';
  issueForm.csr = '';
  issueForm.subject = '';
  issueForm.subjectItems = [];
  issueForm.extensionItems = [];
  issueForm.provider = '';
  issueForm.device = '';
  issueForm.appName = '';
  issueForm.containerName = `cert-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  issueForm.pin = '';
  issueForm.fileFormat = 'PKCS12';
  issueForm.filePassword = '';
  certProviders.value = [];
  certDevices.value = [];
  certApps.value = [];
  issueFormRef.value?.clearValidate();
}

async function handleIssueTypeChange(value: string | number | boolean) {
  issueForm.issueType = value as any;
  issueFormRef.value?.clearValidate();
  if (issueForm.issueType === 'usb_key') {
    await refreshCertProviders();
  }
}

function buildSubjectItems(profileConf?: string, subject?: string) {
  const conf = parseJson(profileConf || '{}');
  const rdns = conf?.subject?.rdns || (Array.isArray(conf?.subject) ? conf.subject : []);
  if (!Array.isArray(rdns) || rdns.length === 0) {
    return [];
  }
  const subjectMap = parseSubject(subject);
  const items: any[] = [];
  rdns.forEach((rdn: any) => {
    const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
    let compType = String(rdnType).toLowerCase();
    for (const [type, meta] of Object.entries(typeMapping)) {
      if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType || meta.label.toLowerCase().includes(compType)) {
        compType = type;
        break;
      }
    }
    const count = Math.max(1, rdn.minOccurs === undefined ? 1 : Number(rdn.minOccurs));
    for (let i = 0; i < count; i++) {
      const key = typeMapping[compType]?.key || compType;
      items.push({ type: compType, value: subjectMap[key] || '', minOccurs: rdn.minOccurs, maxOccurs: rdn.maxOccurs, regex: rdn.regex });
    }
  });
  return sortSubjectItems(items);
}

function parseSubject(subject?: string) {
  const map: Record<string, string> = {};
  String(subject || '')
    .split(',')
    .map((item) => item.trim())
    .forEach((item) => {
      const index = item.indexOf('=');
      if (index > 0) {
        map[item.slice(0, index).trim()] = item.slice(index + 1).trim();
      }
    });
  return map;
}

function resolveIssueSubject() {
  if (issueForm.issueType === 'csr') {
    return issueForm.subject || undefined;
  }
  if (issueForm.subjectItems.length === 0) {
    return issueForm.subject;
  }
  return issueForm.subjectItems
    .filter((item: any) => item.value)
    .map((item: any) => `${typeMapping[item.type]?.key || item.type}=${item.value}`)
    .join(',');
}

function getExtensionTypeMeta(ext: any) {
  const type = ext?.type;
  if (typeof type === 'object') {
    return {
      oid: type.oid || '',
      description: type.description || type.name || type.oid || ''
    };
  }
  return {
    oid: '',
    description: String(type || '')
  };
}

function normalizeExtensionKey(description: string) {
  return (description || '').replace(/[-_\s]/g, '').toLowerCase();
}

function getExtensionLabel(ext: any) {
  const meta = getExtensionTypeMeta(ext);
  const key = normalizeExtensionKey(meta.description);
  const labels: Record<string, string> = {
    subjectalternativename: '主体备用名称',
    keyusage: '密钥用法',
    extendedkeyusage: '增强密钥用法',
    basicconstraints: '基本约束',
    certificatepolicies: '证书策略',
    subjectinfoaccess: '主体信息访问'
  };
  return labels[key] || meta.description || meta.oid || '扩展信息';
}

function buildIssueExtensionItems(extensions: any[]) {
  return (extensions || [])
    .filter((ext: any) => ext?.inRequest === 'required' || ext?.inRequest === 'optional' || (ext?.required && ext?.subjectAltName))
    .map((ext: any, index: number) => {
      const meta = getExtensionTypeMeta(ext);
      const key = normalizeExtensionKey(meta.description);
      const modes = ext?.subjectAltName?.modes?.length ? ext.subjectAltName.modes : ['DNSName'];
      if (key === 'subjectalternativename') {
        return {
          key: `${meta.oid || meta.description || 'san'}-${index}`,
          kind: 'subjectAlternativeName',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          modes,
          names: [{ type: modes[0], value: '' }]
        };
      }
      if (key === 'keyusage') {
        return {
          key: `${meta.oid || meta.description || 'keyUsage'}-${index}`,
          kind: 'keyUsage',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          usages: normalizeKeyUsageValues(ext?.keyUsage?.usages || ext?.usages || [])
        };
      }
      if (key === 'extendedkeyusage') {
        return {
          key: `${meta.oid || meta.description || 'extendedKeyUsage'}-${index}`,
          kind: 'extendedKeyUsage',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          usages: normalizeExtendedKeyUsageValues(ext?.extendedKeyUsage?.usages || ext?.usages || [])
        };
      }
      return {
        key: `${meta.oid || meta.description || 'ext'}-${index}`,
        kind: 'generic',
        label: getExtensionLabel(ext),
        oid: meta.oid,
        description: meta.description,
        critical: !!ext.critical,
        required: ext.inRequest === 'required' || !!ext.required,
        value: ''
      };
    });
}

function normalizeKeyUsageValues(usages: any[]) {
  if (!Array.isArray(usages)) return [];
  const validValues = new Set(keyUsageOptions.map((item) => item.value));
  return usages
    .map((usage: any) => (typeof usage === 'object' ? usage.value || usage.oid || usage.description : usage))
    .map((usage: any) => String(usage || '').trim())
    .filter((usage: string) => validValues.has(usage));
}

function normalizeExtendedKeyUsageValues(usages: any[]) {
  if (!Array.isArray(usages)) return [];
  const validValues = new Set(extendedKeyUsageOptions.map((item) => item.value));
  return usages
    .map((usage: any) => (typeof usage === 'object' ? usage.value || usage.oid || usage.description : usage))
    .map((usage: any) => String(usage || '').trim())
    .filter((usage: string) => validValues.has(usage));
}

function getSanModeLabel(mode: string) {
  const labels: Record<string, string> = {
    DNSName: 'DNS名称',
    dNSName: 'DNS名称',
    IPAddress: 'IP地址',
    iPAddress: 'IP地址',
    rfc822Name: '邮箱',
    RFC822Name: '邮箱',
    uniformResourceIdentifier: 'URI',
    directoryName: '目录名',
    registeredID: '注册ID'
  };
  return labels[mode] || mode;
}

function getSanPlaceholder(mode: string) {
  if (mode === 'IPAddress' || mode === 'iPAddress') return '例如：192.168.1.10';
  if (mode === 'rfc822Name' || mode === 'RFC822Name') return '例如：user@example.com';
  if (mode === 'uniformResourceIdentifier') return '例如：https://example.com';
  return '例如：www.example.com';
}

function addSanName(extIndex: number) {
  const ext = issueForm.extensionItems[extIndex];
  if (!ext) return;
  ext.names.push({ type: ext.modes?.[0] || 'DNSName', value: '' });
}

function removeSanName(extIndex: number, nameIndex: number) {
  const ext = issueForm.extensionItems[extIndex];
  if (!ext || ext.names.length <= 1) return;
  ext.names.splice(nameIndex, 1);
}

function buildIssueExtensionsPayload() {
  const extensions = (issueForm.extensionItems || [])
    .map((ext: any) => {
      if (ext.kind === 'subjectAlternativeName') {
        const names = (ext.names || [])
          .filter((name: any) => name.value && String(name.value).trim())
          .map((name: any) => ({ type: name.type, value: String(name.value).trim() }));
        if (!names.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          subjectAltName: { names }
        };
      }
      if (ext.kind === 'keyUsage') {
        const usages = normalizeKeyUsageValues(ext.usages || []);
        if (!usages.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          keyUsage: { usages }
        };
      }
      if (ext.kind === 'extendedKeyUsage') {
        const usages = normalizeExtendedKeyUsageValues(ext.usages || []);
        if (!usages.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          extendedKeyUsage: { usages }
        };
      }
      if (!ext.value || !String(ext.value).trim()) return null;
      let value: any = String(ext.value).trim();
      try {
        value = JSON.parse(value);
      } catch (e) {}
      return {
        type: { oid: ext.oid, description: ext.description },
        critical: ext.critical,
        value
      };
    })
    .filter(Boolean);
  return extensions.length ? JSON.stringify(extensions) : undefined;
}

function validateIssueExtensions() {
  for (const ext of issueForm.extensionItems || []) {
    if (!ext.required) continue;
    if (ext.kind === 'subjectAlternativeName') {
      const hasValue = (ext.names || []).some((name: any) => name.value && String(name.value).trim());
      if (!hasValue) {
        ElMessage.warning(`请输入${ext.label}`);
        return false;
      }
    } else if (ext.kind === 'keyUsage') {
      if (!normalizeKeyUsageValues(ext.usages || []).length) {
        ElMessage.warning(`请选择${ext.label}`);
        return false;
      }
    } else if (ext.kind === 'extendedKeyUsage') {
      if (!normalizeExtendedKeyUsageValues(ext.usages || []).length) {
        ElMessage.warning(`请选择${ext.label}`);
        return false;
      }
    } else if (!ext.value || !String(ext.value).trim()) {
      ElMessage.warning(`请输入${ext.label}`);
      return false;
    }
  }
  return true;
}

function resolveKeyAlgorithm() {
  const text = `${current.value.rootName || ''} ${current.value.profileName || ''}`.toUpperCase();
  return text.includes('RSA') ? 'RSA' : 'SM2';
}

function resolveKeySize() {
  const text = `${current.value.rootName || ''} ${current.value.profileName || ''}`.toUpperCase();
  const match = text.match(/RSA[-_ ]?(\d{4})/);
  return resolveKeyAlgorithm() === 'RSA' ? Number(match?.[1] || 2048) : 256;
}

const getSkfClient = async () => {
  if (skfClientPromise) {
    return skfClientPromise;
  }
  const skf = new SKFClient('ws://127.0.0.1:9001');
  skfClientPromise = skf.connect().then(async () => {
    try {
      await skf.setLanguage('CN');
    } catch (e) {}
    return skf;
  });
  return skfClientPromise;
};

async function refreshCertProviders() {
  certProviders.value = [];
  try {
    issueStep.value = '正在连接 SKF 服务并读取 USB Key 设备...';
    skfClientPromise = null;
    const skf = await getSkfClient();
    certProviders.value = await withTimeout(skf.enumProvider(), 10000, '获取设备提供商超时');
    if (certProviders.value.length > 0) {
      issueForm.provider = certProviders.value[0];
      await onCertProviderChange();
    }
  } catch (e: any) {
    ElMessage.error(`无法连接 SKF 服务: ${e?.message || e || '未知错误'}`);
  } finally {
    issueStep.value = '';
  }
}

async function onCertProviderChange() {
  certDevices.value = [];
  certApps.value = [];
  if (!issueForm.provider) return;
  const skf = await getSkfClient();
  certDevices.value = await withTimeout(skf.enumDevice(issueForm.provider), 10000, '获取设备列表超时');
  issueForm.device = certDevices.value[0] || '';
  if (issueForm.device) {
    await onCertDeviceChange();
  }
}

async function onCertDeviceChange() {
  certApps.value = [];
  if (!issueForm.provider || !issueForm.device) return;
  const skf = await getSkfClient();
  certApps.value = await withTimeout(skf.enumApplication(issueForm.provider, issueForm.device), 10000, '获取应用列表超时');
  issueForm.appName = certApps.value[0] || '';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

async function copyCert(cert?: string) {
  if (!cert) {
    return;
  }
  await navigator.clipboard.writeText(cert);
  proxy?.$modal.msgSuccess('证书已复制');
}

function downloadCert(result: Partial<RaCertIssueResult>) {
  if (!result.cert) {
    return;
  }
  downloadCertPem(result.cert, result.serialNumber || 'ra-cert');
}

function downloadCertPem(certPem?: string, fileName?: string) {
  if (!certPem) return;
  const blob = new Blob([certPem], { type: 'application/x-pem-file;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName || 'cert'}.pem`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadKeyStore(result: Partial<RaCertIssueResult>) {
  if (!result.fileBase64) {
    return;
  }
  const binary = atob(result.fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName || `${result.serialNumber || 'ra-cert'}.${result.fileFormat === 'JKS' ? 'jks' : 'p12'}`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.ra-cert-issue-page {
  .mb16 {
    margin-bottom: 16px;
  }

  .csr-preview {
    max-height: 220px;
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .issue-step-alert {
    margin-bottom: 12px;
  }

  :global(.cert-issue-dialog) {
    max-width: calc(100vw - 32px);
  }

  :global(.cert-issue-dialog .el-dialog__body) {
    max-height: calc(100vh - 154px);
    overflow: hidden;
    padding: 16px 18px 0;
  }

  :global(.cert-issue-dialog .el-dialog__footer) {
    padding: 12px 18px 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .issue-form {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 190px);
    overflow: hidden;

    :deep(.el-select),
    :deep(.el-date-editor.el-input) {
      width: 100%;
    }

    :deep(.el-form-item) {
      margin-bottom: 14px;
    }
  }

  .issue-section-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    min-height: 0;
    overflow: auto;
    padding-right: 2px;
  }

  .issue-info-section,
  .subject-section,
  .extension-section {
    grid-column: 1 / -1;
  }

  .issue-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;

    &.compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .csr-form-item {
    margin-top: 2px;
  }

  .issue-descriptions {
    :deep(.el-descriptions__label) {
      width: 112px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
    }

    :deep(.el-descriptions__content) {
      color: var(--el-text-color-primary);
      word-break: break-word;
    }
  }

  .issue-top-grid {
    display: grid;
    grid-template-columns: minmax(300px, 0.9fr) minmax(280px, 1fr) minmax(260px, 1fr);
    gap: 12px 16px;
    align-items: start;
    flex: 0 0 auto;
    padding: 12px 14px 2px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
  }

  .issue-type-item {
    :deep(.el-segmented) {
      --el-segmented-item-selected-bg-color: var(--el-color-primary);
      --el-segmented-item-selected-color: var(--el-color-white);
      width: 100%;
    }
  }

  .issue-content-grid {
    display: grid;
    grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1fr);
    gap: 14px;
    min-height: 0;
    margin-top: 14px;
    overflow: hidden;
  }

  .issue-summary-pane,
  .issue-params-pane {
    min-width: 0;
    min-height: 0;
  }

  .issue-params-pane {
    overflow: auto;
    padding-right: 2px;
  }

  .form-section {
    margin-bottom: 0;
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
  }

  .summary-section {
    height: 100%;

    :deep(.el-descriptions__label) {
      width: 112px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
    }

    :deep(.el-descriptions__content) {
      color: var(--el-text-color-primary);
      word-break: break-word;
    }
  }

  .params-section {
    min-height: 100%;
  }

  .subject-scroll-area {
    max-height: 280px;
    overflow: auto;
    padding: 2px 8px 0 0;
  }

  .issue-extension-section {
    margin-top: 14px;
  }

  .section-subtitle {
    display: flex;
    align-items: center;
    min-height: 22px;
    margin: 2px 0 10px;
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;

    &::before {
      display: inline-block;
      width: 3px;
      height: 14px;
      margin-right: 7px;
      border-radius: 2px;
      background: var(--el-color-primary);
      content: '';
    }
  }

  .extension-scroll-area {
    max-height: 320px;
    overflow: auto;
    padding-right: 6px;
  }

  .issue-extension-item {
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-extra-light);

    & + .issue-extension-item {
      margin-top: 10px;
    }
  }

  .issue-extension-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
  }

  .san-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .key-usage-checkbox-group {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px 12px;

    :deep(.el-checkbox) {
      margin-right: 0;
      height: 24px;
    }
  }

  .usb-key-tip {
    margin-bottom: 12px;
  }

  .media-subtitle {
    margin-top: 14px;
  }

  .issue-device-row {
    display: flex;
    width: 100%;
    gap: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 24px;
    margin-bottom: 12px;
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .result-section {
    margin-bottom: 12px;
  }

  .result-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-bottom: 12px;
  }

  .cert-result-textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  }

  @media (max-width: 1200px) {
    .issue-section-grid,
    .issue-info-grid,
    .issue-info-grid.compact {
      grid-template-columns: 1fr;
    }

    .issue-top-grid {
      grid-template-columns: 1fr;
    }

    .issue-content-grid {
      grid-template-columns: 1fr;
      overflow: auto;
    }

    .issue-form {
      overflow: auto;
    }

    .issue-params-pane {
      overflow: visible;
    }
  }

  @media (max-width: 760px) {
    :global(.cert-issue-dialog .el-dialog__body) {
      max-height: calc(100vh - 132px);
      overflow: auto;
    }

    .key-usage-checkbox-group {
      grid-template-columns: 1fr;
    }

    .san-row {
      flex-wrap: wrap;

      :deep(.el-select) {
        width: 100% !important;
      }
    }
  }
}

:global(.cert-issue-dialog) {
  max-width: calc(100vw - 32px);
}

:global(.cert-issue-dialog .el-dialog__body) {
  max-height: calc(100vh - 154px);
  overflow: hidden;
  padding: 16px 18px 0;
}

:global(.cert-issue-dialog .el-dialog__footer) {
  padding: 12px 18px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

:global(.cert-issue-dialog .issue-form) {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 190px);
  overflow: hidden;
}

:global(.cert-issue-dialog .issue-form .el-select),
:global(.cert-issue-dialog .issue-form .el-date-editor.el-input) {
  width: 100%;
}

:global(.cert-issue-dialog .issue-form .el-form-item) {
  margin-bottom: 14px;
}

:global(.cert-issue-dialog .issue-section-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

:global(.cert-issue-dialog .issue-info-section),
:global(.cert-issue-dialog .subject-section),
:global(.cert-issue-dialog .extension-section) {
  grid-column: 1 / -1;
}

:global(.cert-issue-dialog .issue-info-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
}

:global(.cert-issue-dialog .issue-info-grid.compact) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

:global(.cert-issue-dialog .csr-form-item) {
  margin-top: 2px;
}

:global(.cert-issue-dialog .issue-descriptions .el-descriptions__label) {
  width: 112px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

:global(.cert-issue-dialog .issue-descriptions .el-descriptions__content) {
  color: var(--el-text-color-primary);
  word-break: break-word;
}

:global(.cert-issue-dialog .issue-top-grid) {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(280px, 1fr) minmax(260px, 1fr);
  gap: 12px 16px;
  align-items: start;
  flex: 0 0 auto;
  padding: 12px 14px 2px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

:global(.cert-issue-dialog .issue-type-item .el-segmented) {
  --el-segmented-item-selected-bg-color: var(--el-color-primary);
  --el-segmented-item-selected-color: var(--el-color-white);
  width: 100%;
}

:global(.cert-issue-dialog .issue-content-grid) {
  display: grid;
  grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  margin-top: 14px;
  overflow: hidden;
}

:global(.cert-issue-dialog .issue-summary-pane),
:global(.cert-issue-dialog .issue-params-pane) {
  min-width: 0;
  min-height: 0;
}

:global(.cert-issue-dialog .issue-params-pane) {
  overflow: auto;
  padding-right: 2px;
}

:global(.cert-issue-dialog .form-section) {
  margin-bottom: 0;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

:global(.cert-issue-dialog .summary-section) {
  height: 100%;
}

:global(.cert-issue-dialog .summary-section .el-descriptions__label) {
  width: 112px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

:global(.cert-issue-dialog .summary-section .el-descriptions__content) {
  color: var(--el-text-color-primary);
  word-break: break-word;
}

:global(.cert-issue-dialog .params-section) {
  min-height: 100%;
}

:global(.cert-issue-dialog .subject-scroll-area) {
  max-height: 280px;
  overflow: auto;
  padding: 2px 8px 0 0;
}

:global(.cert-issue-dialog .issue-extension-section) {
  margin-top: 14px;
}

:global(.cert-issue-dialog .section-subtitle) {
  display: flex;
  align-items: center;
  min-height: 22px;
  margin: 2px 0 10px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

:global(.cert-issue-dialog .section-subtitle::before) {
  display: inline-block;
  width: 3px;
  height: 14px;
  margin-right: 7px;
  border-radius: 2px;
  background: var(--el-color-primary);
  content: '';
}

:global(.cert-issue-dialog .extension-scroll-area) {
  max-height: 320px;
  overflow: auto;
  padding-right: 6px;
}

:global(.cert-issue-dialog .issue-extension-item) {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
}

:global(.cert-issue-dialog .issue-extension-item + .issue-extension-item) {
  margin-top: 10px;
}

:global(.cert-issue-dialog .issue-extension-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

:global(.cert-issue-dialog .san-row) {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

:global(.cert-issue-dialog .key-usage-checkbox-group) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 12px;
}

:global(.cert-issue-dialog .key-usage-checkbox-group .el-checkbox) {
  margin-right: 0;
  height: 24px;
}

:global(.cert-issue-dialog .usb-key-tip) {
  margin-bottom: 12px;
}

:global(.cert-issue-dialog .media-subtitle) {
  margin-top: 14px;
}

:global(.cert-issue-dialog .issue-device-row) {
  display: flex;
  width: 100%;
  gap: 8px;
}

:global(.cert-issue-dialog .section-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
}

:global(.cert-issue-dialog .dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1200px) {
  :global(.cert-issue-dialog .issue-section-grid),
  :global(.cert-issue-dialog .issue-info-grid),
  :global(.cert-issue-dialog .issue-info-grid.compact) {
    grid-template-columns: 1fr;
  }

  :global(.cert-issue-dialog .issue-top-grid),
  :global(.cert-issue-dialog .issue-content-grid) {
    grid-template-columns: 1fr;
  }

  :global(.cert-issue-dialog .issue-content-grid),
  :global(.cert-issue-dialog .issue-form) {
    overflow: auto;
  }

  :global(.cert-issue-dialog .issue-params-pane) {
    overflow: visible;
  }
}

@media (max-width: 760px) {
  :global(.cert-issue-dialog .el-dialog__body) {
    max-height: calc(100vh - 132px);
    overflow: auto;
  }

  :global(.cert-issue-dialog .key-usage-checkbox-group) {
    grid-template-columns: 1fr;
  }

  :global(.cert-issue-dialog .san-row) {
    flex-wrap: wrap;
  }

  :global(.cert-issue-dialog .san-row .el-select) {
    width: 100% !important;
  }
}
</style>
