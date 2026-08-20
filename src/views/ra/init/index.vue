<template>
  <div class="app-container ra-init-page">
    <el-card v-loading="loading" class="init-card" shadow="never">
      <div class="init-heading">
        <div>
          <p class="heading-label">注册认证中心</p>
          <h1>RA 初始化向导</h1>
        </div>
        <div class="heading-actions">
          <el-button :icon="Refresh" plain :loading="statusLoading" @click="loadInitInfo({ syncStep: true })">刷新状态</el-button>
        </div>
      </div>

      <el-steps :active="activeStep" finish-status="success" simple class="init-steps">
        <el-step title="协议" />
        <el-step title="RA身份证书" />
        <el-step title="同步CA" />
        <el-step title="策略" />
        <el-step title="管理员设置" />
        <el-step title="审计员设置" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <section v-if="activeStep === 0" class="step-content">
          <div class="step-title">
            <h2>欢迎使用 {{ tenantName || '注册认证中心' }}</h2>
            <p>请确认初始化协议后继续。</p>
          </div>
          <div class="agreement-text">
            <Agreement :tenant-code="tenantCode" :tenant-name="tenantName" :company-name="companyName" />
          </div>
          <div class="agreement-footer">
            <el-checkbox v-model="agree" class="agree-checkbox">我已阅读并同意用户协议</el-checkbox>
          </div>
        </section>

        <section v-if="activeStep === 1" class="step-content">
          <div class="step-title">
            <h2>RA身份证书</h2>
            <p>生成 RA 身份证书请求，待 CA 签发后导入返回证书。</p>
          </div>
          <el-alert
            class="step-alert"
            type="info"
            :closable="false"
            title="RA 端保存私钥并输出 PKCS#10 CSR，请将 CSR 提交 CA 签发，再导入 PEM 格式身份证书。"
            show-icon
          />
          <el-form ref="identityFormRef" :model="identityForm" :rules="identityRules" label-width="120px" class="init-form">
            <el-form-item label="通用名称" prop="commonName">
              <el-input v-model="identityForm.commonName" placeholder="例如：RA身份认证中心" />
            </el-form-item>
            <el-form-item label="组织名称" prop="organization">
              <el-input v-model="identityForm.organization" placeholder="例如：LiuZX PKI" />
            </el-form-item>
            <el-form-item label="国家代码" prop="country">
              <el-input v-model="identityForm.country" maxlength="2" placeholder="CN" />
            </el-form-item>
            <el-form-item label="密钥算法" prop="algorithm">
              <el-select v-model="identityForm.algorithm">
                <el-option label="SM2 / SM3withSM2" value="SM2" />
              </el-select>
            </el-form-item>
            <el-form-item label="证书请求">
              <div class="csr-panel">
                <div class="csr-actions">
                  <el-button type="primary" plain :loading="csrLoading" @click="generateCsr">生成证书请求</el-button>
                  <el-button :icon="CopyDocument" :disabled="!identityForm.csrPem" @click="copyCsr">复制CSR</el-button>
                  <el-button :icon="Download" :disabled="!identityForm.csrPem" @click="downloadCsr">下载CSR</el-button>
                </div>
                <el-input
                  v-model="identityForm.csrPem"
                  type="textarea"
                  :rows="8"
                  readonly
                  placeholder="生成后显示 -----BEGIN CERTIFICATE REQUEST-----"
                />
              </div>
            </el-form-item>
            <el-form-item label="签发证书 PEM" prop="certPem">
              <el-input v-model="identityForm.certPem" type="textarea" :rows="8" placeholder="-----BEGIN CERTIFICATE-----" />
            </el-form-item>
          </el-form>
        </section>

        <section v-if="activeStep === 2" class="step-content wide-step">
          <div class="step-header">
            <div>
              <h2>同步CA</h2>
              <p>使用 RA 身份证书向 CA 发起签名同步，获取已授权的根证书和证书模板。</p>
            </div>
          </div>
          <el-alert
            class="step-alert"
            type="info"
            :closable="false"
            title="同步前请确认 CA 中已将 RA 身份证书配置为请求者，并为该请求者授权根证书和模板。"
            show-icon
          />

          <div class="sync-panel">
            <el-form :model="caSyncForm" label-width="104px" class="sync-form">
              <el-form-item label="CA地址">
                <el-input v-model="caSyncForm.caAddress" placeholder="例如：http://127.0.0.1 或 http://127.0.0.1/prod-api" clearable />
              </el-form-item>
            </el-form>
            <div class="sync-action">
              <el-button
                type="primary"
                size="large"
                :icon="Refresh"
                :loading="caSyncLoading"
                :disabled="!caSyncForm.caAddress.trim()"
                @click="syncCaFromRemote"
              >
                同步CA
              </el-button>
            </div>
          </div>

          <div v-if="caSyncResult || caReady" class="sync-result">
            <div class="sync-result-title">
              <el-tag type="success" effect="dark">已就绪</el-tag>
              <span>{{ caSyncSummary }}</span>
            </div>
            <div class="sync-metrics">
              <div class="sync-metric">
                <span>根证书</span>
                <strong>{{ caSyncResult?.rootCount ?? statusInfo.rootCount ?? 0 }}</strong>
              </div>
              <div class="sync-metric">
                <span>授权模板</span>
                <strong>{{ caSyncResult?.profileCount ?? statusInfo.profileCount ?? 0 }}</strong>
              </div>
              <div class="sync-metric">
                <span>授权关系</span>
                <strong>{{ caSyncResult?.relationCount ?? statusInfo.relationCount ?? 0 }}</strong>
              </div>
            </div>
            <div v-if="syncRoots.length > 0" class="root-profile-cards">
              <div v-for="root in syncRoots" :key="String(root.id)" class="root-profile-panel">
                <div class="root-profile-header">
                  <span>{{ root.name }}</span>
                  <el-tag effect="plain">{{ root.profileCount }} 个模板</el-tag>
                </div>
                <ul v-if="root.profileNames.length > 0" class="root-profile-list">
                  <li v-for="name in root.profileNames" :key="name" class="root-profile-item">{{ name }}</li>
                </ul>
                <el-empty v-else description="未同步到授权模板" :image-size="72" />
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeStep === 3" class="step-content">
          <div class="step-title">
            <h2>策略与流程初始化</h2>
            <p>写入 RA 默认注册策略、安全策略和证书申请审批流程。</p>
          </div>
          <el-descriptions border :column="1" class="policy-summary">
            <el-descriptions-item label="CA模式">接入已有 CA，不在 RA 保存 CA 私钥</el-descriptions-item>
            <el-descriptions-item label="证书申请">启用注册申请、资料审核、证书签发的默认流程</el-descriptions-item>
            <el-descriptions-item label="审批规则">默认一审，由 RA 审核员处理</el-descriptions-item>
            <el-descriptions-item label="审计要求">初始化后启用操作审计和生命周期策略</el-descriptions-item>
          </el-descriptions>
        </section>

        <section v-if="activeStep === 4" class="step-content">
          <div class="step-title">
            <h2>管理员设置</h2>
            <p>设置 RA 管理员初始登录凭据，并选择已同步 CA 的根证书和模板用于签发管理员数字证书。</p>
          </div>
          <el-alert
            v-if="adminCertProfileCount === 0"
            class="step-alert"
            type="warning"
            :closable="false"
            title="未找到已授权的证书模板，请先返回同步CA，获取根证书和授权模板后再完成初始化。"
            show-icon
          />
          <el-form ref="adminFormRef" :model="adminForm" :rules="adminRules" label-width="130px" class="init-form">
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><Refresh /></el-icon>
                <span>证书签发配置</span>
              </div>
              <el-form-item label="根证书" prop="certRootId">
                <el-select
                  v-model="adminForm.certRootId"
                  placeholder="请选择同步的根证书"
                  :disabled="adminCertProfileCount === 0"
                  filterable
                  @change="handleAdminRootChange"
                >
                  <el-option v-for="root in adminCertRoots" :key="String(root.id)" :label="root.name" :value="String(root.id)" />
                </el-select>
              </el-form-item>
              <el-form-item label="证书模板" prop="certProfileId">
                <el-select
                  v-model="adminForm.certProfileId"
                  placeholder="请选择授权模板"
                  :disabled="adminProfileOptions.length === 0"
                  filterable
                >
                  <el-option
                    v-for="profile in adminProfileOptions"
                    :key="String(profile.id)"
                    :label="profile.name"
                    :value="String(profile.id)"
                  >
                    <span>{{ profile.name }}</span>
                    <span class="option-type">{{ profile.type }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
            </div>
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><User /></el-icon>
                <span>管理员账号</span>
              </div>
              <el-form-item label="用户名" prop="adminUsername">
                <el-input v-model="adminForm.adminUsername" />
              </el-form-item>
              <el-form-item label="登录密码" prop="adminPassword">
                <el-input v-model="adminForm.adminPassword" type="password" show-password />
              </el-form-item>
            </div>
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><User /></el-icon>
                <span>管理员证书主题</span>
              </div>
              <CertSubject v-model="adminForm.adminSubjectItems" propPrefix="adminSubjectItems" />
            </div>
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><Refresh /></el-icon>
                <span>USBKey 证书设置</span>
              </div>
              <el-form-item label="设备提供商" prop="adminProvider">
                <div class="inline-control">
                  <el-select v-model="adminForm.adminProvider" placeholder="请选择或刷新" @change="onAdminProviderChange">
                    <el-option v-for="provider in adminProviders" :key="provider" :label="provider" :value="provider" />
                  </el-select>
                  <el-button :icon="Refresh" circle @click="refreshAdminProviders" />
                </div>
              </el-form-item>
              <el-form-item label="设备列表" prop="adminDevice">
                <el-select v-model="adminForm.adminDevice" placeholder="请选择设备" @change="onAdminDeviceChange">
                  <el-option v-for="device in adminDevices" :key="device" :label="device" :value="device" />
                </el-select>
              </el-form-item>
              <el-form-item label="应用" prop="adminAppName">
                <el-select v-model="adminForm.adminAppName" placeholder="请选择应用">
                  <el-option v-for="app in adminApps" :key="app" :label="app" :value="app" />
                </el-select>
              </el-form-item>
              <el-form-item label="容器名" prop="adminContainerName">
                <el-input v-model="adminForm.adminContainerName" placeholder="自动生成，可按需修改" />
              </el-form-item>
              <el-form-item label="User PIN" prop="adminPin">
                <el-input v-model="adminForm.adminPin" type="password" show-password placeholder="请输入 USBKey User PIN" />
              </el-form-item>
              <el-form-item label="证书操作">
                <el-button type="primary" :loading="adminGeneratingCert" @click="generateAndWriteAdminCert">
                  生成 CSR 并签发写入 USBKey
                </el-button>
                <el-tag v-if="adminForm.adminCertPem" class="cert-written-tag" type="success" effect="plain">管理员证书已写入</el-tag>
              </el-form-item>
            </div>
          </el-form>
        </section>

        <section v-if="activeStep === 5" class="step-content">
          <div class="step-title">
            <h2>审计员设置</h2>
            <p>设置 RA 审计员初始登录凭据，并使用管理员步骤选择的根证书和模板签发证书写入 USBKey。</p>
          </div>
          <el-alert
            v-if="adminCertProfileCount === 0"
            class="step-alert"
            type="warning"
            :closable="false"
            title="未找到已授权的证书模板，请先返回同步CA，获取根证书和授权模板后再完成初始化。"
            show-icon
          />
          <el-form ref="auditorFormRef" :model="adminForm" :rules="auditorRules" label-width="130px" class="init-form">
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><Refresh /></el-icon>
                <span>证书签发配置</span>
              </div>
              <el-descriptions border :column="1" class="policy-summary">
                <el-descriptions-item label="根证书">{{ selectedAdminRoot?.name || '未选择' }}</el-descriptions-item>
                <el-descriptions-item label="证书模板">{{ selectedAdminProfile?.name || '未选择' }}</el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><View /></el-icon>
                <span>审计员账号</span>
              </div>
              <el-form-item label="用户名" prop="auditorUsername">
                <el-input v-model="adminForm.auditorUsername" />
              </el-form-item>
              <el-form-item label="登录密码" prop="auditorPassword">
                <el-input v-model="adminForm.auditorPassword" type="password" show-password />
              </el-form-item>
            </div>
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><View /></el-icon>
                <span>审计员证书主题</span>
              </div>
              <CertSubject v-model="adminForm.auditorSubjectItems" propPrefix="auditorSubjectItems" />
            </div>
            <div class="form-section">
              <div class="form-section-title">
                <el-icon><Refresh /></el-icon>
                <span>USBKey 证书设置</span>
              </div>
              <el-form-item label="设备提供商" prop="auditorProvider">
                <div class="inline-control">
                  <el-select v-model="adminForm.auditorProvider" placeholder="请选择或刷新" @change="onAuditorProviderChange">
                    <el-option v-for="provider in auditorProviders" :key="provider" :label="provider" :value="provider" />
                  </el-select>
                  <el-button :icon="Refresh" circle @click="refreshAuditorProviders" />
                </div>
              </el-form-item>
              <el-form-item label="设备列表" prop="auditorDevice">
                <el-select v-model="adminForm.auditorDevice" placeholder="请选择设备" @change="onAuditorDeviceChange">
                  <el-option v-for="device in auditorDevices" :key="device" :label="device" :value="device" />
                </el-select>
              </el-form-item>
              <el-form-item label="应用" prop="auditorAppName">
                <el-select v-model="adminForm.auditorAppName" placeholder="请选择应用">
                  <el-option v-for="app in auditorApps" :key="app" :label="app" :value="app" />
                </el-select>
              </el-form-item>
              <el-form-item label="容器名" prop="auditorContainerName">
                <el-input v-model="adminForm.auditorContainerName" placeholder="自动生成，可按需修改" />
              </el-form-item>
              <el-form-item label="User PIN" prop="auditorPin">
                <el-input v-model="adminForm.auditorPin" type="password" show-password placeholder="请输入 USBKey User PIN" />
              </el-form-item>
              <el-form-item label="证书操作">
                <el-button type="primary" :loading="auditorGeneratingCert" @click="generateAndWriteAuditorCert">
                  生成 CSR 并签发写入 USBKey
                </el-button>
                <el-tag v-if="adminForm.auditorCertPem" class="cert-written-tag" type="success" effect="plain">审计员证书已写入</el-tag>
              </el-form-item>
            </div>
          </el-form>
        </section>

        <section v-if="activeStep === 6" class="step-content complete-step">
          <el-result icon="success" title="RA 初始化已完成" sub-title="请重新登录后进入 RA 管理功能。" />
          <div class="complete-grid">
            <div v-for="item in statusCards" :key="item.label" class="complete-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>
      </div>

      <div class="wizard-actions">
        <el-button :disabled="activeStep === 0 || activeStep === 6 || loading" @click="prev">上一步</el-button>
        <el-button v-if="activeStep < 5" type="primary" :disabled="!canGoNext" :loading="loading" @click="next">下一步</el-button>
        <el-button v-else-if="activeStep === 5" type="primary" :loading="loading" @click="submitAdmin">提交初始化</el-button>
        <el-button v-else type="primary" :loading="loading" @click="enterSystem">进入系统</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="RaInit" lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { CopyDocument, Download, Refresh, User, View } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import {
  completeInit,
  generateIdentityCsr,
  getAdminCertOptions,
  getInitStatus,
  importIdentityCert,
  issueAdminAccountCert,
  initAdmin,
  initPolicies,
  syncCa,
  unwrapRaData
} from '@/api/ra/init';
import type { RaAdminCertOptions, RaAdminCertProfileOption, RaAdminCertRootOption, RaCaSyncResult, RaCaSyncRoot, RaInitStatus } from '@/api/ra/init';
import { getTenant } from '@/api/system/tenant';
import { useUserStore } from '@/store/modules/user';
import Agreement from '@/components/Agreement/index.vue';
import CertSubject, { sortSubjectItems, typeMapping } from '@/components/CertSubject/index.vue';
import SKFClient from '@/api/skf/skf_api';

const router = useRouter();
const userStore = useUserStore();
const identityFormRef = ref<FormInstance>();
const adminFormRef = ref<FormInstance>();
const auditorFormRef = ref<FormInstance>();
const activeStep = ref(0);
const agree = ref(false);
const loading = ref(false);
const statusLoading = ref(false);
const csrLoading = ref(false);
const caSyncLoading = ref(false);
const caSynced = ref(false);
const caSyncResult = ref<RaCaSyncResult | null>(null);
const adminCertOptions = ref<RaAdminCertOptions>({ roots: [], profileCount: 0 });
const adminGeneratingCert = ref(false);
const auditorGeneratingCert = ref(false);
const adminProviders = ref<string[]>([]);
const adminDevices = ref<string[]>([]);
const adminApps = ref<string[]>([]);
const auditorProviders = ref<string[]>([]);
const auditorDevices = ref<string[]>([]);
const auditorApps = ref<string[]>([]);
const activeRootTab = ref('');
const statusInfo = ref<RaInitStatus>({});
const tenantCode = ref('ra');
const tenantName = ref('注册认证中心');
const companyName = ref('');

const identityForm = reactive({
  commonName: 'RA身份认证中心',
  organization: 'LiuZX PKI',
  country: 'CN',
  algorithm: 'SM2',
  csrPem: '',
  certPem: ''
});

const caSyncForm = reactive({
  caAddress: 'http://127.0.0.1'
});

const randomContainerName = (prefix: string) => {
  const bytes = new Uint8Array(4);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const suffix = Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}-${suffix}`;
};

const adminForm = reactive({
  certRootId: '',
  certProfileId: '',
  adminUsername: 'admin',
  adminPassword: '',
  adminSubjectItems: sortSubjectItems([
    { type: 'country', value: 'CN' },
    { type: 'organization', value: 'LiuZX PKI' },
    { type: 'organizationalUnit', value: '管理员' },
    { type: 'commonName', value: 'admin' }
  ]),
  adminProvider: '',
  adminDevice: '',
  adminAppName: '',
  adminContainerName: randomContainerName('ra-admin'),
  adminPin: '',
  adminCertPem: '',
  auditorUsername: 'auditor',
  auditorPassword: '',
  auditorSubjectItems: sortSubjectItems([
    { type: 'country', value: 'CN' },
    { type: 'organization', value: 'LiuZX PKI' },
    { type: 'organizationalUnit', value: '审计员' },
    { type: 'commonName', value: 'auditor' }
  ]),
  auditorProvider: '',
  auditorDevice: '',
  auditorAppName: '',
  auditorContainerName: randomContainerName('ra-auditor'),
  auditorPin: '',
  auditorCertPem: ''
});

const identityRules = reactive<FormRules>({
  commonName: [{ required: true, message: '请输入通用名称', trigger: 'blur' }],
  country: [{ required: true, message: '请输入国家代码', trigger: 'blur' }],
  certPem: [{ required: true, message: '请导入CA签发后的RA身份证书PEM', trigger: 'blur' }]
});

const adminRules = reactive<FormRules>({
  certRootId: [{ required: true, message: '请选择签发根证书', trigger: 'change' }],
  certProfileId: [{ required: true, message: '请选择签发模板', trigger: 'change' }],
  adminUsername: [{ required: true, message: '请输入管理员用户名', trigger: 'blur' }],
  adminPassword: [{ required: true, message: '请输入管理员密码', trigger: 'blur' }],
  adminProvider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  adminDevice: [{ required: true, message: '请选择设备', trigger: 'change' }],
  adminAppName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  adminContainerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  adminPin: [{ required: true, message: '请输入 User PIN', trigger: 'blur' }]
});

const auditorRules = reactive<FormRules>({
  auditorUsername: [{ required: true, message: '请输入审计管理员用户名', trigger: 'blur' }],
  auditorPassword: [{ required: true, message: '请输入审计管理员密码', trigger: 'blur' }],
  auditorProvider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  auditorDevice: [{ required: true, message: '请选择设备', trigger: 'change' }],
  auditorAppName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  auditorContainerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  auditorPin: [{ required: true, message: '请输入 User PIN', trigger: 'blur' }]
});

const statusCards = computed(() => [
  { label: 'CSR', value: statusInfo.value.identityCsrCount ?? 0 },
  { label: 'RA证书', value: statusInfo.value.identityCertCount ?? 0 },
  { label: '模板', value: statusInfo.value.profileCount ?? 0 },
  { label: 'CA根', value: statusInfo.value.rootCount ?? 0 },
  { label: '授权关系', value: statusInfo.value.relationCount ?? 0 },
  { label: '策略', value: statusInfo.value.policyCount ?? 0 },
  { label: '流程', value: statusInfo.value.workflowCount ?? 0 },
  { label: '账号', value: statusInfo.value.userCount ?? 0 }
]);

const caReady = computed(() => (statusInfo.value.rootCount ?? 0) > 0 && (statusInfo.value.relationCount ?? 0) > 0);

const syncRoots = computed<RaCaSyncRoot[]>(() => caSyncResult.value?.roots || []);

const adminCertRoots = computed<RaAdminCertRootOption[]>(() => adminCertOptions.value.roots || []);

const adminCertProfileCount = computed(() => adminCertOptions.value.profileCount || 0);

const selectedAdminRoot = computed(() => adminCertRoots.value.find((root) => String(root.id) === adminForm.certRootId));

const adminProfileOptions = computed<RaAdminCertProfileOption[]>(() => selectedAdminRoot.value?.profiles || []);

const selectedAdminProfile = computed(() => adminProfileOptions.value.find((profile) => String(profile.id) === adminForm.certProfileId));

const caSyncSummary = computed(() => {
  if (caSyncResult.value) {
    return `本次已同步 ${caSyncResult.value.rootCount ?? 0} 个根证书、${caSyncResult.value.profileCount ?? 0} 个模板、${
      caSyncResult.value.relationCount ?? 0
    } 条授权关系。`;
  }
  return `系统已存在 ${statusInfo.value.rootCount ?? 0} 个根证书、${statusInfo.value.profileCount ?? 0} 个模板、${
    statusInfo.value.relationCount ?? 0
  } 条授权关系。`;
});

watch(activeStep, async (step) => {
  if (step === 4 && adminProviders.value.length === 0) {
    await refreshAdminProviders();
  }
  if (step === 5 && auditorProviders.value.length === 0) {
    await refreshAuditorProviders();
  }
});

const canGoNext = computed(() => {
  if (activeStep.value === 0) {
    return agree.value;
  }
  if (activeStep.value === 1) {
    return identityForm.certPem.trim().length > 0;
  }
  if (activeStep.value === 2) {
    return caSynced.value || caReady.value;
  }
  return true;
});

const normalizeStatus = (data: any): RaInitStatus => {
  if (!data || typeof data !== 'object') {
    return {};
  }
  return {
    initialized: Boolean(data.initialized),
    identityCsrCount: Number(data.identityCsrCount ?? 0),
    identityCertCount: Number(data.identityCertCount ?? 0),
    profileCount: Number(data.profileCount ?? 0),
    rootCount: Number(data.rootCount ?? 0),
    relationCount: Number(data.relationCount ?? 0),
    policyCount: Number(data.policyCount ?? 0),
    workflowCount: Number(data.workflowCount ?? 0),
    userCount: Number(data.userCount ?? 0),
    accountCertCount: Number(data.accountCertCount ?? 0)
  };
};

const resolveActiveStep = (tenantStatus: number | undefined, status: RaInitStatus) => {
  if (status.initialized || tenantStatus === -1) {
    return 6;
  }
  // The tenant status is the persisted wizard step. Database counts are only a
  // compatibility fallback for installations created before step persistence.
  if (tenantStatus !== undefined && Number.isInteger(tenantStatus) && tenantStatus >= 0 && tenantStatus <= 5) {
    return tenantStatus;
  }
  if ((status.accountCertCount ?? 0) >= 2) {
    return 5;
  }
  if ((status.policyCount ?? 0) > 0 || (status.workflowCount ?? 0) > 0 || tenantStatus === 3 || tenantStatus === 4) {
    return 4;
  }
  if ((status.rootCount ?? 0) > 0 || (status.relationCount ?? 0) > 0 || tenantStatus === 2) {
    return 3;
  }
  if ((status.profileCount ?? 0) > 0 || (status.identityCertCount ?? 0) > 0 || tenantStatus === 1) {
    return 2;
  }
  return 0;
};

const loadInitInfo = async (options: { syncStep?: boolean } = {}) => {
  statusLoading.value = true;
  try {
    const res = await getInitStatus();
    const data = normalizeStatus(unwrapRaData(res));
    statusInfo.value = data;
    if (options.syncStep) {
      activeStep.value = resolveActiveStep(userStore.tenantInitStatus, data);
    }
  } finally {
    statusLoading.value = false;
  }
};

const loadAdminCertOptions = async () => {
  const res = await getAdminCertOptions();
  const data = unwrapRaData<RaAdminCertOptions>(res) || { roots: [], profileCount: 0 };
  adminCertOptions.value = {
    roots: data.roots || [],
    profileCount: Number(data.profileCount ?? 0)
  };
  if (!adminForm.certRootId && adminCertOptions.value.roots[0]) {
    adminForm.certRootId = String(adminCertOptions.value.roots[0].id);
  }
  if (!adminForm.certProfileId && adminProfileOptions.value[0]) {
    adminForm.certProfileId = String(adminProfileOptions.value[0].id);
  }
};

const handleAdminRootChange = () => {
  adminForm.certProfileId = adminProfileOptions.value[0] ? String(adminProfileOptions.value[0].id) : '';
};

let skfClientPromise: Promise<any> | null = null;

const getSkfClient = (): Promise<any> => {
  if (!skfClientPromise) {
    skfClientPromise = new Promise((resolve, reject) => {
      const client = new SKFClient('ws://127.0.0.1:9001');
      const timeout = setTimeout(() => {
        skfClientPromise = null;
        reject(new Error('连接 SKF 服务超时'));
      }, 5000);
      client
        .connect()
        .then(() => {
          clearTimeout(timeout);
          resolve(client);
        })
        .catch((err: any) => {
          clearTimeout(timeout);
          skfClientPromise = null;
          reject(err);
        });
      client.on('disconnect', () => {
        skfClientPromise = null;
      });
      client.on('error', () => {
        if (!client.isConnected()) {
          skfClientPromise = null;
        }
      });
    });
  }
  return skfClientPromise;
};

const formatToPem = (cert: string) => {
  if (!cert || cert.includes('BEGIN CERTIFICATE')) {
    return cert;
  }
  const clean = cert.replace(/\s+/g, '');
  const lines = clean.match(/.{1,64}/g)?.join('\n') || clean;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
};

const buildSubject = (items: any[]) =>
  items
    .filter((item: any) => item.value)
    .map((item: any) => {
      const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
      return `${key}=${item.value}`;
    })
    .join(',');

const ensureCertOptions = async () => {
  await loadAdminCertOptions();
  if (adminCertProfileCount.value === 0 || !adminForm.certRootId || !adminForm.certProfileId) {
    throw new Error('请先同步 CA，获取已授权的根证书和模板');
  }
};

const refreshAdminProviders = async () => {
  try {
    const skf = await getSkfClient();
    const providers = await skf.enumProvider();
    adminProviders.value = providers;
    adminForm.adminProvider = providers[0] || '';
    if (adminForm.adminProvider) {
      await onAdminProviderChange();
    }
  } catch (e: any) {
    ElMessage.error('SKF 服务连接失败: ' + (e.message || e));
  }
};

const onAdminProviderChange = async () => {
  if (!adminForm.adminProvider) {
    return;
  }
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(adminForm.adminProvider);
    adminDevices.value = devices;
    adminForm.adminDevice = devices[0] || '';
    if (adminForm.adminDevice) {
      await onAdminDeviceChange();
    }
  } catch (e: any) {
    ElMessage.error('枚举设备失败: ' + (e.message || e));
  }
};

const onAdminDeviceChange = async () => {
  if (!adminForm.adminProvider || !adminForm.adminDevice) {
    return;
  }
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(adminForm.adminProvider, adminForm.adminDevice);
    adminApps.value = apps;
    adminForm.adminAppName = apps[0] || '';
  } catch (e: any) {
    ElMessage.error('枚举应用失败: ' + (e.message || e));
  }
};

const refreshAuditorProviders = async () => {
  try {
    const skf = await getSkfClient();
    const providers = await skf.enumProvider();
    auditorProviders.value = providers;
    adminForm.auditorProvider = providers[0] || '';
    if (adminForm.auditorProvider) {
      await onAuditorProviderChange();
    }
  } catch (e: any) {
    ElMessage.error('SKF 服务连接失败: ' + (e.message || e));
  }
};

const onAuditorProviderChange = async () => {
  if (!adminForm.auditorProvider) {
    return;
  }
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(adminForm.auditorProvider);
    auditorDevices.value = devices;
    adminForm.auditorDevice = devices[0] || '';
    if (adminForm.auditorDevice) {
      await onAuditorDeviceChange();
    }
  } catch (e: any) {
    ElMessage.error('枚举设备失败: ' + (e.message || e));
  }
};

const onAuditorDeviceChange = async () => {
  if (!adminForm.auditorProvider || !adminForm.auditorDevice) {
    return;
  }
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(adminForm.auditorProvider, adminForm.auditorDevice);
    auditorApps.value = apps;
    adminForm.auditorAppName = apps[0] || '';
  } catch (e: any) {
    ElMessage.error('枚举应用失败: ' + (e.message || e));
  }
};

const generateAndWriteAdminCert = async () => {
  const fields = ['certRootId', 'certProfileId', 'adminProvider', 'adminDevice', 'adminAppName', 'adminContainerName', 'adminPin'];
  const valid = await adminFormRef.value?.validateField(fields).then(() => true).catch(() => false);
  if (!valid || adminGeneratingCert.value) {
    return;
  }
  adminGeneratingCert.value = true;
  try {
    await ensureCertOptions();
    const skf = await getSkfClient();
    await skf.checkPIN(`${adminForm.adminProvider}/${adminForm.adminDevice}/${adminForm.adminAppName}`, adminForm.adminPin);
    const subject = buildSubject(adminForm.adminSubjectItems);
    const csrRes = await skf.createPKCS10(
      adminForm.adminProvider,
      adminForm.adminDevice,
      adminForm.adminAppName,
      subject,
      'SM2',
      256,
      adminForm.adminContainerName
    );
    const issueRes = await issueAdminAccountCert({
      rootId: adminForm.certRootId,
      profileId: adminForm.certProfileId,
      role: '管理员',
      subject,
      csrPem: csrRes.pem
    });
    const certPem = formatToPem(unwrapRaData<{ cert: string }>(issueRes)?.cert || '');
    if (!certPem) {
      throw new Error('CA未返回签发证书');
    }
    await skf.importCertificate(adminForm.adminProvider, adminForm.adminDevice, adminForm.adminAppName, csrRes.container, true, certPem);
    adminForm.adminCertPem = certPem;
    ElMessage.success('管理员证书生成并写入 USBKey 成功');
  } catch (e: any) {
    ElMessage.error('管理员证书生成失败: ' + (e.message || e));
  } finally {
    adminGeneratingCert.value = false;
  }
};

const generateAndWriteAuditorCert = async () => {
  const fields = ['auditorProvider', 'auditorDevice', 'auditorAppName', 'auditorContainerName', 'auditorPin'];
  const valid = await auditorFormRef.value?.validateField(fields).then(() => true).catch(() => false);
  if (!valid || auditorGeneratingCert.value) {
    return;
  }
  auditorGeneratingCert.value = true;
  try {
    await ensureCertOptions();
    const skf = await getSkfClient();
    await skf.checkPIN(`${adminForm.auditorProvider}/${adminForm.auditorDevice}/${adminForm.auditorAppName}`, adminForm.auditorPin);
    const subject = buildSubject(adminForm.auditorSubjectItems);
    const csrRes = await skf.createPKCS10(
      adminForm.auditorProvider,
      adminForm.auditorDevice,
      adminForm.auditorAppName,
      subject,
      'SM2',
      256,
      adminForm.auditorContainerName
    );
    const issueRes = await issueAdminAccountCert({
      rootId: adminForm.certRootId,
      profileId: adminForm.certProfileId,
      role: '审计员',
      subject,
      csrPem: csrRes.pem
    });
    const certPem = formatToPem(unwrapRaData<{ cert: string }>(issueRes)?.cert || '');
    if (!certPem) {
      throw new Error('CA未返回签发证书');
    }
    await skf.importCertificate(
      adminForm.auditorProvider,
      adminForm.auditorDevice,
      adminForm.auditorAppName,
      csrRes.container,
      true,
      certPem
    );
    adminForm.auditorCertPem = certPem;
    ElMessage.success('审计员证书生成并写入 USBKey 成功');
  } catch (e: any) {
    ElMessage.error('审计员证书生成失败: ' + (e.message || e));
  } finally {
    auditorGeneratingCert.value = false;
  }
};

const syncCaFromRemote = async () => {
  if (!caSyncForm.caAddress.trim()) {
    ElMessage.warning('请输入CA地址');
    return;
  }
  caSyncLoading.value = true;
  try {
    const res = await syncCa({
      caAddress: caSyncForm.caAddress.trim()
    });
    const data = unwrapRaData<RaCaSyncResult>(res) || ({} as RaCaSyncResult);
    caSyncResult.value = data;
    activeRootTab.value = data.roots?.[0] ? String(data.roots[0].id) : '';
    caSynced.value = true;
    await loadInitInfo();
    await loadAdminCertOptions();
    ElMessage.success('CA同步完成');
  } finally {
    caSyncLoading.value = false;
  }
};

// 向导步骤状态由后端 InitController.markTenantStatus 直接写入 sys_tenant，
// 此处仅同步前端内存中的租户初始化状态，不再调用 admin 的 PUT /v1/tenants
// （该接口要求 write + sys:tenant:modify 权限，引导账号不具备，会返回 Access Denied）。
const syncTenantInitStatus = (statusValue: number) => {
  userStore.setTenantInitStatus(statusValue);
};

const generateCsr = async () => {
  csrLoading.value = true;
  try {
    const res = await generateIdentityCsr({
      commonName: identityForm.commonName,
      organization: identityForm.organization,
      country: identityForm.country,
      algorithm: identityForm.algorithm
    });
    const data = unwrapRaData<{ csrPem: string }>(res);
    identityForm.csrPem = data?.csrPem || '';
    await loadInitInfo();
    ElMessage.success('证书请求已生成');
  } finally {
    csrLoading.value = false;
  }
};

const copyCsr = async () => {
  if (!identityForm.csrPem) {
    return;
  }
  await navigator.clipboard.writeText(identityForm.csrPem);
  ElMessage.success('CSR已复制');
};

const downloadCsr = () => {
  if (!identityForm.csrPem) {
    return;
  }
  const blob = new Blob([identityForm.csrPem], { type: 'application/pkcs10' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ra-identity.csr.pem';
  link.click();
  URL.revokeObjectURL(url);
};

const next = async () => {
  if (!canGoNext.value) {
    return;
  }
  loading.value = true;
  try {
    if (activeStep.value === 1) {
      const valid = await identityFormRef.value?.validate().catch(() => false);
      if (!valid) {
        return;
      }
      await importIdentityCert({ certPem: identityForm.certPem });
      await loadInitInfo();
      ElMessage.success('RA身份证书已导入');
    } else if (activeStep.value === 2) {
      if (caSynced.value || caReady.value) {
        await loadInitInfo();
        ElMessage.success('CA已同步');
        activeStep.value++;
        syncTenantInitStatus(activeStep.value);
        return;
      }
      ElMessage.warning('请先同步 CA，获取已授权的根证书和模板');
      return;
    } else if (activeStep.value === 3) {
      await initPolicies();
      await loadInitInfo();
      ElMessage.success('策略与流程已初始化');
    } else if (activeStep.value === 4) {
      const valid = await adminFormRef.value?.validate().catch(() => false);
      if (!valid) {
        return;
      }
      await loadAdminCertOptions();
      if (adminCertProfileCount.value === 0 || !adminForm.certRootId || !adminForm.certProfileId) {
        ElMessage.warning('请先同步 CA，获取已授权的根证书和模板');
        return;
      }
      if (!adminForm.adminCertPem) {
        ElMessage.warning('请先生成管理员证书并写入 USBKey');
        return;
      }
      activeStep.value++;
      return;
    }
    activeStep.value++;
    syncTenantInitStatus(activeStep.value);
  } finally {
    loading.value = false;
  }
};

const prev = async () => {
  if (activeStep.value > 0) {
    loading.value = true;
    try {
      activeStep.value--;
      syncTenantInitStatus(activeStep.value);
    } finally {
      loading.value = false;
    }
  }
};

const submitAdmin = async () => {
  const valid = await auditorFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  if (!adminForm.adminCertPem) {
    ElMessage.warning('请先生成管理员证书并写入 USBKey');
    return;
  }
  if (!adminForm.auditorCertPem) {
    ElMessage.warning('请先生成审计员证书并写入 USBKey');
    return;
  }
  await loadAdminCertOptions();
  if (adminCertProfileCount.value === 0 || !adminForm.certRootId || !adminForm.certProfileId) {
    ElMessage.warning('请先同步 CA，获取已授权的根证书和模板');
    return;
  }
  loading.value = true;
  try {
    await initAdmin({
      admin: {
        username: adminForm.adminUsername,
        password: adminForm.adminPassword,
        certPem: adminForm.adminCertPem
      },
      auditor: {
        username: adminForm.auditorUsername,
        password: adminForm.auditorPassword,
        certPem: adminForm.auditorCertPem
      },
      rootId: adminForm.certRootId,
      profileId: adminForm.certProfileId
    });
    await completeInit();
    userStore.setTenantInitStatus(-1);
    await loadInitInfo();
    activeStep.value = 6;
    ElMessage.success('RA初始化完成');
  } finally {
    loading.value = false;
  }
};

const enterSystem = async () => {
  loading.value = true;
  try {
    await userStore.logout();
    await router.replace({ path: '/login', query: { redirect: encodeURIComponent('/index') } });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  const tenantId = userStore.tenantId || localStorage.getItem('tenantId') || '';
  let tenantStatus: number | undefined;
  if (tenantId) {
    const tenantRes = await getTenant(tenantId);
    const tenantInfo: any = tenantRes.data;
    if (tenantInfo) {
      tenantCode.value = tenantInfo.code || 'ra';
      tenantName.value = tenantInfo.name || '注册认证中心';
      companyName.value = tenantInfo.companyName || '';
      tenantStatus = Number(tenantInfo.status);
      userStore.setTenantInitStatus(tenantStatus);
      if (tenantStatus === -1) {
        await router.replace('/index');
        return;
      }
    }
  }
  await loadInitInfo({ syncStep: true });
  await loadAdminCertOptions();
  activeStep.value = resolveActiveStep(tenantStatus, statusInfo.value);
});
</script>

<style scoped lang="scss">
.ra-init-page {
  min-height: calc(100vh - 84px);
  padding: 20px;
  background: var(--el-fill-color-lighter);
}

.init-card {
  max-width: 1180px;
  margin: 0 auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.init-heading,
.heading-actions,
.step-tools {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.init-heading {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.heading-actions,
.step-tools {
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.step-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.heading-label {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.init-heading h1,
.step-title h2,
.step-header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1.35;
}

.init-heading h1 {
  font-size: 24px;
}

.step-title h2,
.step-header h2 {
  font-size: 20px;
}

.step-title p,
.step-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.init-steps {
  margin-top: 18px;
}

.wizard-content {
  min-height: 520px;
  padding: 28px 0 24px;
}

.step-content {
  max-width: 960px;
  margin: 0 auto;
}

.wide-step {
  max-width: 1000px;
}

.step-alert {
  margin: 16px 0;
}

.agreement-text {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 20px;
  background: var(--el-fill-color-blank);
}

.agreement-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.agree-checkbox {
  height: auto;
}

.selected-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.init-form {
  max-width: 720px;
  margin: 18px auto 0;
}

.csr-panel {
  width: 100%;
}

.csr-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.form-section {
  padding: 18px 20px 4px;
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1;
}

.option-type {
  float: right;
  margin-left: 16px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.policy-summary {
  margin-top: 18px;
}

.complete-step {
  max-width: 760px;
}

.complete-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.complete-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-secondary);
}

.complete-item strong {
  color: var(--el-color-primary);
  font-size: 18px;
}

.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.sync-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: end;
  padding: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.sync-form {
  max-width: none;
  margin: 0;

  :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }
}

.sync-action {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 18px;
}

.sync-result {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid var(--el-color-success-light-5);
  border-radius: 8px;
  background: var(--el-color-success-light-9);
}

.sync-result-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.sync-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.sync-metric {
  min-height: 74px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.sync-metric span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.sync-metric strong {
  display: block;
  margin-top: 8px;
  color: var(--el-color-primary);
  font-size: 24px;
  line-height: 1;
}

.root-profile-cards {
  display: flex;
  max-height: 360px;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  overflow-y: auto;
  padding-right: 4px;
}

.root-profile-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.root-profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
  font-weight: 600;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.root-profile-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
  padding: 12px 14px 14px;
  list-style: none;
}

.root-profile-item {
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

.inline-control {
  display: flex;
  width: 100%;
  gap: 10px;

  .el-select {
    flex: 1;
  }
}

.cert-written-tag {
  margin-left: 10px;
}

@media (max-width: 900px) {
  .complete-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .ra-init-page {
    padding: 12px;
  }

  .init-heading,
  .step-header,
  .heading-actions,
  .step-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .wizard-content {
    min-height: 460px;
  }

  .init-form {
    :deep(.el-form-item) {
      display: block;
    }

    :deep(.el-form-item__label) {
      justify-content: flex-start;
      width: auto !important;
      margin-bottom: 6px;
    }

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }
  }

  .sync-panel,
  .sync-metrics {
    grid-template-columns: 1fr;
  }

  .sync-action {
    justify-content: stretch;
    padding-bottom: 0;

    .el-button {
      width: 100%;
    }
  }
}

@media (max-width: 520px) {
  .complete-grid {
    grid-template-columns: 1fr;
  }
}
</style>
