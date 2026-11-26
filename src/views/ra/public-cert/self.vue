<template>
  <div class="public-cert-self">
    <div v-if="!portalReady" class="portal-login-shell">
      <section class="portal-login-brand" aria-label="平台介绍">
        <div class="portal-login-brand-header">
          <span class="portal-login-brand-logo">RA</span>
        </div>
        <div class="portal-login-visual" aria-hidden="true">
          <span class="visual-base"></span>
          <span class="visual-bar visual-bar-a"></span>
          <span class="visual-bar visual-bar-b"></span>
          <span class="visual-bar visual-bar-c"></span>
          <span class="visual-node visual-node-a"></span>
          <span class="visual-node visual-node-b"></span>
          <span class="visual-app-ra"></span>
        </div>
        <div class="portal-login-copy">
          <h1>证书统一管理</h1>
          <p>统一管理录入证书有效期</p>
        </div>
      </section>
      <section class="portal-login-panel" aria-label="登录">
        <el-form class="portal-login-form" size="large" :disabled="loginLoading" @submit.prevent="handleLogin">
          <div class="portal-login-title">
            <h2>欢迎回来</h2>
            <p>输入您的账户信息以进入统一证书管理</p>
          </div>
          <div class="portal-login-mode"><el-icon><User /></el-icon>账号登录</div>
          <el-form-item>
            <el-input model-value="证书统一管理" :prefix-icon="OfficeBuilding" aria-label="当前系统" disabled readonly />
          </el-form-item>
          <el-form-item>
            <el-input id="portal-domain-account" v-model="loginAccount" :prefix-icon="User" clearable autocomplete="username"
              aria-label="域账号" placeholder="请输入域账号" />
          </el-form-item>
          <el-button type="primary" native-type="submit" :loading="loginLoading" class="login-button">登录</el-button>
        </el-form>
      </section>
    </div>

    <ManagementFrame v-else class="portal-workspace" :class="{ hideSidebar: !portalSidebarVisible, openSidebar: portalSidebarVisible }" :sidebar-hidden="compactLedger" :has-tags-view="true">
      <template #navigation>
        <aside v-if="!compactLedger" class="sidebar-container portal-sidebar">
          <div class="portal-brand"><span class="portal-logo">RA</span><h1 v-if="portalSidebarVisible">证书统一管理</h1></div>
          <el-menu v-if="access.granted" :default-active="portalSection" :collapse="!portalSidebarVisible" class="portal-menu" aria-label="证书统一管理菜单" @select="changePortalSection">
            <el-menu-item index="records"><el-icon><Document /></el-icon><span>录入信息</span></el-menu-item>
            <el-menu-item index="todo"><el-icon><List /></el-icon><span>待办详情</span></el-menu-item>
          </el-menu>
        </aside>
      </template>
      <template #header>
        <header class="portal-navbar">
          <el-button text class="portal-menu-toggle" aria-label="切换菜单" :icon="Menu" @click="compactLedger ? (portalMobileMenuOpen = true) : (portalSidebarVisible = !portalSidebarVisible)" />
          <h1 v-if="compactLedger" class="portal-mobile-title">证书统一管理</h1>
          <el-breadcrumb v-if="access.granted" separator="/" aria-label="当前位置">
            <el-breadcrumb-item>证书统一管理</el-breadcrumb-item>
            <el-breadcrumb-item>{{ sectionTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
          <el-dropdown trigger="click" @command="handleAccountCommand">
            <el-button text class="portal-account" aria-label="账户菜单" :title="access.domainAccount || undefined">
              <span class="portal-avatar"><el-icon><User /></el-icon></span>
              <span class="portal-account-text">
                <span class="portal-account-name">{{ access.employeeName || access.domainAccount || '员工账号' }}</span>
                <span v-if="access.employeeName && access.domainAccount && access.employeeName !== access.domainAccount" class="portal-account-id">
                  {{ access.domainAccount }}
                </span>
              </span>
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="SwitchButton" command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </header>
        <nav v-if="access.granted" class="portal-tabs" aria-label="当前页面">
          <span class="portal-tab is-active">{{ sectionTitle }}</span>
        </nav>
      </template>

        <main class="portal-content">
          <el-alert v-if="!access.granted" title="当前账号未开通证书录入权限，请联系证书管理员授权。" type="warning" show-icon :closable="false" />
          <template v-else>
            <div class="portal-heading">
              <div class="portal-heading-title">
                <span class="portal-heading-icon"><el-icon><component :is="portalSection === 'todo' ? List : Document" /></el-icon></span>
                <h2>{{ portalSection === 'todo' ? '待办详情' : '证书录入' }}</h2>
              </div>
            <el-button
              v-if="portalSection === 'records'"
              type="primary"
              icon="Plus"
              class="portal-primary-action"
              :disabled="saving"
              @click="openCreate"
              >新增录入</el-button
            >
            </div>
            <section class="portal-ledger" :aria-label="sectionTitle">
              <div class="portal-ledger-heading">
                <h3>{{ portalSection === 'todo' ? '待处理记录' : '录入记录' }}</h3>
                <el-tag class="portal-count" type="info" effect="plain" round>共 {{ total }} 条</el-tag>
              </div>
              <el-form :model="queryParams" label-position="top" class="portal-query" @submit.prevent="handleQuery">
                <el-form-item label="域名" prop="domainName">
                  <el-input v-model="queryParams.domainName" clearable placeholder="请输入域名" />
                </el-form-item>
                <el-form-item v-if="portalSection === 'todo'" label="审核结果">
                  <el-select v-model="queryParams.approvalStatus" clearable placeholder="全部">
                    <el-option label="审核中" value="PENDING" />
                    <el-option label="已驳回" value="REJECTED" />
                  </el-select>
                </el-form-item>
                <el-form-item v-else label="证书状态">
                  <el-select v-model="queryParams.certStatus" clearable placeholder="全部">
                    <el-option label="正常" value="NORMAL" />
                    <el-option label="30天内过期" value="EXPIRING" />
                    <el-option label="已过期" value="EXPIRED" />
                  </el-select>
                </el-form-item>
                <div class="portal-query-actions">
                  <el-button type="primary" plain icon="Search" native-type="submit">搜索</el-button>
                  <el-button icon="Refresh" @click="resetQuery">重置</el-button>
                </div>
              </el-form>
              <el-table v-loading="loading" :data="rows" class="portal-record-table" :empty-text="portalSection === 'todo' ? '暂无待办记录' : '暂无证书记录'">
                <el-table-column label="域名" prop="domainName" min-width="155" show-overflow-tooltip />
                <el-table-column label="审核结果" width="105">
                  <template #default="{ row }"><el-tag :type="approvalType(row.approvalStatus)" effect="light">{{ row.approvalStatus === 'PENDING' ? '审核中' : approvalLabel(row) }}</el-tag></template>
                </el-table-column>
                <el-table-column label="证书类型" prop="certTypeName" width="105" />
                <el-table-column label="证书状态" width="116">
                  <template #default="{ row }"><el-tag :type="businessCertificateValidity(row.notAfter, 365).type" effect="light">{{ businessCertificateValidity(row.notAfter, 365).text }}</el-tag></template>
                </el-table-column>
                <el-table-column label="到期时间" width="165">
                  <template #default="{ row }">{{ formatDateTime(row.notAfter) }}</template>
                </el-table-column>
                <el-table-column label="操作" :width="compactLedger ? 94 : 120" align="center" fixed="right">
                  <template #default="{ row }">
                    <div class="portal-row-actions">
                      <el-tooltip content="详情" placement="top">
                        <el-button link type="primary" icon="View" aria-label="详情" @click="openDetail(row)" />
                      </el-tooltip>
                      <el-tooltip v-if="row.approvalStatus !== 'PENDING'" content="修改" placement="top">
                        <el-button link type="primary" icon="Edit" aria-label="修改" @click="openEdit(row)" />
                      </el-tooltip>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="total > 0" class="portal-ledger-footer">
                <pagination v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" :auto-scroll="false" @pagination="loadList" />
              </div>
            </section>
          </template>
        </main>
    </ManagementFrame>

    <el-drawer v-model="portalMobileMenuOpen" title="证书统一管理" direction="ltr" size="min(260px, 80vw)" append-to-body>
      <el-menu :default-active="portalSection" aria-label="移动端菜单" @select="changePortalSectionFromMobile">
        <el-menu-item index="records"><el-icon><Document /></el-icon>录入信息</el-menu-item>
        <el-menu-item index="todo"><el-icon><List /></el-icon>待办详情</el-menu-item>
      </el-menu>
    </el-drawer>

    <el-drawer v-model="formOpen" :title="form.id ? '修改证书录入' : '新增证书录入'" size="min(1040px, 100vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" append-to-body>
      <el-alert v-if="form.approvalStatus === 'REJECTED'" class="portal-review-alert" type="error" title="驳回原因" :closable="false" show-icon>
        <span class="portal-review-message">{{ approvalOpinion(form) }}</span>
      </el-alert>
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="saving" label-width="116px">
        <el-divider content-position="left">证书信息</el-divider>
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12">
            <el-form-item label="证书类型" prop="certTypeId">
              <el-select v-model="form.certTypeId" placeholder="请选择证书类型" style="width: 100%" @change="onTypeChange">
                <el-option v-for="item in types" :key="String(item.id)" :label="item.typeName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="域名" prop="domainName" :required="domainRequired">
              <el-input v-model="form.domainName" type="textarea" :rows="3" maxlength="500" placeholder="多个域名按行填写" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12">
            <el-form-item label="证书序列号">
              <el-input v-model="form.serialNumber" clearable placeholder="可后续补录" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="颁发机构" prop="issuer">
              <el-input v-model="form.issuer" clearable placeholder="证书颁发机构" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12">
            <el-form-item label="供应商" prop="vendor">
              <el-input v-model="form.vendor" clearable placeholder="证书供应商" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="生效时间" prop="notBefore">
              <el-date-picker v-model="form.notBefore" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择生效时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="有效期止" prop="notAfter">
              <el-date-picker
                v-model="form.notAfter"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择到期时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">证书维护人</el-divider>
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12"><el-form-item label="证书维护人"><el-input v-model="form.businessOwnerName" readonly /></el-form-item></el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="科室"><el-input v-model="form.departmentName" readonly /></el-form-item></el-col>
        </el-row>
        <el-divider content-position="left">使用详情</el-divider>
        <el-form-item prop="usages" label-width="0"><UsageTable v-model="form.usages" :lookup="lookupEmployees" /></el-form-item>
        <el-divider content-position="left">附件</el-divider>
        <el-form-item label="压缩包">
          <el-upload v-model:file-list="pendingAttachments" :auto-upload="false" accept=".zip,.rar" multiple
            :on-change="(file) => { if (file.raw && !beforeUpload(file.raw)) pendingAttachments = pendingAttachments.filter((item) => item.uid !== file.uid); }">
            <el-button icon="Upload">上传证书</el-button>
            <template #tip><div class="el-upload__tip">{{ attachmentTip }}</div></template>
          </el-upload>
        </el-form-item>
        <el-form-item v-if="formAttachments.length" label="已有附件">{{ formAttachments.map((item) => item.originalName).join('；') }}</el-form-item>
      </el-form>
      <template #footer>
        <div class="portal-editor-footer">
          <div class="portal-editor-actions">
            <el-button :disabled="saving" @click="formOpen = false">取消</el-button>
            <el-button type="success" :loading="saving" @click="submitForm">提交</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <el-drawer v-model="detailOpen" title="证书详情" size="min(620px, 100vw)" append-to-body>
      <el-alert v-if="detail.cert" class="portal-review-alert" :type="reviewAlertType(detail.cert.approvalStatus)"
        :title="'审核结果：' + approvalLabel(detail.cert)" :closable="false" show-icon>
        <span v-if="approvalOpinion(detail.cert)" class="portal-review-message">
          {{ detail.cert.approvalStatus === 'REJECTED' ? '驳回原因：' : '审核意见：' }}{{ approvalOpinion(detail.cert) }}
        </span>
      </el-alert>
      <el-divider content-position="left">证书信息</el-divider>
      <el-descriptions :column="1" :label-width="108" border class="portal-detail-fields">
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域名"><span class="portal-detail-multiline">{{ detail.cert?.domainName || '-' }}</span></el-descriptions-item>
        <el-descriptions-item label="证书序列号">{{ detail.cert?.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发机构">{{ detail.cert?.issuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ detail.cert?.vendor || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期止">{{ detail.cert?.notAfter || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书状态">{{ businessCertificateValidity(detail.cert?.notAfter, 365).text }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">证书维护人</el-divider>
      <el-descriptions :column="1" :label-width="108" border class="portal-detail-fields">
        <el-descriptions-item label="证书维护人">{{ detail.cert?.businessOwnerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维护人邮箱">{{ detail.cert?.businessOwnerEmail || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ detail.cert?.departmentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维护人账号">{{ detail.cert?.businessOwnerAccount || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">使用详情</el-divider>
      <el-table :data="detail.usages || []" border size="small">
        <el-table-column label="使用系统" prop="systemName" min-width="130" />
        <el-table-column label="系统负责人" prop="businessOwnerName" min-width="120" />
        <el-table-column label="使用域名" prop="usageDomain" min-width="150"><template #default="{ row }"><span class="portal-detail-multiline">{{ row.usageDomain || '-' }}</span></template></el-table-column>
        <el-table-column label="使用场景" prop="usageScene" min-width="160" />
      </el-table>
      <el-divider content-position="left">附件</el-divider>

      <el-table :data="detail.attachments || []" border size="small" class="mt12">
        <el-table-column label="文件名" prop="originalName" min-width="220">
          <template #default="{ row }"><el-button link type="primary" @click="downloadAttachment(row)">{{ row.originalName }}</el-button></template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ fileSize(row.fileSize) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="portal-editor-footer">
          <template v-if="lastModification">
            <span class="portal-recorder">修改人：{{ lastModification.operatorName || '-' }}</span>
            <span class="portal-recorder">修改时间：{{ formatDateTime(lastModification.createTime) }}</span>
          </template>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup name="RaPublicCertSelf" lang="ts">
import { ElMessage, ElMessageBox, FormInstance, FormRules, type UploadUserFile } from 'element-plus';
import { ArrowDown, Document, List, Menu, OfficeBuilding, SwitchButton, User } from '@element-plus/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import ManagementFrame from '@/layout/components/ManagementFrame.vue';
import { PublicCert, PublicCertAttachment, PublicCertDetail, PublicCertQuery, PublicCertType, SelfAccess } from '@/api/ra/publicCert';
import UsageTable from './UsageTable.vue';
import { businessCertificateValidity } from '@/utils/businessCertificateNotice';
import { publicCertDomainRequired, publicCertUsageError, publicCertEditValues, selectCertificateMaintainer, effectivePortalIdleMinutes } from '@/utils/publicCertForm';
import {
  completePublicCertPortalIam,
  getPublicCertPortal,
  getPublicCertPortalAccess,
  listPublicCertPortalTypes,
  loginPublicCertPortal,
  logoutPublicCertPortal,
  pagePublicCertPortal,
  PortalLoginResult,
  saveAndSubmitPublicCertPortal,
  searchPublicCertPortalEmployees,
  startPublicCertPortalIam,
  downloadPublicCertPortalAttachment
} from '@/api/ra/publicCertPortal';

const portalStorageKey = 'fawvw-public-cert-portal-token';
const route = useRoute();
const router = useRouter();
const portalToken = ref(sessionStorage.getItem(portalStorageKey) || '');
const portalReady = ref(false);
const portalSection = ref<'records' | 'todo'>('records');
const portalSidebarVisible = ref(true);
const portalMobileMenuOpen = ref(false);
const sectionTitle = computed(() => (portalSection.value === 'todo' ? '待办详情' : '录入信息'));
const compactLedger = useMediaQuery('(max-width: 960px)');
const loginAccount = ref('');
const loginLoading = ref(false);
let lastInteraction = Date.now();
let lastHeartbeat = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let heartbeatBusy = false;
let listVersion = 0;

const access = ref<SelfAccess>({ granted: false });
const idleMinutes = computed(() => effectivePortalIdleMinutes(access.value.idleMinutes));
const rows = ref<PublicCert[]>([]);
const total = ref(0);
const loading = ref(false);
const formOpen = ref(false);
const detailOpen = ref(false);
const saving = ref(false);
const pendingAttachments = ref<UploadUserFile[]>([]);
const formAttachments = ref<PublicCertAttachment[]>([]);
const formRef = ref<FormInstance>();
const types = ref<PublicCertType[]>([]);
const domainRequired = computed(() => (types.value.find((item) => String(item.id) === String(form.certTypeId))?.domainRequired ?? publicCertDomainRequired(types.value.find((item) => String(item.id) === String(form.certTypeId))?.typeCode)));
const detail = ref<Partial<PublicCertDetail>>({ usages: [], attachments: [], auditLogs: [] });
const lastModification = computed(() => detail.value.auditLogs?.find((log) => log.action === 'UPDATE'));

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
  notBefore: '',
  notAfter: '',
  businessOwnerName: access.value.employeeName || '',
  businessOwnerAccount: access.value.domainAccount || '',
  usages: [{ systemName: '', usageDomain: '', usageScene: '' }]
});

const form = reactive<PublicCert>(emptyForm());
const attachmentTip = '请将证书打包为 ZIP 或 RAR 压缩包上传，文件大小不得超过 20 MB。';
const rules: FormRules = {
  notBefore: [{ required: true, message: '请选择生效时间', trigger: 'change' }],
  certTypeId: [{ required: true, message: '请选择证书类型', trigger: 'change' }],
  domainName: [{ validator: (_rule, value, done) => {
    const type = types.value.find((item) => String(item.id) === String(form.certTypeId));
    done((type?.domainRequired ?? publicCertDomainRequired(type?.typeCode)) && !value?.trim() ? new Error('该证书类型必须填写域名') : undefined);
  }, trigger: 'blur' }],
  issuer: [{ required: true, whitespace: true, message: '请输入颁发机构', trigger: 'blur' }],
  vendor: [{ required: true, whitespace: true, message: '请输入供应商', trigger: 'blur' }],
  businessOwnerEmployeeId: [{ required: true, message: '请选择证书维护人', trigger: 'change' }],
  usages: [{ validator: (_rule, value, done) => { const error = publicCertUsageError(value); done(error ? new Error(error) : undefined); }, trigger: 'change' }],
  notAfter: [{ required: true, message: '请选择到期时间', trigger: 'change' }]
};

async function loadAccess() {
  const token = portalToken.value;
  const result = await getPublicCertPortalAccess(token);
  if (token === portalToken.value) access.value = result;
}

async function loadTypes() {
  const token = portalToken.value;
  const result = await listPublicCertPortalTypes(token);
  if (token === portalToken.value) types.value = result || [];
}

async function loadList(): Promise<void> {
  if (!access.value.granted) return;
  const token = portalToken.value;
  const version = ++listVersion;
  loading.value = true;
  try {
    const approvalStatus = queryParams.approvalStatus || (portalSection.value === 'todo' ? 'TODO' : 'RECORDS');
    const query = { ...queryParams, approvalStatus };
    const page = await pagePublicCertPortal(token, query);
    if (version !== listVersion || token !== portalToken.value || !portalReady.value) return;
    const nextTotal = Number(page.total || 0);
    const lastPage = Math.max(1, Math.ceil(nextTotal / query.pageSize));
    if (query.pageNum > lastPage) {
      queryParams.pageNum = lastPage;
      if (nextTotal > 0) {
        await loadList();
        return;
      }
    }
    rows.value = page.records || page.rows || [];
    total.value = nextTotal;
  } catch (error: any) {
    if (version === listVersion && token === portalToken.value && portalReady.value) ElMessage.error(error?.message || '查询失败，请重试');
  } finally {
    if (version === listVersion) loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}

function resetQuery() {
  queryParams.domainName = '';
  queryParams.certStatus = '';
  queryParams.approvalStatus = '';
  handleQuery();
}

function resetForm() {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
  Object.assign(form, emptyForm());
  pendingAttachments.value = [];
  formAttachments.value = [];
  formRef.value?.clearValidate();
}

async function openCreate() {
  const token = portalToken.value;
  try {
    const account = access.value.domainAccount || '';
    const [employees] = await Promise.all([lookupEmployees(account), loadTypes()]);
    if (token !== portalToken.value || !portalReady.value) return;
    const current = employees.find((employee) => employee.domainAccount.toLowerCase() === account.toLowerCase());
    resetForm();
    if (current) selectCertificateMaintainer(form, current);
    formOpen.value = true;
  } catch (error: any) {
    if (token === portalToken.value && portalReady.value) ElMessage.error(error?.message || '录入信息加载失败');
  }
}

async function openEdit(row: PublicCert) {
  const token = portalToken.value;
  try {
    await loadTypes();
    const data = await getPublicCertPortal(token, row.id!);
    if (token !== portalToken.value || !portalReady.value) return;
    resetForm();
    Object.assign(form, publicCertEditValues(data));
    const account = access.value.domainAccount || '';
    const employees = await lookupEmployees(account);
    if (token !== portalToken.value || !portalReady.value) return;
    const current = employees.find((employee) => employee.domainAccount.toLowerCase() === account.toLowerCase());
    if (current) selectCertificateMaintainer(form, current);
    formAttachments.value = data.attachments || [];
    formOpen.value = true;
  } catch (error: any) {
    if (token === portalToken.value && portalReady.value) ElMessage.error(error?.message || '录入信息加载失败');
  }
}

async function openDetail(row: PublicCert) {
  const token = portalToken.value;
  try {
    const data = await getPublicCertPortal(token, row.id!);
    if (token !== portalToken.value || !portalReady.value) return;
    detail.value = data;
    detailOpen.value = true;
  } catch (error: any) {
    if (token === portalToken.value && portalReady.value) ElMessage.error(error?.message || '详情加载失败');
  }
}

async function submitForm() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  if (saving.value || pendingAttachments.value.some((file) => !file.raw || !beforeUpload(file.raw))) return;
  saving.value = true;
  const token = portalToken.value;
  try {
    await saveAndSubmitPublicCertPortal(token, form, pendingAttachments.value.map((file) => file.raw!));
    if (token !== portalToken.value || !portalReady.value) return;
    ElMessage.success('已提交审核');
    formOpen.value = false;
    changePortalSection('todo');
  } catch (error: any) {
    if (token === portalToken.value && portalReady.value) ElMessage.error(error?.message || '提交失败，已保留当前录入内容，请重试');
  } finally {
    saving.value = false;
  }
}

function changePortalSection(value: string) {
  portalSection.value = value === 'todo' ? 'todo' : 'records';
  queryParams.approvalStatus = '';
  queryParams.certStatus = '';
  rows.value = [];
  total.value = 0;
  handleQuery();
}

function changePortalSectionFromMobile(value: string) {
  portalMobileMenuOpen.value = false;
  changePortalSection(value);
}

function onTypeChange(value: string | number) {
  const type = types.value.find((item) => String(item.id) === String(value));
  form.certTypeName = type?.typeName || '';
  formRef.value?.clearValidate('domainName');
}

function lookupEmployees(keyword: string) {
  return searchPublicCertPortalEmployees(portalToken.value, keyword);
}

function beforeUpload(file: File) {
  if (!/\.(zip|rar)$/i.test(file.name)) {
    ElMessage.warning('附件仅支持 zip 或 rar');
    return false;
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    ElMessage.warning('附件不能为空，且不能超过 20MB');
    return false;
  }
  return true;
}

async function downloadAttachment(attachment: PublicCertAttachment) {
  const id = detail.value.cert?.id;
  if (id == null) return;
  const token = portalToken.value;
  const blob = await downloadPublicCertPortalAttachment(token, id, attachment.id);
  if (token !== portalToken.value || !portalReady.value) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.originalName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function approvalType(status?: string) {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'info';
}

const approvalLabels: Record<string, string> = { DRAFT: '草稿', PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' };

function approvalLabel(cert: PublicCert) {
  return cert.approvalStatusName || approvalLabels[cert.approvalStatus || ''] || '-';
}

function approvalOpinion(cert: PublicCert) {
  if (cert.approvalStatus === 'REJECTED') return cert.approvalComment?.trim() || '未填写驳回原因';
  return cert.approvalStatus === 'APPROVED' ? cert.approvalComment?.trim() || '' : '';
}

function reviewAlertType(status?: string) {
  const type = approvalType(status);
  return type === 'danger' ? 'error' : type;
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ') : '-';
}

function fileSize(value?: number) {
  if (!value) return '0B';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function portalCallbackUri() {
  return `${window.location.origin}/ra-public-cert`;
}

async function applyPortalLogin(result: PortalLoginResult) {
  portalToken.value = result.token;
  sessionStorage.setItem(portalStorageKey, result.token);
  access.value = result.access;
  portalReady.value = true;
  startIdleTimer();
  await loadTypes();
  await loadList();
}

async function handleIamCallback(code: string, state: string) {
  loginLoading.value = true;
  try {
    const result = await completePublicCertPortalIam(code, state);
    await router.replace({ path: '/ra-public-cert' });
    await applyPortalLogin(result);
  } catch (error: any) {
    portalToken.value = '';
    sessionStorage.removeItem(portalStorageKey);
    portalReady.value = false;
    await router.replace({ path: '/ra-public-cert' });
    ElMessage.error(error?.message || 'IAM认证失败，请重新登录');
  } finally {
    loginLoading.value = false;
  }
}

async function initialisePortal() {
  const code = route.query.code;
  const state = route.query.state;
  if (typeof code === 'string' && typeof state === 'string') {
    await handleIamCallback(code, state);
    return;
  }
  if (!portalToken.value) return;
  const token = portalToken.value;
  try {
    await loadAccess();
    if (token !== portalToken.value) return;
    portalReady.value = true;
    startIdleTimer();
    await loadTypes();
    await loadList();
  } catch (error: any) {
    portalToken.value = '';
    sessionStorage.removeItem(portalStorageKey);
    portalReady.value = false;
  }
}

async function handleLogin() {
  if (loginLoading.value) return;
  if (!loginAccount.value.trim()) {
    ElMessage.warning('请输入域账号');
    return;
  }
  loginLoading.value = true;
  try {
    const iamStart = await startPublicCertPortalIam(loginAccount.value.trim(), portalCallbackUri());
    if (iamStart.iamEnabled && iamStart.authorizeUrl) {
      window.location.href = iamStart.authorizeUrl;
      return;
    }
    const result = iamStart.loginResult || (await loginPublicCertPortal(loginAccount.value.trim()));
    await applyPortalLogin(result);
  } catch (error: any) {
    ElMessage.error(error?.message || '身份认证失败');
  } finally {
    loginLoading.value = false;
  }
}

async function handleLogout() {
  const token = portalToken.value;
  resetPortal();
  try {
    if (token) await logoutPublicCertPortal(token);
  } catch {
    // The local session still needs to be cleared after a network failure.
  }
}

function resetPortal() {
  listVersion++;
  loading.value = false;
  if (idleTimer) clearTimeout(idleTimer);
  portalToken.value = '';
  portalReady.value = false;
  portalSection.value = 'records';
  portalMobileMenuOpen.value = false;
  queryParams.approvalStatus = '';
  queryParams.pageNum = 1;
  formOpen.value = false;
  detailOpen.value = false;
  rows.value = [];
  total.value = 0;
  access.value = { granted: false };
  sessionStorage.removeItem(portalStorageKey);
}

function recordActivity() {
  if (!portalReady.value) return;
  if (Date.now() - lastInteraction >= portalIdleMs()) {
    expireIdleSession();
    return;
  }
  startIdleTimer();
}

function startIdleTimer() {
  lastInteraction = Date.now();
  scheduleIdleTimeout();
}

function handleAccountCommand(command: string) {
  if (command === 'logout') void handleLogout();
}

function portalIdleMs() {
  return idleMinutes.value * 60_000;
}

function expireIdleSession() {
  if (!portalReady.value) return;
  void handleLogout();
  ElMessage.warning('登录空闲超时，请重新认证');
}

function scheduleIdleTimeout() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!portalReady.value) return;
  idleTimer = setTimeout(expireIdleSession, Math.max(0, lastInteraction + portalIdleMs() - Date.now()));
}

watch(idleMinutes, scheduleIdleTimeout);

function onSessionExpired(event: Event) {
  if (!portalReady.value || (event as CustomEvent<{ token?: string }>).detail?.token !== portalToken.value) return;
  resetPortal();
  ElMessage.warning('登录已失效，请重新认证');
}

const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
onMounted(() => {
  activityEvents.forEach((name) => window.addEventListener(name, recordActivity, { passive: true }));
  window.addEventListener('fawvw-portal-expired', onSessionExpired);
  heartbeatTimer = setInterval(async () => {
    if (!portalReady.value || heartbeatBusy || lastInteraction <= lastHeartbeat) return;
    heartbeatBusy = true;
    lastHeartbeat = lastInteraction;
    try { await loadAccess(); } catch { /* Expired sessions are handled by the portal client. */ }
    finally { heartbeatBusy = false; }
  }, 60_000);
  initialisePortal();
});
onUnmounted(() => {
  activityEvents.forEach((name) => window.removeEventListener(name, recordActivity));
  window.removeEventListener('fawvw-portal-expired', onSessionExpired);
  if (idleTimer) clearTimeout(idleTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});
</script>

<style scoped lang="scss">
.public-cert-self {
  --portal-navy: #1d3557;
  --portal-muted: #526779;
  --portal-accent: #2b647e;
  --portal-tint: #eaf4f5;
  --portal-action: linear-gradient(135deg, #1b756d, #326886);
  --portal-canvas: #f4f7fa;

  min-height: 100dvh;
  background: var(--el-fill-color-light);
}

:global(html.dark .public-cert-self) {
  --portal-navy: #dce9f4;
  --portal-muted: #adbecd;
  --portal-accent: #9ed0e9;
  --portal-tint: #20363b;
  --portal-canvas: var(--el-bg-color-page);
}

.portal-login-shell {
  display: grid;
  grid-template-columns: minmax(420px, 58%) minmax(360px, 42%);
  min-height: 100dvh;
  background: #fff;
}

.portal-login-brand {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 32px 48px 86px;
  overflow: hidden;
  background: radial-gradient(circle at 72% 24%, rgba(245, 158, 11, 0.18), transparent 31%),
    linear-gradient(135deg, #fffdf7 0%, #fff2df 48%, #eaf0fb 100%);
}

.portal-login-brand::before {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.58), transparent 46%),
    radial-gradient(circle at 34% 54%, rgba(0, 122, 255, 0.1), transparent 34%);
}

.portal-login-brand-header {
  position: absolute;
  top: 24px;
  left: 28px;
  z-index: 1;
}

.portal-login-brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 2px solid #f7a928;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.74);
  color: #c26a03;
  font-size: 12px;
  font-weight: 800;
}

.portal-login-visual {
  position: relative;
  z-index: 1;
  width: min(380px, 72vw);
  height: 300px;
  margin-top: 14px;
  filter: drop-shadow(0 26px 32px rgba(37, 99, 235, 0.18));

  .visual-base,
  .visual-bar,
  .visual-node,
  .visual-app-ra {
    position: absolute;
    display: block;
  }

  .visual-base {
    left: 68px;
    bottom: 28px;
    width: 244px;
    height: 126px;
    border-radius: 18px;
    background: linear-gradient(145deg, #f6a723, #2869df);
    transform: skewY(-24deg) rotate(24deg);
    box-shadow: 0 16px 0 #bd6a10, 0 28px 36px rgba(191, 106, 16, 0.18);
  }

  .visual-bar {
    bottom: 92px;
    width: 20px;
    border-radius: 6px 6px 2px 2px;
    background: linear-gradient(180deg, #ffd071, #e38a13);
  }

  .visual-bar-a { left: 96px; height: 48px; }
  .visual-bar-b { left: 126px; height: 72px; }
  .visual-bar-c { left: 156px; height: 38px; }

  .visual-node {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(145deg, #7868ff, #1d77ff);
    box-shadow: 0 10px 18px rgba(53, 93, 218, 0.22);
  }

  .visual-node-a { left: 64px; top: 90px; }
  .visual-node-b { right: 124px; bottom: 46px; }

  .visual-app-ra {
    left: 108px;
    top: 58px;
    width: 168px;
    height: 132px;
  }

  .visual-app-ra::before {
    position: absolute;
    left: 4px;
    top: 15px;
    width: 64px;
    height: 78px;
    content: '';
    border-radius: 10px;
    background: radial-gradient(circle at 50% 30%, #f8b84e 0 18%, transparent 19%), linear-gradient(180deg, #fff, #fff4dc);
    box-shadow: 92px 0 0 #fff, 92px 0 0 1px rgba(245, 158, 11, 0.2), 0 13px 0 #d07812,
      92px 13px 0 #d07812, 0 24px 28px rgba(191, 106, 16, 0.16);
  }

  .visual-app-ra::after {
    position: absolute;
    left: 70px;
    top: 45px;
    width: 50px;
    height: 18px;
    content: '';
    border-top: 6px solid #f6a723;
    border-right: 6px solid #f6a723;
    transform: skewX(-20deg);
    box-shadow: 17px -10px 0 -6px #f6a723, 17px 10px 0 -6px #f6a723;
  }
}

.portal-login-copy {
  position: relative;
  z-index: 1;
  margin-top: 12px;
  text-align: center;

  h1 {
    margin: 0;
    color: #344054;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.35;
  }

  p {
    margin: 10px 0 0;
    color: #667085;
    font-size: 14px;
    line-height: 1.6;
  }
}

.portal-login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 72px 56px 84px;
  background: #fff;
}

.portal-login-form {
  width: min(388px, 100%);

  :deep(.el-form-item) { margin-bottom: 14px; }

  :deep(.el-input__wrapper) {
    min-height: 42px;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 0 0 1px #e5e9f0 inset;
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px #1684fc inset, 0 0 0 3px rgba(22, 132, 252, 0.1);
  }
}

.portal-login-title {
  margin-bottom: 18px;

  h2 {
    margin: 0 0 8px;
    color: #202631;
    font-size: 30px;
    font-weight: 800;
    line-height: 1.25;
  }

  p {
    margin: 0;
    color: #8a94a6;
    font-size: 13px;
    line-height: 1.6;
  }
}

.portal-login-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  margin-bottom: 18px;
  border: 1px solid #b9dcff;
  border-radius: 6px;
  background: #f5faff;
  color: #0b7ff3;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 0 0 3px rgba(11, 127, 243, 0.08);
}

.login-button {
  width: 100%;
  min-height: 42px;
  margin-top: 10px;
  border-radius: 6px;
  background: #0878e8;
  box-shadow: 0 10px 20px rgba(8, 120, 232, 0.18);
  font-weight: 600;
  --el-button-bg-color: #0878e8;
  --el-button-border-color: #0878e8;
  --el-button-hover-bg-color: #0b84ff;
  --el-button-hover-border-color: #0b84ff;
}

.portal-primary-action {
  --el-button-bg-color: #326886;
  --el-button-border-color: #326886;
  --el-button-hover-bg-color: #285976;
  --el-button-hover-border-color: #285976;

  border-radius: 999px;
  font-weight: 700;

  &:not(.is-disabled) {
    background: var(--portal-action);
    box-shadow: 0 6px 16px rgb(27 117 109 / 20%);
  }

  &:not(.is-disabled):hover {
    background: var(--el-button-hover-bg-color);
  }
}

.portal-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;

  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }
}

.portal-logo {
  display: grid;
  flex: 0 0 34px;
  place-items: center;
  height: 26px;
  border-radius: 6px;
  background: var(--portal-action);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.portal-workspace {
  min-height: 100dvh;
  background: var(--portal-canvas);

  :deep(.main-container) {
    min-height: 100dvh;
  }
}

:global(#app .portal-sidebar.sidebar-container) {
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  box-shadow: none;
}

:global(#app .portal-sidebar .el-menu-item.is-active) {
  color: var(--portal-accent);
  font-weight: 700;
}

.portal-sidebar {
  --el-menu-active-color: var(--portal-tint);

  :deep(.el-menu) {
    background: transparent;
  }

  :deep(.el-menu-item) {
    height: 44px;
    margin: 4px 8px;
    border-radius: 8px;
    color: var(--el-text-color-primary);
  }
}

.portal-workspace.hideSidebar .portal-brand {
  justify-content: center;
  padding: 0;
}

.portal-workspace.hideSidebar .portal-menu :deep(.el-menu-item) {
  display: flex;
  justify-content: center;
  padding: 0 !important;
}

.portal-menu {
  :deep(.el-menu-item) {
    font-size: 14px;
  }
}

.portal-navbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 50px;
  padding: 0 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);

  :deep(.el-dropdown) {
    min-width: 0;
    margin-left: auto;
  }
}

.portal-menu-toggle {
  flex: none;
  width: 38px;
  height: 40px;
  padding: 0;
  font-size: 18px;
}

.portal-mobile-title {
  overflow: hidden;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-tabs {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 14px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.portal-tab {
  min-width: 74px;
  height: 26px;
  padding: 3px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--portal-tint);
  color: var(--portal-accent);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.portal-account {
  max-width: 100%;
  height: auto;
  min-height: 36px;
  padding: 2px 8px;

  :deep(> span) {
    min-width: 0;
    gap: 6px;
  }

  .el-icon {
    flex: none;
  }
}

.portal-account-text {
  display: grid;
  min-width: 0;
  max-width: 176px;
  gap: 2px;
  text-align: left;
}

.portal-account-name,
.portal-account-id {
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 16px;
}

.portal-account-name {
  font-weight: 600;
}

.portal-account-id {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.portal-avatar,
.portal-heading-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--portal-tint);
  color: var(--portal-accent);
}

.portal-heading-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--portal-action);
  color: #fff;
  font-size: 22px;
}

.portal-content {
  width: 100%;
  max-width: 1420px;
  margin-inline: auto;
  padding: 24px;
}

.portal-heading,
.portal-heading-title,
.portal-ledger-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.portal-heading {
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 18px;

  h2 {
    margin: 0;
    color: var(--portal-navy);
    font-size: clamp(21px, 3vw, 30px);
    font-weight: 800;
    line-height: 1.3;
  }
}

.portal-ledger {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.portal-query {
  padding: 14px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;

  :deep(.el-form-item) {
    flex: 1 1 132px;
    max-width: 240px;
    min-width: 0;
    margin: 0;
  }

  :deep(.el-select) {
    width: 100%;
  }

  :deep(.el-form-item__label) {
    margin-bottom: 4px;
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
  }
}

.portal-query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  :deep(.el-button--primary.is-plain) {
    --el-button-text-color: var(--portal-accent);
    --el-button-bg-color: var(--portal-tint);
    --el-button-border-color: var(--el-border-color);
    --el-button-hover-bg-color: #326886;
    --el-button-hover-border-color: #326886;
  }

  :deep(.el-button + .el-button) {
    margin-inline-start: 0;
  }
}

.portal-ledger-heading {
  min-height: 52px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--el-border-color-light);

  h3 {
    margin: 0;
    color: var(--portal-navy);
    font-size: 16px;
    font-weight: 700;
  }
}

.portal-count {
  margin-left: auto;
  border-color: var(--el-border-color-light);
  background: var(--portal-tint);
  color: var(--portal-accent);
  font-variant-numeric: tabular-nums;
}

.portal-ledger-footer {
  display: flow-root;
  min-height: 48px;
  padding: 8px 16px;
}

.portal-record-table {
  --el-table-header-bg-color: var(--portal-tint);
  --el-table-row-hover-bg-color: var(--el-fill-color-extra-light);
  width: 100%;

  :deep(.el-table__header th.el-table__cell) {
    color: var(--portal-navy);
    font-size: 13px;
    font-weight: 700;
  }
}

.portal-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  :deep(.el-button) {
    min-width: 26px;
    min-height: 28px;
  }

  :deep(.el-button + .el-button) {
    margin-inline-start: 0;
  }
}

.portal-expiry-time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.portal-review-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.portal-review-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  gap: 5px 8px;
}

.portal-review-domain {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.portal-review-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.portal-review-preview {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;

  &.is-rejected {
    padding: 0;
    border: 0;
    background: none;
    color: var(--el-color-danger-dark-2);
    font: inherit;
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }

  &.is-approved {
    color: var(--el-color-success-dark-2);
  }
}

.portal-review-alert {
  margin-bottom: 16px;

  :deep(.el-alert__title) {
    font-weight: 600;
  }

  :deep(.el-alert__title),
  .portal-review-message {
    color: color-mix(in srgb, currentColor 60%, var(--el-text-color-primary));
  }
}

.portal-detail-fields :deep(.el-descriptions__content) {
  overflow-wrap: anywhere;
}

.portal-editor-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.portal-recorder {
  color: var(--el-text-color-regular);
  font-size: 13px;
  overflow-wrap: anywhere;
  min-width: 0;
}

.portal-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-inline-start: auto;

  .el-button + .el-button {
    margin-inline-start: 0;
  }
}

.portal-review-message,
.portal-detail-multiline {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

@media (max-width: 980px) {
  .portal-login-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .portal-login-brand {
    min-height: 320px;
    padding: 72px 24px 32px;
  }

  .portal-login-panel {
    align-items: start;
    min-height: auto;
    padding: 36px 24px 76px;
  }

  .portal-login-visual {
    height: 196px;
    margin-top: 0;
    transform: scale(0.7);
  }

  .portal-login-copy h1 { font-size: 20px; }
  .portal-login-copy p { font-size: 13px; }
  .portal-login-title h2 { font-size: 26px; }

  .portal-login-brand-header {
    top: 18px;
    left: 18px;
  }
}

@media (max-width: 960px) {
  .portal-content {
    padding: 18px 20px;
  }

  .portal-row-actions {
    gap: 2px;

    :deep(.el-button) {
      min-width: 22px;
    }
  }
}

@media (max-width: 680px) {
  .portal-navbar {
    padding: 0 8px;

    :deep(.el-breadcrumb) {
      display: none;
    }
  }

  .portal-account-text {
    max-width: 80px;
  }

  .portal-heading-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    font-size: 18px;
  }

  .portal-content,
  .portal-query,
  .portal-ledger-heading {
    padding: 12px;
  }

  .portal-heading {
    margin-bottom: 12px;
  }
}

.mt12 {
  margin-top: 12px;
}
</style>
