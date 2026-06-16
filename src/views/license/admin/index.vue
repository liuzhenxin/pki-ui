<template>
  <div class="app-container license-page">
    <el-row :gutter="12" class="summary-row">
      <el-col :xs="24" :sm="8">
        <div class="summary-item">
          <span class="summary-label">租户</span>
          <strong>2</strong>
        </div>
      </el-col>
      <el-col :xs="24" :sm="8">
        <div class="summary-item">
          <span class="summary-label">License 数</span>
          <strong>{{ total }}</strong>
        </div>
      </el-col>
      <el-col :xs="24" :sm="8">
        <div class="summary-item">
          <span class="summary-label">默认产品</span>
          <strong>ZX-TrustReader</strong>
        </div>
      </el-col>
    </el-row>

    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="88px">
      <el-form-item label="客户" prop="customerName">
        <el-input v-model="queryParams.customerName" placeholder="客户名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="产品" prop="product">
        <el-select v-model="queryParams.product" placeholder="产品名称" clearable filterable style="width: 200px">
          <el-option v-for="item in productOptions" :key="item.name" :label="item.label" :value="item.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="版本" prop="edition">
        <el-select v-model="queryParams.edition" placeholder="授权版本" clearable style="width: 180px">
          <el-option v-for="item in editionOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 160px">
          <el-option label="已签发" value="ISSUED" />
          <el-option label="已激活" value="ACTIVE" />
          <el-option label="已吊销" value="REVOKED" />
          <el-option label="已过期" value="EXPIRED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleIssue" v-hasPermi="['license:license:issue']">签发</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="CircleCheck" @click="handleVerify" v-hasPermi="['license:license:verify']">校验</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['license:license:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="licenseList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="授权编号" prop="licenseId" min-width="170" show-overflow-tooltip />
      <el-table-column label="客户" prop="customerName" min-width="150" show-overflow-tooltip />
      <el-table-column label="产品" prop="product" min-width="150">
        <template #default="scope">
          {{ productLabel(scope.row.product) }}
        </template>
      </el-table-column>
      <el-table-column label="授权版本" prop="edition" width="130" align="center">
        <template #default="scope">
          <el-tag>{{ editionLabel(scope.row.edition) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="有效期" min-width="230">
        <template #default="scope">
          <div>{{ formatDate(scope.row.notBefore) }}</div>
          <div class="muted">{{ formatDate(scope.row.notAfter) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="配额" min-width="180">
        <template #default="scope">
          用户 {{ quotaLabel(scope.row.maxUsers) }} / 设备 {{ quotaLabel(scope.row.maxDevices) }} / 节点 {{ quotaLabel(scope.row.maxServerNodes) }}
        </template>
      </el-table-column>
      <el-table-column label="审计策略" prop="auditPolicy" width="140" align="center" />
      <el-table-column label="状态" prop="status" width="110" align="center">
        <template #default="scope">
          <el-tag :type="statusType(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="180" fixed="right">
        <template #default="scope">
          <el-tooltip content="查看" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(scope.row)" />
          </el-tooltip>
          <el-tooltip content="下载" placement="top">
            <el-button link type="primary" icon="Download" @click="handleDownload(scope.row)" v-hasPermi="['license:license:download']" />
          </el-tooltip>
          <el-tooltip content="吊销" placement="top">
            <el-button link type="primary" icon="CircleClose" :disabled="scope.row.status === 'REVOKED'" @click="handleRevoke(scope.row)" v-hasPermi="['license:license:revoke']" />
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['license:license:remove']" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="dialog.title" v-model="dialog.visible" width="760px" append-to-body>
      <el-form ref="licenseFormRef" :model="form" :rules="rules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="customerName">
              <el-input v-model="form.customerName" placeholder="请输入客户名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人" prop="contact">
              <el-input v-model="form.contact" placeholder="联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电子邮件" prop="email">
              <el-input v-model="form.email" placeholder="电子邮件" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品" prop="product">
              <el-select v-model="form.product" filterable style="width: 100%" @change="handleProductChange">
                <el-option v-for="item in productOptions" :key="item.name" :label="item.label" :value="item.name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品版本" prop="productVersion">
              <el-input v-model="form.productVersion" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="授权版本" prop="edition">
              <el-select v-model="form.edition" style="width: 100%">
                <el-option v-for="item in editionOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="审计策略" prop="auditPolicy">
              <el-select v-model="form.auditPolicy" style="width: 100%">
                <el-option label="离线不审计" value="NONE" />
                <el-option label="本地审计" value="LOCAL_ONLY" />
                <el-option label="延迟上报" value="DELAYED_UPLOAD" />
                <el-option label="在线强审计" value="ONLINE_REQUIRED" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生效时间" prop="notBefore">
              <el-date-picker
                v-model="form.notBefore"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="立即生效"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="失效时间" prop="notAfter">
              <el-date-picker
                v-model="form.notAfter"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="长期有效"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="功能点" prop="features">
              <el-select v-model="form.features" multiple filterable style="width: 100%">
                <el-option v-for="item in currentFeatureOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户数" prop="maxUsers">
              <el-input-number v-model="form.maxUsers" :min="0" :precision="0" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备数" prop="maxDevices">
              <el-input-number v-model="form.maxDevices" :min="0" :precision="0" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="节点数" prop="maxServerNodes">
              <el-input-number v-model="form.maxServerNodes" :min="0" :precision="0" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="离线天数" prop="offlineDays">
              <el-input-number v-model="form.offlineDays" :min="0" :precision="0" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <div class="quota-tip">用户数、设备数、节点数、离线天数填 0 表示不限制。</div>
          </el-col>
          <el-col :span="12">
            <el-form-item label="绑定类型" prop="bindingType">
              <el-select v-model="form.bindingType" style="width: 100%">
                <el-option label="机器" value="machine" />
                <el-option label="组织" value="organization" />
                <el-option label="证书" value="certificate" />
                <el-option label="UKey" value="ukey" />
                <el-option label="服务器节点" value="serverNode" />
                <el-option label="不绑定" value="none" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="指纹摘要" prop="fingerprintHash">
              <el-input v-model="form.fingerprintHash" placeholder="BASE64URL-SHA256" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">签 发</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog title="License JSON" v-model="detail.visible" width="760px" append-to-body>
      <el-input v-model="detail.json" type="textarea" :rows="18" readonly />
    </el-dialog>

    <el-dialog title="校验 License" v-model="verifyDialog.visible" width="820px" append-to-body>
      <el-form :model="verifyForm" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="产品">
              <el-select v-model="verifyForm.product" clearable filterable style="width: 100%" placeholder="可选，选择待校验产品" @change="handleVerifyProductChange">
                <el-option v-for="item in productOptions" :key="item.name" :label="item.label" :value="item.name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="功能点">
              <el-select v-model="verifyForm.feature" clearable filterable style="width: 100%" placeholder="可选，选择待校验功能点">
                <el-option v-for="item in verifyFeatureOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="指纹摘要">
              <el-input v-model="verifyForm.fingerprintHash" placeholder="可选，填入客户环境指纹摘要" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="License内容">
              <el-input v-model="verifyForm.licenseJson" type="textarea" :rows="10" placeholder="粘贴 .lzxlic 文件内容" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <div v-if="verifyResult" class="verify-result">
        <el-alert :title="verifyResult.valid ? 'License 校验通过' : 'License 校验未通过'" :type="verifyResult.valid ? 'success' : 'error'" show-icon :closable="false" />
        <el-descriptions :column="2" border size="small" class="verify-desc">
          <el-descriptions-item label="授权编号">{{ verifyResult.licenseId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusLabel(verifyResult.status) }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ verifyResult.customer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ productLabel(verifyResult.product) }}</el-descriptions-item>
          <el-descriptions-item label="授权版本">{{ editionLabel(verifyResult.edition) }}</el-descriptions-item>
          <el-descriptions-item label="功能点">{{ verifyResult.features?.join(', ') || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-tag v-for="item in verifyResult.checks" :key="item" type="success" class="verify-tag">{{ item }}</el-tag>
          </el-col>
          <el-col :span="12">
            <el-tag v-for="item in verifyResult.errors" :key="item" type="danger" class="verify-tag">{{ item }}</el-tag>
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitVerify">校 验</el-button>
          <el-button @click="verifyDialog.visible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="LicenseAdmin" lang="ts">
import { computed, ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import FileSaver from 'file-saver';
import { delLicense, downloadLicense, issueLicense, listLicense, listProduct, revokeLicense, verifyLicense } from '@/api/license/license';
import { LicenseForm, LicenseQuery, LicenseVerifyVO, LicenseVO, ProductVO } from '@/api/license/license/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';

const queryFormRef = ref<FormInstance>();
const licenseFormRef = ref<FormInstance>();
const licenseList = ref<LicenseVO[]>([]);
const loading = ref(false);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const multiple = ref(true);
const total = ref(0);
const backendProducts = ref<ProductVO[]>([]);

const editionOptions = [
  { label: '试用版', value: 'Trial' },
  { label: '标准版', value: 'Standard' },
  { label: '专业版', value: 'Professional' },
  { label: '企业版', value: 'Enterprise' }
];
const productDefinitions = [
  {
    name: 'ZX-TrustReader',
    label: 'ZX-TrustReader',
    version: '4.1.2',
    features: [
      { label: 'PDF 阅读', value: 'reader.pdf' },
      { label: 'OFD 阅读', value: 'reader.ofd' },
      { label: '电子签章', value: 'signature.sign' },
      { label: '签名验签', value: 'signature.verify' },
      { label: '批注能力', value: 'annotation.basic' },
      { label: '安全水印', value: 'security.watermark' }
    ]
  },
  {
    name: 'CA',
    label: 'CA 证书认证系统',
    version: '4.1.2',
    features: [
      { label: '根 CA 管理', value: 'ca.root' },
      { label: '子 CA 管理', value: 'ca.sub' },
      { label: '证书签发', value: 'ca.cert.issue' },
      { label: '证书吊销', value: 'ca.cert.revoke' },
      { label: '证书模板', value: 'ca.profile' },
      { label: 'CRL 发布', value: 'ca.crl.publish' }
    ]
  },
  {
    name: 'KMC',
    label: 'KMC 密钥管理中心',
    version: '4.1.2',
    features: [
      { label: '密钥池管理', value: 'kmc.key.pool' },
      { label: '密钥归档', value: 'kmc.key.archive' },
      { label: '密钥恢复', value: 'kmc.key.recovery' },
      { label: '密钥轮换', value: 'kmc.key.rotation' },
      { label: '审批流程', value: 'kmc.workflow.approval' },
      { label: '审计追踪', value: 'kmc.audit.trace' }
    ]
  },
  {
    name: 'RA',
    label: 'RA 注册认证系统',
    version: '4.1.2',
    features: [
      { label: '证书申请', value: 'ra.cert.request' },
      { label: '申请审核', value: 'ra.request.approval' },
      { label: '用户管理', value: 'ra.user.manage' },
      { label: '证书下载', value: 'ra.cert.download' },
      { label: '证书更新', value: 'ra.cert.renew' },
      { label: '通知提醒', value: 'ra.notification' }
    ]
  }
];

const productOptions = computed(() =>
  productDefinitions.map((item) => {
    const backendProduct = backendProducts.value.find((product) => product.name === item.name);
    return {
      ...item,
      version: backendProduct?.productVersion || item.version
    };
  })
);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});
const detail = reactive({
  visible: false,
  json: ''
});
const verifyDialog = reactive({
  visible: false
});
const verifyForm = reactive({
  licenseJson: '',
  product: 'ZX-TrustReader',
  feature: '',
  fingerprintHash: ''
});
const verifyResult = ref<LicenseVerifyVO>();

const LONG_TERM_EXPIRY = '9999-12-31 23:59:59';

const createDefaultForm = (): LicenseForm => ({
  customerName: '',
  contact: '',
  phone: '',
  email: '',
  product: 'ZX-TrustReader',
  productVersion: '4.1.2',
  edition: 'Professional',
  notBefore: '',
  notAfter: '',
  features: [],
  maxUsers: 0,
  maxDevices: 0,
  maxServerNodes: 0,
  offlineDays: 0,
  bindingType: 'machine',
  fingerprintHash: 'BASE64URL-SHA256',
  auditPolicy: 'NONE',
  remark: ''
});

const data = reactive<PageData<LicenseForm, LicenseQuery>>({
  form: createDefaultForm(),
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    customerName: undefined,
    product: undefined,
    edition: undefined,
    status: undefined
  },
  rules: {
    customerName: [{ required: true, message: '客户名称不能为空', trigger: 'blur' }],
    product: [{ required: true, message: '产品不能为空', trigger: 'blur' }],
    productVersion: [{ required: true, message: '产品版本不能为空', trigger: 'blur' }],
    edition: [{ required: true, message: '授权版本不能为空', trigger: 'change' }],
    features: [{ required: true, message: '功能点不能为空', trigger: 'change' }],
    auditPolicy: [{ required: true, message: '审计策略不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const currentFeatureOptions = computed(() => productOptions.value.find((item) => item.name === form.value.product)?.features || []);
const verifyFeatureOptions = computed(() => productOptions.value.find((item) => item.name === verifyForm.product)?.features || []);

const getList = async () => {
  loading.value = true;
  try {
    const res = await listLicense(queryParams.value, true);
    const page = readKmcPage<LicenseVO>(res);
    licenseList.value = page.records;
    total.value = page.total;
  } catch {
    licenseList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  form.value = createDefaultForm();
  licenseFormRef.value?.resetFields();
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleSelectionChange = (selection: LicenseVO[]) => {
  ids.value = selection.map((item) => item.id);
  multiple.value = !selection.length;
};

const handleIssue = () => {
  reset();
  applyProductDefaults(form.value.product);
  dialog.visible = true;
  dialog.title = `签发 ${productLabel(form.value.product)} License`;
};

const cancel = () => {
  dialog.visible = false;
  reset();
};

const submitForm = () => {
  licenseFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    await issueLicense({
      ...form.value,
      notBefore: normalizeDateTimeValue(form.value.notBefore) || toDateTimeValue(new Date()),
      notAfter: normalizeDateTimeValue(form.value.notAfter) || LONG_TERM_EXPIRY
    });
    ElMessage.success('签发成功');
    dialog.visible = false;
    getList();
  });
};

const handleDetail = (row: LicenseVO) => {
  detail.json = formatLicenseJson(row.licenseJson);
  detail.visible = true;
};

const handleDownload = async (row: LicenseVO) => {
  const blob = await downloadLicense(row.id);
  FileSaver.saveAs(new Blob([blob as any]), `${row.licenseId || row.id}.lzxlic`);
};

const handleRevoke = async (row: LicenseVO) => {
  await ElMessageBox.confirm(`是否确认吊销 License ${row.licenseId || row.id}？`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  });
  await revokeLicense(row.id);
  ElMessage.success('吊销成功');
  getList();
};

const handleDelete = async (row?: LicenseVO) => {
  const selectedIds = row?.id ? [row.id] : ids.value;
  await ElMessageBox.confirm('是否确认删除所选 License？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  });
  await delLicense(selectedIds);
  ElMessage.success('删除成功');
  getList();
};

const handleVerify = () => {
  verifyForm.licenseJson = '';
  verifyForm.product = 'ZX-TrustReader';
  verifyForm.feature = verifyFeatureOptions.value[0]?.value || '';
  verifyForm.fingerprintHash = '';
  verifyResult.value = undefined;
  verifyDialog.visible = true;
};

const handleProductChange = () => {
  applyProductDefaults(form.value.product);
  dialog.title = `签发 ${productLabel(form.value.product)} License`;
};

const handleVerifyProductChange = () => {
  verifyForm.feature = verifyFeatureOptions.value[0]?.value || '';
};

const applyProductDefaults = (productName: string) => {
  const product = productOptions.value.find((item) => item.name === productName) || productOptions.value[0];
  if (!product) {
    return;
  }
  form.value.product = product.name;
  form.value.productVersion = product.version;
  form.value.features = product.features.map((item) => item.value);
};

const getProducts = async () => {
  try {
    const res = await listProduct({ pageNum: 1, pageSize: 100 }, true);
    backendProducts.value = readKmcPage<ProductVO>(res).records;
  } catch {
    backendProducts.value = [];
  }
};

const submitVerify = async () => {
  if (!verifyForm.licenseJson.trim()) {
    ElMessage.warning('请粘贴 License 内容');
    return;
  }
  const res = await verifyLicense(verifyForm);
  verifyResult.value = unwrapKmcData<LicenseVerifyVO>(res);
};

const formatDate = (value?: string) => {
  if (isLongTermExpiry(value)) {
    return '长期有效';
  }
  return value ? value.replace('T', ' ') : '-';
};

const isLongTermExpiry = (value?: string) => {
  return normalizeDateTimeValue(value)?.startsWith('9999-12-31') || false;
};

const statusLabel = (status?: string) => {
  const map: Record<string, string> = {
    ISSUED: '已签发',
    ACTIVE: '已激活',
    REVOKED: '已吊销',
    EXPIRED: '已过期'
  };
  return map[status || ''] || status || '-';
};

const editionLabel = (edition?: string) => {
  if (!edition) {
    return '-';
  }
  return editionOptions.find((item) => item.value === edition)?.label || edition;
};

const productLabel = (product?: string) => {
  if (!product) {
    return '-';
  }
  return productOptions.value.find((item) => item.name === product)?.label || product;
};

const quotaLabel = (value?: number) => {
  if (value === 0) {
    return '不限制';
  }
  return value ?? '-';
};

const statusType = (status?: string) => {
  if (status === 'ACTIVE' || status === 'ISSUED') {
    return 'success';
  }
  if (status === 'REVOKED') {
    return 'danger';
  }
  if (status === 'EXPIRED') {
    return 'warning';
  }
  return 'info';
};

function toDateTimeValue(value: Date) {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(
    value.getSeconds()
  )}`;
}

function normalizeDateTimeValue(value?: string) {
  return value ? value.replace('T', ' ').replace(/\.\d{3}Z?$/, '').slice(0, 19) : value;
}

function formatLicenseJson(value?: string) {
  if (!value) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

onMounted(() => {
  getProducts();
  getList();
});
</script>

<style scoped>
.license-page .summary-row {
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.summary-label,
.muted {
  color: var(--el-text-color-secondary);
}

.summary-item strong {
  font-size: 20px;
}

.verify-result {
  margin-top: 8px;
}

.verify-desc {
  margin: 12px 0;
}

.verify-tag {
  margin: 0 8px 8px 0;
}

.quota-tip {
  margin: -8px 0 12px 110px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
