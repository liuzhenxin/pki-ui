<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="证书名称" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入证书名称" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="certList"
      row-key="id"
      :expand-row-keys="expandedRootIds"
      @expand-change="handleRootExpandChange"
      @row-click="handleRootRowClick"
    >
      <el-table-column type="expand" width="48">
        <template #default="scope">
          <div class="profile-expand">
            <div class="profile-expand-header">
              <div>
                <div class="profile-expand-title">授权模板</div>
                <div class="profile-expand-subtitle">
                  自动审核只跳过审核员，不跳过制证员，也不会自动调用 CA。双证书需两侧模板都设为自动审核才会跳过审核。
                </div>
              </div>
              <el-tag type="primary" effect="light">{{ scope.row.profiles?.length || 0 }} 个模板</el-tag>
            </div>
            <el-table v-if="scope.row.profiles?.length" :data="scope.row.profiles" border size="small" class="profile-table" row-key="id">
              <el-table-column label="模板名称" prop="name" min-width="220" show-overflow-tooltip>
                <template #default="profileScope">
                  <div class="profile-name-cell">
                    <span class="profile-name">{{ profileScope.row.name || '-' }}</span>
                    <el-tag v-if="isDefaultAdminProfile(profileScope.row)" size="small" type="success" effect="light">管理员</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="模板类型" width="130" align="center">
                <template #default="profileScope">
                  <el-tag :type="getProfileTagType(profileScope.row)" effect="light">{{ getProfileTypeLabel(profileScope.row) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="有效期" width="110" align="center">
                <template #default="profileScope">{{ getProfileValidity(profileScope.row) }}</template>
              </el-table-column>
              <el-table-column label="说明" min-width="180" show-overflow-tooltip>
                <template #default="profileScope">{{ getProfileDescription(profileScope.row) }}</template>
              </el-table-column>
              <el-table-column label="审核策略" min-width="320">
                <template #default="profileScope">
                  <div @click.stop>
                    <el-radio-group
                      :model-value="profileScope.row.approvalMode || 'required'"
                      size="small"
                      :disabled="!canSaveApproval || savingProfileId === profileScope.row.id"
                      @change="(value: string) => handleApprovalChange(profileScope.row, value)"
                    >
                      <el-radio-button value="required">人工审核</el-radio-button>
                      <el-radio-button value="optional">自动审核</el-radio-button>
                    </el-radio-group>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="96" align="center" fixed="right">
                <template #default="profileScope">
                  <el-button link type="primary" icon="View" @click.stop="handleViewProfile(profileScope.row)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="该根证书暂无授权模板" :image-size="80" class="profile-empty" />
          </div>
        </template>
      </el-table-column>
      <el-table-column label="证书名称" align="center" prop="name" />
      <el-table-column label="颁发者" align="center" prop="issuer" />
      <el-table-column label="主题" align="center" prop="subject" />
      <el-table-column label="有效期开始" align="center" prop="notBefore" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.notBefore) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="有效期结束" align="center" prop="notAfter" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.notAfter) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="100">
        <template #default="scope">
          <el-tooltip :content="scope.row.status === '1' ? '证书在有效期内' : '证书已过期或无效'" placement="top">
            <el-tag :type="scope.row.status === '1' ? 'success' : 'info'">{{ scope.row.status === '1' ? '有效' : '无效' }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="模板数" align="center" width="90">
        <template #default="scope">
          <el-tag type="primary" effect="plain">{{ scope.row.profileCount || 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding" width="150">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click.stop="handleView(scope.row)" v-hasPermi="['ra:root']">详情</el-button>
          <el-button link type="primary" icon="Download" @click.stop="handleDownload(scope.row)" v-hasPermi="['ra:root']">下载</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 创建证书对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-tabs v-model="activeTab">
        <el-tab-pane v-if="dialogType === 'root'" label="自签根证书" name="self">
          <el-form :model="selfForm" :rules="selfRules" ref="selfFormRef" label-width="140px">
            <el-tabs type="border-card">
              <el-tab-pane label="基本信息">
                <el-form-item label="证书名称" prop="name">
                  <el-input v-model="selfForm.name" placeholder="请输入证书名称" />
                </el-form-item>
                <el-form-item label="关联签名者" prop="signerId">
                  <el-select v-model="selfForm.signerId" placeholder="请选择签名者" @change="onSignerChange" style="width: 100%">
                    <el-option v-for="s in signerList" :key="s.id" :label="s.name" :value="s.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="证书模板" prop="profileId">
                  <el-select v-model="selfForm.profileId" placeholder="请选择模板" @change="onProfileChange" style="width: 100%">
                    <el-option v-for="item in rootCaProfiles" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <CertSubject v-model="selfForm.subjectItems" propPrefix="subjectItems" />
              </el-tab-pane>

              <el-tab-pane label="有效期配置">
                <el-form-item label="最大有效期" prop="validity">
                  <el-input v-model.number="selfForm.validity" placeholder="请输入正整数" style="width: 100%">
                    <template #append>
                      <el-select v-model="selfForm.validityUnit" style="width: 80px">
                        <el-option label="年" value="y" />
                        <el-option label="天" value="d" />
                      </el-select>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item label="过期周期(天)" prop="expirationPeriod">
                  <el-input-number v-model="selfForm.expirationPeriod" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="保留过期证书(天)" prop="keepExpiredCertDays">
                  <el-input-number v-model="selfForm.keepExpiredCertDays" style="width: 100%" />
                </el-form-item>
                <el-form-item label="有效期模式" prop="validityMode">
                  <el-select v-model="selfForm.validityMode" style="width: 100%">
                    <el-option label="截止" value="cutoff" />
                    <el-option label="严格" value="strict" />
                    <el-option label="宽松" value="lax" />
                  </el-select>
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="URI配置">
                <el-form-item v-for="(item, index) in selfForm.cacertUris" :key="'cacert-' + index" :label="index === 0 ? 'CA证书URI' : ' '">
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('cacertUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('cacertUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>

                <el-form-item v-for="(item, index) in selfForm.ocspUris" :key="'ocsp-' + index" :label="index === 0 ? 'OCSP URI' : ' '">
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('ocspUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('ocspUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="高级配置">
                <el-form-item label="序列号长度" prop="snSize">
                  <el-input-number v-model="selfForm.snSize" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="状态" prop="status">
                  <el-select v-model="selfForm.status" style="width: 100%">
                    <el-option label="激活" value="active" />
                    <el-option label="停用" value="inactive" />
                  </el-select>
                </el-form-item>
              </el-tab-pane>
            </el-tabs>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="dialogType === 'sub'" label="在线签发模式" name="online">
          <el-form ref="onlineSubFormRef" :model="onlineSubForm" :rules="onlineSubRules" label-width="140px">
            <el-form-item label="证书名称" prop="name">
              <el-input v-model="onlineSubForm.name" placeholder="请输入证书名称" />
            </el-form-item>
            <el-form-item label="父级CA" prop="parentCaId">
              <el-select v-model="onlineSubForm.parentCaId" placeholder="请选择父级CA" @change="onParentCaChange" style="width: 100%">
                <el-option v-for="item in certList" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="证书模板" prop="profileId">
              <el-select v-model="onlineSubForm.profileId" placeholder="请选择子CA模板" @change="onSubProfileChange" style="width: 100%">
                <el-option v-for="item in subCaProfiles" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <CertSubject v-model="onlineSubForm.subjectItems" propPrefix="subjectItems" />
            <el-form-item label="密钥算法" prop="keyAlgorithm">
              <el-select v-model="onlineSubForm.keyAlgorithm" style="width: 100%">
                <el-option v-for="item in subAvailableAlgos" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="有效期" prop="validity">
              <el-input v-model.number="onlineSubForm.validity" style="width: 100%">
                <template #append>
                  <el-select v-model="onlineSubForm.validityUnit" style="width: 80px">
                    <el-option label="年" value="y" />
                    <el-option label="天" value="d" />
                  </el-select>
                </template>
              </el-input>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="dialogType === 'sub'" label="CSR导入模式" name="import">
          <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-width="100px">
            <el-form-item label="证书名称" prop="name">
              <el-input v-model="importForm.name" placeholder="请输入证书名称" />
            </el-form-item>
            <el-form-item label="CSR生成">
              <el-button type="primary" @click="handleGenerateCSR">生成 CSR</el-button>
              <el-input v-if="importForm.csr" v-model="importForm.csr" type="textarea" :rows="4" readonly style="margin-top: 10px" />
            </el-form-item>
            <el-form-item label="上传证书" prop="certFile">
              <el-upload
                ref="uploadRef"
                action="#"
                :limit="1"
                :auto-upload="false"
                :on-change="handleFileChange"
                :on-remove="handleFileRemove"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                <template #tip>
                  <div class="el-upload__tip">请上传由上级CA签发的证书文件</div>
                </template>
              </el-upload>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="证书详情" width="60%">
      <X509Cert v-if="showDetail" :certPem="currentCertPem" />
    </el-dialog>

    <el-dialog v-model="profileDetailDialog.visible" title="模板详情" width="1000px" append-to-body top="5vh">
      <div class="profile-detail-body">
        <el-descriptions v-if="profileDetailDialog.data" :column="2" border class="profile-detail-summary">
          <el-descriptions-item label="模板名称">{{ profileDetailDialog.data.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="模板类型">
            <el-tag :type="getProfileTagType(profileDetailDialog.data)" effect="light">{{ getProfileTypeLabel(profileDetailDialog.data) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="有效期">{{ getProfileValidity(profileDetailDialog.data) }}</el-descriptions-item>
          <el-descriptions-item label="模板ID">{{ profileDetailDialog.data.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ profileDetailDialog.data.description || '-' }}</el-descriptions-item>
        </el-descriptions>
        <CertProfile v-if="profileDetailDialog.confData" :profile="profileDetailDialog.confData" />
        <el-empty v-else description="暂无模板配置详情" />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="profileDetailDialog.visible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 安全确认对话框 -->
    <SecurityConfirm
      v-model="securityConfirm.visible"
      :title="securityConfirm.title"
      :action="securityConfirm.action"
      @confirm="securityConfirm.onConfirm"
    />
  </div>
</template>

<script setup name="RootCert" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, FormInstance, UploadInstance, UploadProps } from 'element-plus';
import {
  ArrowDown,
  Search,
  Refresh,
  View,
  Download,
  Plus,
  Minus,
  Stamp,
  QuestionFilled,
  Edit,
  Delete,
  SuccessFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue';
import X509Cert from '@/components/X509Cert/index.vue';
import SecurityConfirm from '@/components/SecurityConfirm/index.vue';
import CertProfile from '@/components/CertProfile/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { listProfile, getProfile } from '@/api/ca/profile';
import { listRaRootCa } from '@/api/ra/root';
import { saveRaProfileApprovalMode } from '@/api/ra/profile';
import { checkPermi } from '@/utils/permission';
import { listSigner } from '@/api/ca/signer';
import { genRootCa, enableRootCa, disableRootCa, revokeRootCa, genSubCaOnline } from '@/api/ca/root';
import { X509 } from 'jsrsasign';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
import { parseTime } from '@/utils/ruoyi';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const router = useRouter();
const canSaveApproval = checkPermi(['ra:profile:save']);
const savingProfileId = ref<number | string>();

const securityConfirm = reactive({
  visible: false,
  title: '敏感操作安全确认',
  action: '',
  onConfirm: () => {}
});

const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const certList = ref([]);
const open = ref(false);
const title = ref('');
const activeTab = ref('self');
const showDetail = ref(false);
const currentCertPem = ref('');
const dialogType = ref('root'); // 'root' or 'sub'
const rootCaProfiles = ref([]);
const signerList = ref([]);
const availableAlgos = ref(['RSA2048', 'RSA4096', 'SM2']);
const profileDetailDialog = reactive({
  visible: false,
  data: null as any,
  confData: null as any
});

const queryForm = ref<FormInstance>();
const expandedRootIds = ref<Array<string | number>>([]);

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined
  },
  selfForm: {
    name: '',
    signerId: undefined as string | number | undefined,
    profileId: undefined as string | number | undefined,
    rootcaProfileName: '', // 模板名称
    subjectItems: [] as any[],
    // 密钥配置
    keyAlgorithm: 'SM2',
    signerType: 'PKCS12',
    keyIndex: 1,
    password: '',
    // 有效期配置
    validity: 10,
    validityUnit: 'y',
    expirationPeriod: 365,
    keepExpiredCertDays: -1,
    validityMode: 'cutoff',
    // URI配置
    cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
    ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],
    // 高级配置
    snSize: 20,
    status: 'active'
  },
  importForm: {
    name: '',
    csr: '',
    certFile: null as File | null
  },
  onlineSubForm: {
    name: '',
    parentCaId: undefined as string | number | undefined,
    profileId: undefined as string | number | undefined,
    subjectItems: [] as any[],
    keyAlgorithm: 'SM2',
    validity: 5,
    validityUnit: 'y'
  }
});

const { queryParams, selfForm, importForm, onlineSubForm } = toRefs(data);

/** 签名者变更处理 */
function onSignerChange(val: any) {
  const signer = signerList.value.find((s: any) => s.id === val);
  if (signer) {
    selfForm.value.keyAlgorithm = signer.algo;
    selfForm.value.signerType = signer.signerType;
    selfForm.value.keyIndex = signer.keyIndex;
    selfForm.value.password = signer.password;
  }
}

/** 加载签名者列表 */
async function loadSigners() {
  try {
    const res = await listSigner();
    signerList.value = res.data || [];
    if (!selfForm.value.signerId && signerList.value.length > 0) {
      selfForm.value.signerId = (signerList.value[0] as any).id;
      onSignerChange(selfForm.value.signerId);
    }
  } catch (e) {}
}

const parentCas = ref([]);
const subCaProfiles = ref([]);
const subAvailableAlgos = ref(['RSA2048', 'SM2']);

const onlineSubRules = {
  parentCaId: [{ required: true, message: '请选择父级CA', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  validity: [
    { required: true, message: '请输入有效期', trigger: 'blur' },
    { type: 'number', message: '必须为正整数', trigger: 'blur', min: 1 }
  ]
};

const selfRules = {
  name: [{ required: true, message: '请输入证书名称', trigger: 'blur' }],
  signerId: [{ required: true, message: '请选择签名者', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  validity: [
    { required: true, message: '请输入最大有效期', trigger: 'blur' },
    { type: 'number', message: '必须为正整数', trigger: 'blur', min: 1 }
  ]
};

const importRules = {
  name: [{ required: true, message: '请输入证书名称', trigger: 'blur' }],
  certFile: [{ required: true, message: '请上传证书文件', trigger: 'change' }]
};

const selfFormRef = ref<FormInstance>();
const importFormRef = ref<FormInstance>();
const onlineSubFormRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();

/** 解析 X509 日期格式 */
function parseX509Date(zStr: string): Date {
  let y, m, d, h, min, s;
  if (zStr.length === 13) {
    y = '20' + zStr.substring(0, 2);
    m = parseInt(zStr.substring(2, 4)) - 1;
    d = zStr.substring(4, 6);
    h = zStr.substring(6, 8);
    min = zStr.substring(8, 10);
    s = zStr.substring(10, 12);
  } else {
    y = zStr.substring(0, 4);
    m = parseInt(zStr.substring(4, 6)) - 1;
    d = zStr.substring(6, 8);
    h = zStr.substring(8, 10);
    min = zStr.substring(10, 12);
    s = zStr.substring(12, 14);
  }
  return new Date(Date.UTC(y as any, m, d as any, h as any, min as any, s as any));
}

/** 格式化 X509 日期为显示格式 */
function formatX509Date(zStr: string): string {
  const date = parseX509Date(zStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/** 解析证书信息 */
function parseCertInfo(certPem: string) {
  if (!certPem) return null;

  const x509 = new X509();
  try {
    x509.readCertPEM(certPem);

    // 格式化 DN
    const formatDN = (array: any[]) => {
      if (!array || array.length === 0) return '';
      return array
        .map((e: any) => {
          const type = e[0].type;
          const val = e[0].value;
          return `${type}=${val}`;
        })
        .join(', ');
    };

    const issuer = formatDN(x509.getIssuer().array);
    const subject = formatDN(x509.getSubject().array);
    const notBefore = x509.getNotBefore();
    const notAfter = x509.getNotAfter();

    // 判断证书状态（是否在有效期内）
    const now = new Date();
    const notBeforeDate = parseX509Date(notBefore);
    const notAfterDate = parseX509Date(notAfter);
    const status = now >= notBeforeDate && now <= notAfterDate ? '1' : '0';

    return {
      issuer,
      subject,
      notBefore: formatX509Date(notBefore),
      notAfter: formatX509Date(notAfter),
      status,
      pem: certPem
    };
  } catch (e) {
    return null;
  }
}

/** 查询列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listRaRootCa(queryParams.value);

    // 处理分页数据结构
    let rawList = [];
    let totalCount = 0;

    if (res.data) {
      // 尝试不同的数据结构
      if (Array.isArray(res.data.records)) {
        rawList = res.data.records;
        totalCount = res.data.total || 0;
      } else if (Array.isArray(res.data.rows)) {
        rawList = res.data.rows;
        totalCount = res.data.total || 0;
      } else if (Array.isArray(res.data.list)) {
        rawList = res.data.list;
        totalCount = res.data.total || 0;
      } else if (Array.isArray(res.data)) {
        rawList = res.data;
        totalCount = res.data.length;
      }
    }

    // 解析每个证书
    certList.value = rawList
      .map((item: any) => {
        const certInfo = parseCertInfo(item.cert);
        return {
          id: item.id,
          name: item.name,
          caStatus: item.caStatus,
          profiles: item.profiles || [],
          profileNames: item.profileNames || [],
          profileCount: item.profileCount || 0,
          ...certInfo
        };
      })
      .filter((item: any) => item.issuer); // 过滤掉解析失败的证书

    total.value = totalCount;
  } catch (error: any) {
    const errMsg = error.response?.data?.msg || error.message || '获取根证书列表失败';
    ElMessage.error(errMsg);
    certList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  queryForm.value?.resetFields();
  handleQuery();
}

function handleRootRowClick(row: any) {
  const rowId = row?.id;
  if (rowId === undefined || rowId === null) {
    return;
  }
  const isExpanded = expandedRootIds.value.some((id) => String(id) === String(rowId));
  expandedRootIds.value = isExpanded ? [] : [rowId];
}

function handleRootExpandChange(row: any, expandedRows: any[]) {
  const expanded = expandedRows.some((item) => String(item.id) === String(row.id));
  expandedRootIds.value = expanded ? [row.id] : [];
}

function getProfileType(profile: any) {
  return profile?.type || profile?.certLevel || profile?.category || '';
}

function safeParseProfileConf(profile: any) {
  if (!profile?.conf) {
    return {};
  }
  if (typeof profile.conf !== 'string') {
    return profile.conf || {};
  }
  try {
    return parseJson(profile.conf) || {};
  } catch {
    return {};
  }
}

function getProfileTypeLabel(profile: any) {
  const type = getProfileType(profile);
  const labels: Record<string, string> = {
    RootCA: '根CA',
    SubCA: '子CA',
    IntermediateCA: '中间CA',
    EndEntity: '终端实体'
  };
  return labels[type] || type || '-';
}

function getProfileTagType(profile: any) {
  const type = getProfileType(profile);
  if (type === 'RootCA') return 'danger';
  if (type === 'SubCA' || type === 'IntermediateCA') return 'warning';
  if (type === 'EndEntity') return 'success';
  return 'info';
}

function getProfileValidity(profile: any) {
  const conf = safeParseProfileConf(profile);
  return profile?.validity || conf?.validity || '-';
}

function getProfileDescription(profile: any) {
  const conf = safeParseProfileConf(profile);
  return profile?.description || conf?.description || profile?.metadata?.details || '-';
}

function isDefaultAdminProfile(profile: any) {
  return profile?.name === '管理员证书模板';
}

async function handleViewProfile(profile: any) {
  try {
    const profileData = profile || {};
    const conf = safeParseProfileConf(profileData);
    if (conf?.keyAlgorithms) {
      conf.keyAlgorithms = parseKeyAlgorithms(conf.keyAlgorithms);
    }
    profileDetailDialog.data = profileData;
    profileDetailDialog.confData = {
      ...conf,
      metadata: {
        category: profileData.type || conf?.certLevel || '证书模板',
        details: profileData.description || conf?.description || ''
      },
      certLevel: conf?.certLevel || profileData.type || profileData.certLevel || '',
      maxSize: conf?.maxSize || '-',
      validity: conf?.validity || profileData.validity || '-',
      notBeforeTime: conf?.notBeforeTime || '-',
      keypairGeneration: conf?.keypairGeneration || '-',
      subject: conf?.subject || [],
      extensions: conf?.extensions || []
    };
    profileDetailDialog.visible = true;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '获取模板详情失败');
  }
}

/** 新增按钮操作 */
async function handleCommand(command: string) {
  reset();
  if (command === 'root') {
    dialogType.value = 'root';
    title.value = '创建根CA证书';
    activeTab.value = 'self';
    // 加载数据
    await loadRootCaProfiles();
    await loadSigners();
  } else if (command === 'sub') {
    dialogType.value = 'sub';
    title.value = '创建子CA证书';
    activeTab.value = 'online';
    // 加载子CA模板
    await loadSubCaProfiles();
  }
  open.value = true;
}

/** 加载RootCA模板列表 */
async function loadRootCaProfiles() {
  try {
    // 调用listProfile API，传递type参数筛选RootCA模板
    const res = await listProfile({ type: 'RootCA' });

    const profiles = res.data || [];

    if (profiles.length === 0) {
      ElMessage.warning('没有找到可用的RootCA证书模板');
      return;
    }

    // 设置模板列表
    rootCaProfiles.value = profiles;

    // 默认选中第一个
    const firstProfile = profiles[0];
    selfForm.value.profileId = firstProfile.id;

    // 调用模板变更处理
    await onProfileChange(selfForm.value.profileId);
  } catch (error: any) {
    ElMessage.error('加载RootCA证书模板失败: ' + (error.response?.data?.msg || error.message));
  }
}

/** 加载SubCA模板列表 */
async function loadSubCaProfiles() {
  try {
    const res = await listProfile({ type: 'SubCA' });
    subCaProfiles.value = res.data || [];
    if (subCaProfiles.value.length > 0) {
      onlineSubForm.value.profileId = subCaProfiles.value[0].id;
      await onSubProfileChange(onlineSubForm.value.profileId);
    }
  } catch (error: any) {
    ElMessage.error('加载子CA证书模板失败');
  }
}

/** 子CA模板变更处理 */
async function onSubProfileChange(profileId: any) {
  if (!profileId) return;
  try {
    const res = await getProfile(profileId);
    const profile = res.data;
    const conf = parseJson(profile.conf);

    if (conf) {
      // 设置有效期
      if (conf.validity) {
        const v = conf.validity;
        const unit = v.slice(-1);
        const val = parseInt(v.slice(0, -1));
        if (!isNaN(val)) {
          onlineSubForm.value.validity = val;
          onlineSubForm.value.validityUnit = unit || 'y';
        }
      }

      // 设置主题项
      const rdns = conf.subject?.rdns || conf.subject;
      if (rdns && Array.isArray(rdns) && rdns.length > 0) {
        const items: any[] = [];
        rdns.forEach((rdn: any) => {
          const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
          let compType = rdnType.toLowerCase();
          for (const [type, meta] of Object.entries(typeMapping)) {
            if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) {
              compType = type;
              break;
            }
          }
          items.push({
            type: compType,
            value: rdn.value || '',
            minOccurs: rdn.minOccurs,
            maxOccurs: rdn.maxOccurs
          });
        });
        onlineSubForm.value.subjectItems = sortSubjectItems(items);
      }
    }
  } catch (error) {}
}

/** 模板变更处理 */
async function onProfileChange(profileId: any) {
  if (!profileId) return;

  try {
    const res = await getProfile(profileId);
    const profile = res.data;

    const conf = parseJson(profile.conf);

    if (conf) {
      // 1. 设置模板名称
      selfForm.value.rootcaProfileName = profile.name || '';

      // 2. 设置有效期
      if (conf.validity) {
        const v = conf.validity;
        const unit = v.slice(-1);
        const val = parseInt(v.slice(0, -1));
        if (!isNaN(val)) {
          selfForm.value.validity = val;
          selfForm.value.validityUnit = unit || 'y';
        }
      }

      // 3. 设置可选算法
      if (conf.keyAlgorithms && Array.isArray(conf.keyAlgorithms)) {
        const algos: string[] = [];
        conf.keyAlgorithms.forEach((a: any) => {
          if (typeof a === 'string') {
            algos.push(a);
            return;
          }
          // 处理复杂结构
          const mainDesc = a.algorithms?.[0]?.description;
          if (mainDesc === 'RSA' && a.parameters?.rsa?.modulus) {
            a.parameters.rsa.modulus.forEach((m: number) => {
              algos.push(`RSA${m}`);
            });
          } else if (mainDesc === 'EC' && a.parameters?.ec?.curves?.[0]?.description?.toLowerCase().includes('sm2')) {
            algos.push('SM2');
          } else if (mainDesc === 'EC' && a.parameters?.ec?.curves?.[0]?.description) {
            algos.push(a.parameters.ec.curves[0].description.toUpperCase());
          } else if (mainDesc) {
            // 支持 PQC (ML-DSA 等) 或其他直接在 description 中定义的算法
            algos.push(mainDesc);
          } else if (a.name || a.type) {
            algos.push(a.name || a.type);
          }
        });
        availableAlgos.value = algos;
        if (availableAlgos.value.length > 0) {
          selfForm.value.keyAlgorithm = availableAlgos.value[0];
        }
      }

      // 4. 设置主题项
      const rdns = conf.subject?.rdns || conf.subject;
      if (rdns && Array.isArray(rdns) && rdns.length > 0) {
        const items: any[] = [];
        rdns.forEach((rdn: any) => {
          // 处理 type: { oid: '...', description: '...' } 或 type: '...'
          const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
          let compType = rdnType.toLowerCase();
          for (const [type, meta] of Object.entries(typeMapping)) {
            if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) {
              compType = type;
              break;
            }
          }

          const count = Math.max(1, rdn.minOccurs === undefined ? 1 : rdn.minOccurs);
          for (let i = 0; i < count; i++) {
            items.push({
              type: compType,
              value: rdn.value || '',
              minOccurs: rdn.minOccurs,
              maxOccurs: rdn.maxOccurs
            });
          }
        });
        selfForm.value.subjectItems = sortSubjectItems(items);
      } else {
        // 如果没有subject配置，使用默认的主题项
        selfForm.value.subjectItems = sortSubjectItems([
          { type: 'country', value: 'CN', minOccurs: 1, maxOccurs: 1 },
          { type: 'organization', value: '业务部门', minOccurs: 1, maxOccurs: 1 },
          { type: 'organizationalUnit', value: '业务管理员', minOccurs: 0, maxOccurs: 1 },
          { type: 'commonName', value: 'DemoCA', minOccurs: 1, maxOccurs: 1 }
        ]);
      }

      // 5. 设置URI配置
      if (conf.caCertUris && Array.isArray(conf.caCertUris) && conf.caCertUris.length > 0) {
        selfForm.value.cacertUris = conf.caCertUris.map((uri: string) => ({ value: uri }));
      }
      if (conf.ocspUris && Array.isArray(conf.ocspUris) && conf.ocspUris.length > 0) {
        selfForm.value.ocspUris = conf.ocspUris.map((uri: string) => ({ value: uri }));
      }
    } else {
    }
  } catch (error) {
    ElMessage.error('加载模板详情失败: ' + (error as any).message);

    // 使用默认的主题项
    selfForm.value.subjectItems = sortSubjectItems([
      { type: 'country', value: 'CN', minOccurs: 1, maxOccurs: 1 },
      { type: 'organization', value: '业务部门', minOccurs: 1, maxOccurs: 1 },
      { type: 'organizationalUnit', value: '业务管理员', minOccurs: 0, maxOccurs: 1 },
      { type: 'commonName', value: 'DemoCA', minOccurs: 1, maxOccurs: 1 }
    ]);
  }
}

/** 重置表单 */
function reset() {
  selfForm.value = {
    name: '',
    signerId: undefined as string | number | undefined,
    profileId: undefined,
    rootcaProfileName: '',
    subjectItems: [],
    keyAlgorithm: 'SM2',
    signerType: 'PKCS12',
    keyIndex: 1,
    password: '',
    validity: 10,
    validityUnit: 'y',
    expirationPeriod: 365,
    keepExpiredCertDays: -1,
    validityMode: 'cutoff',
    cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
    ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],
    snSize: 20,
    status: 'active'
  };
  importForm.value = {
    name: '',
    csr: '',
    certFile: null
  };
  onlineSubForm.value = {
    name: '',
    parentCaId: undefined,
    profileId: undefined,
    subjectItems: [],
    keyAlgorithm: 'SM2',
    validity: 5,
    validityUnit: 'y'
  };
  if (selfFormRef.value) selfFormRef.value.resetFields();
  if (importFormRef.value) importFormRef.value.resetFields();
  if (onlineSubFormRef.value) onlineSubFormRef.value.resetFields();
  if (uploadRef.value) uploadRef.value.clearFiles();
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  reset();
}

/** 生成CSR */
function handleGenerateCSR() {
  // 这里应该调用后端API生成CSR
  // 模拟生成
  importForm.value.csr = '-----BEGIN CERTIFICATE REQUEST-----\nMIIC...';
  ElMessage.success('CSR 生成成功');
}

/** 文件上传变更 */
const handleFileChange: UploadProps['onChange'] = (file) => {
  importForm.value.certFile = file.raw as File;
};

const handleFileRemove: UploadProps['onRemove'] = () => {
  importForm.value.certFile = null;
};

/** 提交按钮 */
function submitForm() {
  if (activeTab.value === 'self') {
    selfFormRef.value?.validate(async (valid: boolean) => {
      if (valid) {
        loading.value = true;
        try {
          const reqData = {
            name: selfForm.value.name,
            signerId: selfForm.value.signerId,
            rootcaProfile: selfForm.value.rootcaProfileName,
            subject: selfForm.value.subjectItems
              .filter((item: any) => item.value)
              .map((item: any) => {
                const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
                return `${key}=${item.value}`;
              })
              .join(','),
            algo: selfForm.value.keyAlgorithm,
            signerType: selfForm.value.signerType,
            keyIndex: selfForm.value.keyIndex,
            password: selfForm.value.password,
            maxValidity: selfForm.value.validity + selfForm.value.validityUnit,
            expirationPeriod: selfForm.value.expirationPeriod,
            keepExpiredCertDays: selfForm.value.keepExpiredCertDays,
            validityModeS: selfForm.value.validityMode === 'cutoff' ? 'CUTOFF' : selfForm.value.validityMode === 'strict' ? 'STRICT' : 'LAX',
            caStatus: selfForm.value.status,
            snLen: selfForm.value.snSize,
            caCertUris: selfForm.value.cacertUris.map((u: any) => u.value).filter((v: any) => v),
            ocspUris: selfForm.value.ocspUris.map((u: any) => u.value).filter((v: any) => v)
          };

          const res = await genRootCa({ co: reqData });
          if (res.data) {
            ElMessage.success('证书生成成功');
            open.value = false;
            getList();
          }
        } catch (error: any) {
          const errMsg = error.response?.data?.msg || error.message || '证书生成失败';
          ElMessage.error(errMsg);
        } finally {
          loading.value = false;
        }
      }
    });
  } else if (activeTab.value === 'online') {
    onlineSubFormRef.value?.validate(async (valid: boolean) => {
      if (valid) {
        loading.value = true;
        try {
          const reqData = {
            name: onlineSubForm.value.name,
            parentRootId: onlineSubForm.value.parentCaId,
            profileId: onlineSubForm.value.profileId,
            subject: onlineSubForm.value.subjectItems
              .filter((item: any) => item.value)
              .map((item: any) => {
                const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
                return `${key}=${item.value}`;
              })
              .join(','),
            algo: onlineSubForm.value.keyAlgorithm,
            maxValidity: onlineSubForm.value.validity + onlineSubForm.value.validityUnit
          };
          const res = await genSubCaOnline(reqData);
          if (res.data) {
            ElMessage.success('子CA签发成功');
            open.value = false;
            getList();
          }
        } catch (error: any) {
          const errMsg = error.response?.data?.msg || error.message || '子CA签发失败';
          ElMessage.error(errMsg);
        } finally {
          loading.value = false;
        }
      }
    });
  } else {
    importFormRef.value?.validate((valid) => {
      if (valid) {
        if (!importForm.value.certFile) {
          ElMessage.error('请上传证书文件');
          return;
        }
        ElMessage.warning('子CA证书导入接口暂未接入，请使用在线签发功能');
      }
    });
  }
}

const addUri = (field: 'cacertUris' | 'ocspUris') => {
  selfForm.value[field].push({ value: '' });
};

const removeUri = (field: 'cacertUris' | 'ocspUris', index: number) => {
  selfForm.value[field].splice(index, 1);
};

/** 查看详情 */
function handleView(row: any) {
  currentCertPem.value = row.pem; // 假设row中有pem字段
  showDetail.value = true;
}

/** 下载证书 */
function handleDownload(row: any) {
  // 实现下载逻辑
  const blob = new Blob([row.pem], { type: 'application/x-pem-file' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${row.name}.crt`;
  link.click();
}

const syncApprovalMode = (profileId: number | string, value: 'required' | 'optional') => {
  certList.value.forEach((root: any) => {
    (root.profiles || []).forEach((profile: any) => {
      if (String(profile.id) === String(profileId)) {
        profile.approvalMode = value;
      }
    });
  });
};

const handleApprovalChange = (row: any, value: string) => {
  if (value !== 'required' && value !== 'optional') {
    return;
  }
  const previous = row.approvalMode === 'optional' ? 'optional' : 'required';
  syncApprovalMode(row.id, value);
  savingProfileId.value = row.id;
  saveRaProfileApprovalMode(row.id, value)
    .then(() => {
      ElMessage.success('审核策略已保存，仅对后续新提交生效');
    })
    .catch(() => {
      syncApprovalMode(row.id, previous);
    })
    .finally(() => {
      savingProfileId.value = undefined;
    });
};

/** 授权模板按钮操作 */
function handleAuthorizeProfile(row: any) {
  router.push({
    path: '/ra/root/authorize-profile',
    query: { id: row.id }
  });
}

/** 启用按钮操作 */
async function handleEnable(row: any) {
  try {
    await proxy?.$modal.confirm(`确认要启用名称为 "${row.name}" 的证书吗？`);
    await enableRootCa(row.id);
    ElMessage.success('启用成功');
    getList();
  } catch (error) {}
}

/** 停用按钮操作 */
async function handleDisable(row: any) {
  try {
    await proxy?.$modal.confirm(`确认要停用名称为 "${row.name}" 的证书吗？停用后将无法使用该证书进行签发。`);
    await disableRootCa(row.id);
    ElMessage.success('停用成功');
    getList();
  } catch (error) {}
}

/** 吊销按钮操作 */
async function handleRevoke(row: any) {
  try {
    const { value: reason } = await proxy?.$modal.prompt('请输入吊销原因', '吊销根证书', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入吊销原因 (例如: keyCompromise, superseded)',
      inputValidator: (val: string) => {
        if (!val) return '原因不能为空';
      }
    });

    if (reason) {
      // 触发安全确认
      securityConfirm.action = `吊销根证书 "${row.name}" (原因: ${reason})`;
      securityConfirm.onConfirm = async () => {
        try {
          await revokeRootCa(row.id, reason);
          ElMessage.success('吊销成功');
          getList();
        } catch (error) {}
      };
      securityConfirm.visible = true;
    }
  } catch (error) {
    // 处理取消输入原因
  }
}

/** 父级CA变更处理 */
function onParentCaChange(val: any) {
  // 可以根据父级CA限制子CA的一些属性，比如算法或有效期
}

getList();
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.profile-expand {
  padding: 12px 48px 16px;
  background: #f7f9fc;
  border-top: 1px solid var(--el-border-color-lighter);
}

.profile-expand-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.profile-expand-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.profile-expand-subtitle {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.profile-table {
  background: #fff;
}

.profile-name-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.profile-name {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-empty {
  padding: 8px 0 12px;
  background: #fff;
  border: 1px dashed var(--el-border-color);
}

.profile-detail-body {
  max-height: 75vh;
  padding-right: 10px;
  overflow-y: auto;
}

.profile-detail-summary {
  margin-bottom: 16px;
}

.sync-tip {
  margin-bottom: 16px;
}

.sync-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sync-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.sync-summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 12px 16px;
  background: #f8fafc;
  border-right: 1px solid var(--el-border-color-lighter);
  gap: 12px;
}

.sync-summary-item:last-child {
  border-right: 0;
}

.sync-summary-item span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.sync-summary-item strong {
  color: var(--el-color-primary);
  font-size: 20px;
  line-height: 24px;
}

.sync-root-list {
  display: flex;
  max-height: 360px;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

.sync-root-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: #fff;
}

.sync-root-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 12px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  gap: 12px;
}

.sync-root-name {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-profile-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
  padding: 12px 14px 14px;
  list-style: none;
}

.sync-profile-item {
  min-width: 0;
  overflow: hidden;
  padding: 7px 10px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f7f9fc;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}
</style>
