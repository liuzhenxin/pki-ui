<template>
  <div class="app-container root-certificate-page">
    <el-form ref="queryFormRef" :model="searchForm" :inline="true" v-show="showSearch" label-width="76px">
      <el-form-item label="证书信息" prop="name">
        <el-input v-model="searchForm.name" placeholder="请输入证书CN、颁发者或根证书CN" clearable class="search-input" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button v-hasPermi="['ra:root']" type="primary" icon="Upload" @click="openImportDialog">导入证书</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button v-hasPermi="['ra:root']" type="primary" plain icon="Refresh" :loading="syncLoading" @click="openSyncDialog">
          同步CA授权
        </el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getLists" />
    </el-row>

    <el-tabs v-model="activeTab" class="certificate-tabs">
      <el-tab-pane name="root">
        <template #label>
          <span>根证书 <el-badge :value="rootTotal" :max="999" class="tab-badge" /></span>
        </template>
        <el-table v-loading="loading" :data="rootList" row-key="id" :expand-row-keys="expandedRootIds" @expand-change="handleRootExpandChange">
          <el-table-column type="expand" width="48">
            <template #default="scope">
              <div class="profile-expand">
                <div class="profile-expand-header">
                  <div>
                    <div class="profile-expand-title">授权模板</div>
                    <div class="profile-expand-subtitle">自动审核只跳过审核员，不跳过制证员，也不会自动调用 CA。</div>
                  </div>
                  <el-tag type="primary" effect="light">{{ scope.row.profiles?.length || 0 }} 个模板</el-tag>
                </div>
                <el-table v-if="scope.row.profiles?.length" :data="scope.row.profiles" border size="small" row-key="id">
                  <el-table-column label="模板名称" prop="name" min-width="220" show-overflow-tooltip>
                    <template #default="profileScope">
                      <div class="profile-name-cell">
                        <span>{{ profileScope.row.name || '-' }}</span>
                        <el-tag v-if="isDefaultAdminProfile(profileScope.row)" size="small" type="success" effect="light">管理员</el-tag>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="模板类型" width="140" align="center">
                    <template #default="profileScope">
                      <el-tag :type="profileTagType(profileScope.row)" effect="light">{{ profileTypeLabel(profileScope.row) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="有效期" width="110" align="center">
                    <template #default="profileScope">{{ profileValidity(profileScope.row) }}</template>
                  </el-table-column>
                  <el-table-column label="说明" min-width="180" show-overflow-tooltip>
                    <template #default="profileScope">{{ profileDescription(profileScope.row) }}</template>
                  </el-table-column>
                  <el-table-column label="审核策略" min-width="280">
                    <template #default="profileScope">
                      <el-radio-group
                        :model-value="profileScope.row.approvalMode || 'required'"
                        size="small"
                        :disabled="!canSaveApproval || savingProfileId === profileScope.row.id"
                        @change="(value: string) => handleApprovalChange(profileScope.row, value)"
                      >
                        <el-radio-button value="required">人工审核</el-radio-button>
                        <el-radio-button value="optional">自动审核</el-radio-button>
                      </el-radio-group>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="90" align="center">
                    <template #default="profileScope">
                      <el-button link type="primary" icon="View" @click="showProfileDetail(profileScope.row)">详情</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-else description="该根证书暂无授权模板" :image-size="72" />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="证书名称" prop="certificateName" min-width="180" show-overflow-tooltip />
          <el-table-column label="颁发者" prop="issuer" min-width="180" show-overflow-tooltip>
            <template #default="scope">
              <el-tooltip :content="scope.row.issuerDn || scope.row.issuer" placement="top">
                <span>{{ scope.row.issuer || '-' }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="签发日期" prop="notBefore" width="180" align="center">
            <template #default="scope">{{ formatTime(scope.row.notBefore) }}</template>
          </el-table-column>
          <el-table-column label="过期日期" prop="notAfter" width="180" align="center">
            <template #default="scope">{{ formatTime(scope.row.notAfter) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="120" align="center">
            <template #default="scope">
              <el-tooltip :content="statusDescription(scope.row)" placement="top">
                <el-tag :type="statusTagType(scope.row.validityStatus)" effect="light">{{ statusText(scope.row.validityStatus) }}</el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="中间证书" width="100" align="center">
            <template #default="scope"
              ><el-tag effect="plain">{{ scope.row.intermediateCount || 0 }}</el-tag></template
            >
          </el-table-column>
          <el-table-column label="模板数" width="90" align="center">
            <template #default="scope"
              ><el-tag type="primary" effect="plain">{{ scope.row.profileCount || 0 }}</el-tag></template
            >
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="240" align="center">
            <template #default="scope">
              <el-button link type="primary" icon="View" @click="showCertificateDetail(scope.row)">详情</el-button>
              <el-button link type="primary" icon="Download" @click="downloadPem(scope.row.pem || scope.row.cert, scope.row.certificateName)"
                >证书</el-button
              >
              <el-button link type="primary" icon="Document" @click="downloadPem(scope.row.certchain, `${scope.row.certificateName}-chain`)"
                >证书链</el-button
              >
            </template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="rootTotal > 0"
          :total="rootTotal"
          v-model:page="rootQuery.pageNum"
          v-model:limit="rootQuery.pageSize"
          @pagination="getRootList"
        />
      </el-tab-pane>

      <el-tab-pane name="intermediate">
        <template #label>
          <span>中间证书 <el-badge :value="intermediateTotal" :max="999" class="tab-badge" /></span>
        </template>
        <el-table v-loading="loading" :data="intermediateList" row-key="id">
          <el-table-column label="证书名称" prop="certificateName" min-width="190" show-overflow-tooltip />
          <el-table-column label="颁发者" prop="issuer" min-width="180" show-overflow-tooltip>
            <template #default="scope">
              <el-tooltip :content="scope.row.issuerDn || scope.row.issuer" placement="top">
                <span>{{ scope.row.issuer || '-' }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="签发日期" prop="notBefore" width="180" align="center">
            <template #default="scope">{{ formatTime(scope.row.notBefore) }}</template>
          </el-table-column>
          <el-table-column label="过期日期" prop="notAfter" width="180" align="center">
            <template #default="scope">{{ formatTime(scope.row.notAfter) }}</template>
          </el-table-column>
          <el-table-column label="对应根证书" prop="rootCertificateName" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" width="120" align="center">
            <template #default="scope">
              <el-tooltip :content="statusDescription(scope.row)" placement="top">
                <el-tag :type="statusTagType(scope.row.validityStatus)" effect="light">{{ statusText(scope.row.validityStatus) }}</el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="150" align="center">
            <template #default="scope">
              <el-button link type="primary" icon="View" @click="showCertificateDetail(scope.row)">详情</el-button>
              <el-button link type="primary" icon="Download" @click="downloadPem(scope.row.pem, scope.row.certificateName)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="intermediateTotal > 0"
          :total="intermediateTotal"
          v-model:page="intermediateQuery.pageNum"
          v-model:limit="intermediateQuery.pageSize"
          @pagination="getIntermediateList"
        />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="importDialog.visible" title="导入根证书和证书链" width="760px" append-to-body @closed="resetImport">
      <el-alert
        title="证书名称自动读取证书Subject中的CN；证书链文件可包含多张中间证书和根证书。"
        type="info"
        :closable="false"
        show-icon
        class="dialog-alert"
      />
      <el-form label-width="110px">
        <el-form-item label="根证书" required>
          <el-upload
            v-model:file-list="rootFileList"
            drag
            action="#"
            :auto-upload="false"
            :limit="1"
            accept=".pem,.crt,.cer,.der,.p7b,.p7c"
            class="certificate-upload"
            @change="clearImportPreview"
            @remove="clearImportPreview"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽根证书到此处，或<em>点击选择</em></div>
            <template #tip><div class="el-upload__tip">必填，最大5MB</div></template>
          </el-upload>
        </el-form-item>
        <el-form-item label="证书链">
          <el-upload
            v-model:file-list="chainFileList"
            drag
            action="#"
            :auto-upload="false"
            :limit="1"
            accept=".pem,.crt,.cer,.der,.p7b,.p7c"
            class="certificate-upload"
            @change="clearImportPreview"
            @remove="clearImportPreview"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽证书链到此处，或<em>点击选择</em></div>
            <template #tip><div class="el-upload__tip">选填，可包含多张证书，最大10MB</div></template>
          </el-upload>
        </el-form-item>
      </el-form>

      <div v-if="importPreview" class="import-preview">
        <el-divider content-position="left">解析结果</el-divider>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="根证书名称">{{ importPreview.root.certificateName }}</el-descriptions-item>
          <el-descriptions-item label="颁发者">{{ importPreview.root.issuer }}</el-descriptions-item>
          <el-descriptions-item label="签发日期">{{ formatTime(importPreview.root.notBefore) }}</el-descriptions-item>
          <el-descriptions-item label="过期日期">{{ formatTime(importPreview.root.notAfter) }}</el-descriptions-item>
          <el-descriptions-item label="中间证书数">{{ importPreview.intermediateCount }}</el-descriptions-item>
          <el-descriptions-item label="校验结果">
            <el-tag :type="importPreview.importable ? 'success' : 'danger'">{{ importPreview.importable ? '通过' : '不允许导入' }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-for="warning in importPreview.warnings"
          :key="warning"
          :title="warning"
          type="warning"
          :closable="false"
          show-icon
          class="preview-warning"
        />
        <el-table v-if="importPreview.intermediates.length" :data="importPreview.intermediates" border size="small" class="preview-table">
          <el-table-column label="中间证书名称" prop="certificateName" min-width="170" />
          <el-table-column label="颁发者" prop="issuer" min-width="150" />
          <el-table-column label="过期日期" width="170"
            ><template #default="scope">{{ formatTime(scope.row.notAfter) }}</template></el-table-column
          >
        </el-table>
      </div>

      <template #footer>
        <el-button @click="importDialog.visible = false">取消</el-button>
        <el-button :loading="importDialog.previewLoading" @click="previewImport">解析预览</el-button>
        <el-button type="primary" :loading="importDialog.importLoading" :disabled="!importPreview?.importable" @click="submitImport">
          确认导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="certificateDetail.visible" title="证书详情" width="900px" append-to-body top="5vh">
      <el-descriptions v-if="certificateDetail.data" :column="2" border class="detail-summary">
        <el-descriptions-item label="证书名称">{{ certificateDetail.data.certificateName }}</el-descriptions-item>
        <el-descriptions-item label="颁发者">{{ certificateDetail.data.issuer }}</el-descriptions-item>
        <el-descriptions-item label="签发日期">{{ formatTime(certificateDetail.data.notBefore) }}</el-descriptions-item>
        <el-descriptions-item label="过期日期">{{ formatTime(certificateDetail.data.notAfter) }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ certificateDetail.data.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SHA-256指纹">{{ certificateDetail.data.fingerprint || '-' }}</el-descriptions-item>
      </el-descriptions>
      <X509Cert v-if="certificateDetail.visible && certificateDetail.pem" :certPem="certificateDetail.pem" />
    </el-dialog>

    <el-dialog v-model="profileDetail.visible" title="模板详情" width="1000px" append-to-body top="5vh">
      <el-descriptions v-if="profileDetail.data" :column="2" border class="detail-summary">
        <el-descriptions-item label="模板名称">{{ profileDetail.data.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="模板类型">{{ profileTypeLabel(profileDetail.data) }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ profileValidity(profileDetail.data) }}</el-descriptions-item>
        <el-descriptions-item label="模板ID">{{ profileDetail.data.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ profileDescription(profileDetail.data) }}</el-descriptions-item>
      </el-descriptions>
      <CertProfile v-if="profileDetail.conf" :profile="profileDetail.conf" />
      <el-empty v-else description="暂无模板配置详情" />
    </el-dialog>

    <el-dialog v-model="syncDialog.visible" title="同步CA授权" width="760px" append-to-body>
      <el-form label-width="96px">
        <el-form-item label="CA地址">
          <el-input v-model="syncForm.caAddress" placeholder="请先在RA初始化或系统配置中设置CA地址" :disabled="syncAddressLoading" clearable />
        </el-form-item>
      </el-form>
      <el-alert title="同步CA授权的根证书和模板，不会删除手工导入的根证书。" type="info" :closable="false" show-icon class="dialog-alert" />
      <div v-if="syncResult" class="sync-result">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="根证书">{{ syncResult.rootCount || 0 }}</el-descriptions-item>
          <el-descriptions-item label="模板">{{ syncResult.profileCount || 0 }}</el-descriptions-item>
          <el-descriptions-item label="授权关系">{{ syncResult.relationCount || 0 }}</el-descriptions-item>
        </el-descriptions>
        <el-table v-if="syncResult.roots?.length" :data="syncResult.roots" border size="small" class="sync-root-table">
          <el-table-column label="根证书" prop="name" min-width="220" show-overflow-tooltip />
          <el-table-column label="模板数" prop="profileCount" width="90" align="center" />
          <el-table-column label="授权模板" min-width="280" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.profileNames?.join('、') || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="syncDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="syncLoading" :disabled="!syncForm.caAddress.trim()" @click="handleSyncAuthorizedCa">开始同步</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RootCert" lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, FormInstance, UploadUserFile } from 'element-plus';
import X509Cert from '@/components/X509Cert/index.vue';
import CertProfile from '@/components/CertProfile/index.vue';
import {
  getConfiguredCaAddress,
  importRaRootCertificate,
  listRaIntermediateCertificates,
  listRaRootCa,
  previewRaRootImport,
  syncAuthorizedCa
} from '@/api/ra/root';
import type {
  RaAuthorizedCaSyncResult,
  RaCertificateInfo,
  RaCertificateValidityStatus,
  RaIntermediateCertificate,
  RaRootCertificate,
  RaRootImportPreview
} from '@/api/ra/root';
import { saveRaProfileApprovalMode } from '@/api/ra/profile';
import { checkPermi } from '@/utils/permission';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
import { parseTime } from '@/utils/ruoyi';

const activeTab = ref('root');
const loading = ref(false);
const showSearch = ref(true);
const queryFormRef = ref<FormInstance>();
const searchForm = reactive({ name: '' });
const rootQuery = reactive({ pageNum: 1, pageSize: 10 });
const intermediateQuery = reactive({ pageNum: 1, pageSize: 10 });
const rootList = ref<RaRootCertificate[]>([]);
const intermediateList = ref<RaIntermediateCertificate[]>([]);
const rootTotal = ref(0);
const intermediateTotal = ref(0);
const expandedRootIds = ref<Array<string | number>>([]);
const canSaveApproval = checkPermi(['ra:profile:save']);
const savingProfileId = ref<string | number>();

const importDialog = reactive({ visible: false, previewLoading: false, importLoading: false });
const rootFileList = ref<UploadUserFile[]>([]);
const chainFileList = ref<UploadUserFile[]>([]);
const importPreview = ref<RaRootImportPreview | null>(null);

const certificateDetail = reactive({ visible: false, data: null as RaCertificateInfo | null, pem: '' });
const profileDetail = reactive({ visible: false, data: null as any, conf: null as any });

const syncLoading = ref(false);
const syncAddressLoading = ref(false);
const syncDialog = reactive({ visible: false });
const syncForm = reactive({ caAddress: '' });
const syncResult = ref<RaAuthorizedCaSyncResult | null>(null);

const queryKeyword = computed(() => searchForm.name.trim());

function unwrapPage<T>(response: any): { records: T[]; total: number } {
  const data = response?.data || {};
  return { records: data.records || data.rows || [], total: Number(data.total || 0) };
}

async function getRootList() {
  const response = await listRaRootCa({ ...rootQuery, name: queryKeyword.value });
  const page = unwrapPage<RaRootCertificate>(response);
  rootList.value = page.records;
  rootTotal.value = page.total;
}

async function getIntermediateList() {
  const response = await listRaIntermediateCertificates({ ...intermediateQuery, name: queryKeyword.value });
  const page = unwrapPage<RaIntermediateCertificate>(response);
  intermediateList.value = page.records;
  intermediateTotal.value = page.total;
}

async function getLists() {
  loading.value = true;
  try {
    await Promise.all([getRootList(), getIntermediateList()]);
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  rootQuery.pageNum = 1;
  intermediateQuery.pageNum = 1;
  getLists();
}

function resetQuery() {
  searchForm.name = '';
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleRootExpandChange(row: RaRootCertificate, expandedRows: RaRootCertificate[]) {
  expandedRootIds.value = expandedRows.some((item) => String(item.id) === String(row.id)) ? [row.id!] : [];
}

function statusText(status?: RaCertificateValidityStatus) {
  return {
    VALID: '有效',
    EXPIRING: '即将过期',
    EXPIRED: '已过期',
    NOT_YET_VALID: '未生效',
    PARSE_ERROR: '解析失败'
  }[status || 'PARSE_ERROR'];
}

function statusTagType(status?: RaCertificateValidityStatus) {
  if (status === 'VALID') return 'success';
  if (status === 'EXPIRING') return 'warning';
  if (status === 'EXPIRED' || status === 'PARSE_ERROR') return 'danger';
  return 'info';
}

function statusDescription(certificate: RaCertificateInfo & { parseError?: string }) {
  if (certificate.parseError) return certificate.parseError;
  if (certificate.validityStatus === 'EXPIRING') return `证书将在${certificate.remainingDays ?? 0}天内过期`;
  if (certificate.validityStatus === 'EXPIRED') return '证书已经过期';
  if (certificate.validityStatus === 'NOT_YET_VALID') return '证书尚未生效';
  return '证书当前有效';
}

function formatTime(value?: string) {
  return value ? parseTime(value) || '-' : '-';
}

function profileTypeLabel(profile: any) {
  const type = profile?.type || profile?.certLevel || '';
  return { RootCA: '根CA', SubCA: '中间CA', IntermediateCA: '中间CA', EndEntity: '终端实体' }[type] || type || '-';
}

function profileConf(profile: any) {
  if (!profile?.conf) return {};
  if (typeof profile.conf !== 'string') return profile.conf;
  try {
    return parseJson(profile.conf) || {};
  } catch {
    return {};
  }
}

function profileValidity(profile: any) {
  return profile?.validity || profileConf(profile)?.validity || '-';
}

function profileDescription(profile: any) {
  const conf = profileConf(profile);
  return profile?.description || conf?.description || profile?.metadata?.details || '-';
}

function isDefaultAdminProfile(profile: any) {
  return profile?.name === '管理员证书模板';
}

function profileTagType(profile: any) {
  const type = profile?.type || profile?.certLevel || '';
  if (type === 'RootCA') return 'danger';
  if (type === 'SubCA' || type === 'IntermediateCA') return 'warning';
  return 'success';
}

function showProfileDetail(profile: any) {
  const conf = profileConf(profile);
  if (conf?.keyAlgorithms) conf.keyAlgorithms = parseKeyAlgorithms(conf.keyAlgorithms);
  profileDetail.data = profile;
  profileDetail.conf = {
    ...conf,
    metadata: { category: profile?.type || conf?.certLevel || '证书模板', details: profileDescription(profile) },
    certLevel: conf?.certLevel || profile?.type || profile?.certLevel || '',
    maxSize: conf?.maxSize || '-',
    validity: conf?.validity || profile?.validity || '-',
    notBeforeTime: conf?.notBeforeTime || '-',
    keypairGeneration: conf?.keypairGeneration || '-',
    subject: conf?.subject || [],
    extensions: conf?.extensions || []
  };
  profileDetail.visible = true;
}

function syncApprovalMode(profileId: string | number, value: 'required' | 'optional') {
  rootList.value.forEach((root) => {
    (root.profiles || []).forEach((profile) => {
      if (String(profile.id) === String(profileId)) profile.approvalMode = value;
    });
  });
}

async function handleApprovalChange(profile: any, value: string) {
  if (value !== 'required' && value !== 'optional') return;
  const previous = profile.approvalMode === 'optional' ? 'optional' : 'required';
  syncApprovalMode(profile.id, value);
  savingProfileId.value = profile.id;
  try {
    await saveRaProfileApprovalMode(profile.id, value);
    ElMessage.success('审核策略已保存，仅对后续新提交生效');
  } catch (error) {
    syncApprovalMode(profile.id, previous);
  } finally {
    savingProfileId.value = undefined;
  }
}

function showCertificateDetail(certificate: RaCertificateInfo & { cert?: string }) {
  const pem = certificate.pem || certificate.cert || '';
  if (!pem) {
    ElMessage.warning('证书内容为空，无法查看详情');
    return;
  }
  certificateDetail.data = certificate;
  certificateDetail.pem = pem;
  certificateDetail.visible = true;
}

function downloadPem(content: string | undefined, name: string) {
  if (!content) {
    ElMessage.warning('证书内容为空，无法下载');
    return;
  }
  const blob = new Blob([content], { type: 'application/x-pem-file' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.pem`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function openImportDialog() {
  resetImport();
  importDialog.visible = true;
}

function resetImport() {
  rootFileList.value = [];
  chainFileList.value = [];
  importPreview.value = null;
  importDialog.previewLoading = false;
  importDialog.importLoading = false;
}

function clearImportPreview() {
  importPreview.value = null;
}

function buildImportFormData() {
  const rootFile = rootFileList.value[0]?.raw;
  if (!rootFile) throw new Error('请选择根证书文件');
  const formData = new FormData();
  formData.append('rootCertificate', rootFile);
  const chainFile = chainFileList.value[0]?.raw;
  if (chainFile) formData.append('certificateChain', chainFile);
  return formData;
}

async function previewImport() {
  importDialog.previewLoading = true;
  try {
    const response = await previewRaRootImport(buildImportFormData());
    importPreview.value = response.data || null;
    if (importPreview.value?.importable) ElMessage.success('证书链校验通过');
  } catch (error: any) {
    ElMessage.error(error?.message || '证书解析失败');
  } finally {
    importDialog.previewLoading = false;
  }
}

async function submitImport() {
  if (!importPreview.value?.importable) return;
  importDialog.importLoading = true;
  try {
    await importRaRootCertificate(buildImportFormData());
    ElMessage.success('根证书和证书链导入成功');
    importDialog.visible = false;
    await getLists();
  } finally {
    importDialog.importLoading = false;
  }
}

async function openSyncDialog() {
  syncResult.value = null;
  syncDialog.visible = true;
  syncAddressLoading.value = true;
  try {
    const response = await getConfiguredCaAddress();
    syncForm.caAddress = response.data?.caAddress?.trim() || '';
    if (!syncForm.caAddress) ElMessage.warning('未找到初始化时配置的CA地址');
  } finally {
    syncAddressLoading.value = false;
  }
}

async function handleSyncAuthorizedCa() {
  if (!syncForm.caAddress.trim()) return;
  syncLoading.value = true;
  try {
    const response = await syncAuthorizedCa({ caAddress: syncForm.caAddress.trim() });
    syncResult.value = response.data || null;
    await getLists();
    ElMessage.success('CA授权同步完成');
  } finally {
    syncLoading.value = false;
  }
}

getLists();
</script>

<style scoped lang="scss">
.search-input {
  width: 320px;
}

.certificate-tabs {
  margin-top: 4px;
}

.tab-badge {
  margin: -2px 0 0 6px;
}

.profile-expand {
  padding: 14px 48px 18px;
  background: var(--el-fill-color-lighter);
}

.profile-expand-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.profile-expand-title {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.profile-expand-subtitle {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.profile-name-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.dialog-alert,
.detail-summary {
  margin-bottom: 16px;
}

.certificate-upload {
  width: 100%;
}

.certificate-upload :deep(.el-upload),
.certificate-upload :deep(.el-upload-dragger) {
  width: 100%;
}

.import-preview {
  margin-top: 8px;
}

.preview-warning {
  margin-top: 10px;
}

.preview-table {
  margin-top: 12px;
}

.sync-result {
  margin-top: 16px;
}

.sync-root-table {
  margin-top: 12px;
}

:deep(.el-badge__content.is-fixed) {
  top: 4px;
}
</style>
