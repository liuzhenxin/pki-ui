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
        <el-form-item label="用户信息" prop="userInfo">
          <el-input v-model="queryParams.userInfo" clearable placeholder="用户名、域账号或部门" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书状态" prop="status">
          <el-select v-model="queryParams.status" clearable placeholder="全部状态">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书模板" prop="profileId">
          <el-select v-model="queryParams.profileId" clearable filterable placeholder="全部模板" :loading="filterOptionsLoading" @visible-change="handleFilterOptionsVisibility">
            <el-option v-for="item in profileOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="颁发机构" prop="rootId">
          <el-select v-model="queryParams.rootId" clearable filterable placeholder="全部颁发机构" :loading="filterOptionsLoading" @visible-change="handleFilterOptionsVisibility">
            <el-option v-for="item in issuerOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期" prop="validity">
          <el-date-picker
            v-model="queryParams.validity"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="起始日期"
            end-placeholder="结束日期"
            unlink-panels
            class="validity-range"
          />
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
      <right-toolbar v-model:showSearch="showSearch" @queryTable="refreshPage" />
    </div>

    <el-table v-loading="loading" :data="rows" border stripe :empty-text="loadFailed ? '证书查询失败，请重试' : '暂无符合条件的内网已签发证书'" class="cert-table">
      <el-table-column label="证书序列号" prop="serialNumber" min-width="180" show-overflow-tooltip>
        <template #default="{ row }"><el-button link type="primary" @click="handleDetail(row)">{{ row.serialNumber || '查看详情' }}</el-button></template>
      </el-table-column>
      <el-table-column label="证书主题" prop="subject" min-width="260" :formatter="formatCertificateSubjectColumn" show-overflow-tooltip />
      <el-table-column label="申请用户" prop="userName" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.userName || '-' }}</template>
      </el-table-column>
      <el-table-column label="所属部门" prop="deptName" min-width="140" show-overflow-tooltip />
      <el-table-column label="签发 CA" prop="rootName" min-width="150" show-overflow-tooltip />
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
      <el-table-column label="操作" width="156" align="center" fixed="right">
        <template #default="{ row }">
          <CertRowAction label="查看详情" icon="View" @click="handleDetail(row)" />
          <CertRowAction v-if="canSyncIntranet" label="同步到证书管理" icon="DocumentAdd" @click="openIntranetCertLedger(row)" />
          <CertRowAction v-if="canRecoverKey(row)" label="密钥恢复" icon="Key" :disabled="recoverOpening" @click="openRecover(row)" />
          <CertRowAction label="下载证书" icon="Download" @command="(format) => handleDownload(format, row)">
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pem">PEM 证书 (.pem)</el-dropdown-item>
                <el-dropdown-item command="cer">CER 证书 (.cer)</el-dropdown-item>
                <el-dropdown-item command="der">DER 证书 (.der)</el-dropdown-item>
                <el-dropdown-item command="p7b">P7B 证书链 (.p7b)</el-dropdown-item>
                <el-dropdown-item command="pfx" divided>PFX 证书包 (.pfx)</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </CertRowAction>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" :auto-scroll="false" @pagination="getList" />

    <el-dialog v-model="detailOpen" title="证书详情" width="920px" append-to-body class="ra-cert-detail-dialog" @close="markDetailClosing" @closed="reopenQueuedDetail">
      <el-alert v-if="detailLoadFailed" title="证书详情加载失败，当前显示列表信息" type="warning" :closable="false" />
      <div v-loading="detailLoading">
        <el-descriptions :column="2" border class="detail-descriptions">
          <el-descriptions-item label="证书序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="证书状态">
            <el-tag :type="statusTagType(detail.status)" effect="light">{{ detail.statusName || statusName(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="证书主题" :span="2">{{ formatCertificateSubject(detail.x509?.subjectDn || detail.subject) }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.x509" label="颁发者 DN" :span="2">{{ detail.x509.issuerDn }}</el-descriptions-item>
          <el-descriptions-item label="请求主题" :span="2">{{ formatCertificateSubject(detail.requestSubject) }}</el-descriptions-item>
          <el-descriptions-item label="申请用户 ID">{{ Number(detail.userId) > 0 ? detail.userId : '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ detail.userName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户域账号">{{ detail.domainAccount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="所属部门">{{ detail.deptName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="签发 CA">{{ detail.rootName || '-' }}</el-descriptions-item>
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

        <el-alert v-if="detail.parseWarning" :title="detail.parseWarning" type="warning" :closable="false" show-icon class="mt12" />
        <el-descriptions v-if="detail.x509" title="X.509 属性" :column="2" border class="detail-descriptions mt12">
          <el-descriptions-item label="版本">V{{ detail.x509.version }}</el-descriptions-item>
          <el-descriptions-item label="公钥算法">{{ detail.x509.publicKeyAlgorithm }}</el-descriptions-item>
          <el-descriptions-item label="签名算法" :span="2">{{ detail.x509.signatureAlgorithm }}</el-descriptions-item>
          <el-descriptions-item label="密钥用途" :span="2">{{ detail.x509.keyUsages.join('、') || '未声明' }}</el-descriptions-item>
          <el-descriptions-item label="增强密钥用途" :span="2">{{ extendedUsageText(detail.x509.extendedKeyUsages) || '未声明' }}</el-descriptions-item>
          <el-descriptions-item label="主题备用名称" :span="2">{{ detail.x509.subjectAlternativeNames.join('、') || '-' }}</el-descriptions-item>
          <el-descriptions-item label="SHA-256 指纹" :span="2">{{ detail.x509.sha256 }}</el-descriptions-item>
        </el-descriptions>

        <div class="pem-header">
          <div class="pem-actions">
            <span>PEM 证书</span>
            <el-radio-group v-model="certificateView" aria-label="证书显示格式" size="small">
              <el-radio-button value="pem">原始</el-radio-button>
              <el-radio-button value="readable">查看</el-radio-button>
            </el-radio-group>
          </div>
          <div class="pem-actions">
            <el-button icon="CopyDocument" :disabled="!detail.cert" @click="copyPem">复制</el-button>
            <el-button type="primary" icon="Download" :disabled="!detail.cert" @click="downloadPem">下载 PEM</el-button>
          </div>
        </div>
        <el-input v-if="certificateView === 'pem'" :model-value="detail.cert" type="textarea" :rows="11" readonly class="pem-textarea" />
        <X509Cert v-else-if="detail.cert" :cert-pem="detail.cert" class="pem-readable" />
        <el-empty v-else-if="!detailLoading" description="暂无证书内容" :image-size="64" />

      </div>
      <template #footer>
        <RaIssueNotificationButton v-if="!detailLoading && !detailLoadFailed && detail.id && detail.status === 'VALID'" :cert-id="detail.id" />
        <el-button type="primary" @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <PfxExportDialog
      v-model="uploadedPfxOpen"
      :cert-id="selectedCert?.id"
      :serial-number="selectedCert?.serialNumber"
      :request-pfx="packageRaCertPfx"
      @download="saveBlob"
    />

    <el-dialog v-model="pkcs12Open" title="导出 PFX" width="480px" append-to-body @closed="resetPkcs12Form">
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

    <el-dialog
      v-model="recoverOpen"
      :title="archiveSkf ? '归档密钥恢复' : recoverAlgorithm === 'SM2' ? 'SM2密钥恢复' : 'RSA密钥恢复'"
      width="560px"
      append-to-body
      :close-on-click-modal="!recoverLoading"
      :close-on-press-escape="!recoverLoading"
      :show-close="!recoverLoading"
      @closed="resetRecoverForm"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        :title="
          archiveSkf
            ? '将归档密钥和原证书写入 USB Key 的新容器。'
            : `恢复会通过 CMP 从 CA 取回原 ${recoverAlgorithm} 加密私钥。USB Key 写入导入信封；签发到文件则下载 PKCS#12。序列号与有效期不变。`
        "
      />
      <el-form ref="recoverFormRef" :model="recoverForm" :rules="recoverRules" label-width="110px" class="pkcs12-form">
        <el-form-item label="证书序列号">
          <el-input :model-value="recoveringCert?.serialNumber || '-'" disabled />
        </el-form-item>
        <el-form-item v-if="!archiveSkf" label="输出方式" prop="issueType">
          <el-radio-group v-model="recoverForm.issueType" @change="onRecoverIssueTypeChange">
            <el-radio-button value="usb_key">USB Key</el-radio-button>
            <el-radio-button value="file">签发到文件</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="recoverForm.issueType === 'usb_key'">
          <el-form-item label="厂商" prop="provider">
            <el-select
              v-model="recoverForm.provider"
              placeholder="请选择厂商"
              :disabled="!!archiveAttempt || recoverLoading"
              @change="onRecoverProviderChange"
            >
              <el-option v-for="item in recoverProviders" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="设备" prop="device">
            <el-select
              v-model="recoverForm.device"
              placeholder="请选择设备"
              :disabled="!!archiveAttempt || recoverLoading"
              @change="onRecoverDeviceChange"
            >
              <el-option v-for="item in recoverDevices" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="应用" prop="appName">
            <el-select v-model="recoverForm.appName" placeholder="请选择应用" :disabled="!!archiveAttempt || recoverLoading">
              <el-option v-for="item in recoverApps" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="新容器" prop="containerName">
            <el-input
              v-model="recoverForm.containerName"
              placeholder="恢复将写入新容器"
              :disabled="!!archiveAttempt || recoverLoading || archiveSkf"
            />
          </el-form-item>
          <template v-if="archiveSkf">
            <el-form-item label="设备签名证书" prop="signingKey">
              <el-select v-model="recoverForm.signingKey" :disabled="!!archiveAttempt || recoverLoading" placeholder="选择已登记的 RSA 签名证书">
                <el-option v-for="item in archiveSigners" :key="item.key" :label="item.value" :value="item.key" />
              </el-select>
            </el-form-item>
            <el-form-item label="登记设备 ID" prop="deviceId">
              <el-input v-model.trim="recoverForm.deviceId" :disabled="!!archiveAttempt || recoverLoading" maxlength="128" />
            </el-form-item>
            <el-form-item label="接收方 ID" prop="recipientId">
              <el-input v-model.trim="recoverForm.recipientId" :disabled="!!archiveAttempt || recoverLoading" maxlength="128" />
            </el-form-item>
            <el-form-item label="工单号" prop="ticketNo">
              <el-input v-model.trim="recoverForm.ticketNo" :disabled="!!archiveAttempt || recoverLoading" maxlength="128" />
            </el-form-item>
            <el-form-item label="授权依据" prop="authorizationRef">
              <el-input v-model.trim="recoverForm.authorizationRef" :disabled="!!archiveAttempt || recoverLoading" maxlength="128" />
            </el-form-item>
            <el-form-item label="恢复原因" prop="reason">
              <el-input v-model.trim="recoverForm.reason" :disabled="!!archiveAttempt || recoverLoading" maxlength="512" />
            </el-form-item>
          </template>
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
      <p v-if="archiveTask" role="status">任务编号 {{ archiveTask.recoveryId }} · {{ archiveStatus }}</p>
      <el-alert v-if="archiveWriteResult" :title="archiveWriteResult.message" :type="archiveWriteResult.type" :closable="false" show-icon />
      <template #footer>
        <el-button :disabled="recoverLoading" @click="recoverOpen = false">关闭</el-button>
        <el-button type="primary" :loading="recoverLoading" :disabled="archiveFinished" @click="submitRecover">
          {{ archiveTask ? '查询并写入 USB Key' : '确认恢复' }}
        </el-button>
      </template>
    </el-dialog>
    <HistoricalRecoveryDialog
      v-if="archiveRecoveryCertificate"
      :key="archiveRecoveryCertificate.id"
      v-model="archiveRecoveryOpen"
      application="ra"
      :certificate="archiveRecoveryCertificate"
    />
  </div>
</template>

<script setup name="RaCert" lang="ts">
import { formatCertificateSubject, formatCertificateSubjectColumn } from '@/utils/raCertificateSubject';
import PfxExportDialog from '../components/PfxExportDialog.vue';
import CertRowAction from '../components/CertRowAction.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import { defineAsyncComponent } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import {
  downloadRaCert,
  downloadRaManagedPfx,
  packageRaCertPfx,
  getRaCert,
  getRaCertFilterOptions,
  type RaCertFilterOption,
  pageRaCert,
  queryRaKmcKeyStatus,
  recoverRaKey,
  RaCertDetail,
  RaCertStatus,
  RaCertSummary,
  RaKmcKeyStatus
} from '@/api/ra/cert';
import { claimRaSkfDelivery, getRaHistoricalRecovery, isRaArchiveRecoveryAvailable, submitRaHistoricalRecovery } from '@/api/ra/historicalRecovery';
import type { HistoricalRecoveryRequest, HistoricalRecoveryTask } from '@/api/ca/historicalRecovery';
import type { RaSkfDelivery } from '@/api/ra/historicalRecovery';
import { certificateFingerprint, isRsaSigningCertificate, signArchivePayload, utcNow, wrappingFingerprint } from '@/utils/raArchiveSkf';
import type { SkfSigningCertificate } from '@/utils/raArchiveSkf';
import SKFClient from '@/api/skf/skf_api';
import auth from '@/plugins/auth';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';
import { extendedUsageText } from '@/utils/raCertificatePurpose';
import { intranetCertSyncLocation } from '@/utils/raIntranetCertNavigation';
import RaIssueNotificationButton from '../issue/RaIssueNotificationButton.vue';
import HistoricalRecoveryDialog from '@/views/ca/archive-cert/HistoricalRecoveryDialog.vue';

const X509Cert = defineAsyncComponent(() => import('@/components/X509Cert/index.vue'));

const rows = ref<RaCertSummary[]>([]);
const router = useRouter();
const loading = ref(false);
const filterOptionsLoading = ref(false);
const profileOptions = ref<RaCertFilterOption[]>([]);
const issuerOptions = ref<RaCertFilterOption[]>([]);

let filterOptionsLoaded = false;

function handleFilterOptionsVisibility(open: boolean) {
  if (open && !filterOptionsLoaded) void loadFilterOptions();
}

async function loadFilterOptions() {
  if (filterOptionsLoading.value) return;
  filterOptionsLoading.value = true;
  try {
    const { data } = await getRaCertFilterOptions();
    const labelDuplicates = (options: RaCertFilterOption[]) => {
      const names = new Map<string, number>();
      for (const item of options) names.set(item.name, (names.get(item.name) ?? 0) + 1);
      return options.map(item => names.get(item.name) === 1 ? item : { ...item, name: `${item.name}（ID: ${item.id}）` });
    };
    profileOptions.value = labelDuplicates(data?.profiles ?? []);
    issuerOptions.value = labelDuplicates(data?.issuers ?? []);
    filterOptionsLoaded = true;
  } catch {
    // The request interceptor reports the error; other filters remain usable.
  } finally {
    filterOptionsLoading.value = false;
  }
}
const loadFailed = ref(false);
const canSyncIntranet = computed(() => auth.hasPermiAnd(['ra:intranet-cert', 'ra:intranet-cert:add']));
let listRequestId = 0;
const showSearch = ref(true);
const total = ref(0);
const detailOpen = ref(false);
let detailRequestId = 0;
let detailClosing = false;
let queuedDetail: RaCertSummary | undefined;
const detailLoading = ref(false);
const detailLoadFailed = ref(false);
function markDetailClosing() {
  if (detailClosing) return;
  detailClosing = true;
  detailRequestId++;
}

watch(detailOpen, (open) => {
  if (!open) markDetailClosing();
}, { flush: 'sync' });

async function reopenQueuedDetail() {
  await nextTick();
  detailClosing = false;
  const row = queuedDetail;
  queuedDetail = undefined;
  if (row) void handleDetail(row);
}
const detail = ref<Record<string, any>>({});
const certificateView = ref<'pem' | 'readable'>('pem');
const queryFormRef = ref<FormInstance>();
const pkcs12Open = ref(false);
const uploadedPfxOpen = ref(false);
const pkcs12Loading = ref(false);
const selectedCert = ref<RaCertSummary>();
const pkcs12FormRef = ref<FormInstance>();
const pkcs12Form = reactive({ password: '', confirmPassword: '' });
const kmcKeyStatus = ref<RaKmcKeyStatus | null>(null);
const recoverOpen = ref(false);
const recoverOpening = ref(false);
const archiveRecoveryOpen = ref(false);
const archiveRecoveryCertificate = ref<{ id: string; serialNumber?: string; subject?: string }>();
const archiveSkf = ref(false);
const archiveAttempt = shallowRef<HistoricalRecoveryRequest>();
const archiveTask = shallowRef<HistoricalRecoveryTask>();
const archiveCertificates = shallowRef<SkfSigningCertificate[]>([]);
const archiveFinished = ref(false);
const archiveImportAttempted = ref(false);
const archiveWriteResult = shallowRef<{ type: 'success' | 'error'; message: string }>();
const archiveStatus = computed(() => {
  if (archiveTask.value?.status === 'DELIVERED') return '加密信封已交付';
  if (archiveTask.value?.status === 'PENDING_CONFIRMATION') return '可领取';
  if (archiveTask.value?.status === 'QUEUED' || archiveTask.value?.status === 'EXECUTING') return '准备加密信封中';
  return '归档任务不可领取';
});
const recoverAlgorithm = ref<'RSA' | 'SM2'>('RSA');
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
  confirmPassword: '',
  signingKey: '',
  deviceId: '',
  recipientId: '',
  ticketNo: '',
  authorizationRef: '',
  reason: ''
});
const archiveSigners = computed(() => {
  const prefix = `${recoverForm.provider}/${recoverForm.device}/${recoverForm.appName}/`;
  return archiveCertificates.value.filter((cert) => cert.key.startsWith(prefix));
});
const recoverRules = computed<FormRules>(() => {
  const usb = recoverForm.issueType === 'usb_key';
  return {
    provider: usb ? [{ required: true, message: '请选择厂商', trigger: 'change' }] : [],
    device: usb ? [{ required: true, message: '请选择设备', trigger: 'change' }] : [],
    appName: usb ? [{ required: true, message: '请选择应用', trigger: 'change' }] : [],
    containerName: usb ? [{ required: true, message: '请输入容器名称', trigger: 'blur' }] : [],
    pin: usb ? [{ required: true, message: '请输入PIN码', trigger: 'blur' }] : [],
    ...(archiveSkf.value
      ? {
          signingKey: [{ required: true, message: '请选择登记的设备签名证书' }],
          deviceId: [{ required: true, message: '请输入登记设备 ID' }],
          recipientId: [{ required: true, message: '请输入接收方 ID' }],
          ticketNo: [{ required: true, message: '请输入工单号' }],
          authorizationRef: [{ required: true, message: '请输入授权依据' }],
          reason: [{ required: true, message: '请输入恢复原因' }]
        }
      : {}),
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
  userInfo: '',
  status: '' as RaCertStatus | '',
  profileId: '',
  rootId: '',
  validity: null as [string, string] | null
});

function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function getList() {
  const requestId = ++listRequestId;
  loading.value = true;
  loadFailed.value = false;
  try {
    const page = unwrapData<any>(
      await pageRaCert({
        pageNum: queryParams.pageNum,
        pageSize: queryParams.pageSize,
        serialNumber: queryParams.serialNumber || undefined,
        subject: queryParams.subject || undefined,
        userInfo: queryParams.userInfo || undefined,
        status: queryParams.status || undefined,
        profileId: queryParams.profileId || undefined,
        rootId: queryParams.rootId || undefined,
        validFrom: queryParams.validity?.[0],
        validTo: queryParams.validity?.[1]
      })
    );
    if (requestId !== listRequestId) return;
    rows.value = page?.records || page?.rows || [];
    total.value = Number(page?.total || 0);
  } catch {
    if (requestId !== listRequestId) return;
    rows.value = [];
    total.value = 0;
    loadFailed.value = true;
  } finally {
    if (requestId === listRequestId) loading.value = false;
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
  queryParams.userInfo = '';
  queryParams.status = '';
  queryParams.profileId = '';
  queryParams.rootId = '';
  queryParams.validity = null;
  handleQuery();
}

function canRecoverKey(row: RaCertSummary) {
  return row.keySource === 'KMC' && row.keyRecoveryAvailable !== false;
}

async function handleDetail(row: RaCertSummary) {
  if (detailClosing) {
    queuedDetail = row;
    return;
  }
  const requestId = ++detailRequestId;
  detail.value = { ...row };
  certificateView.value = 'pem';
  kmcKeyStatus.value = null;
  detailLoadFailed.value = false;
  detailLoading.value = true;
  detailOpen.value = true;
  let data: RaCertDetail;
  try {
    data = unwrapData<RaCertDetail>(await getRaCert(row.id));
    if (requestId !== detailRequestId) return;
    detail.value = { ...(data?.summary || row), ...data };
  } catch {
    if (requestId === detailRequestId) detailLoadFailed.value = true;
    return;
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false;
  }
  if (canRecoverKey(data?.summary || row)) {
    try {
      const status = unwrapData<RaKmcKeyStatus>(await queryRaKmcKeyStatus(row.id));
      if (requestId === detailRequestId && detailOpen.value) kmcKeyStatus.value = status;
    } catch {
      // The certificate detail is still available if the CA status lookup fails.
    }
  }
}

function openIntranetCertLedger(row: RaCertSummary) {
  const location = intranetCertSyncLocation(router, row.id);
  if (!location) return ElMessage.warning('未找到内网证书管理入口');
  router.push(location);
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
  if (format === 'pfx') {
    selectedCert.value = row;
    if (row.pkcs12Available) pkcs12Open.value = true;
    else uploadedPfxOpen.value = true;
    return;
  }
  try {
    const response = await downloadRaCert(row.id, format as 'pem' | 'cer' | 'der' | 'p7b');
    const mimeTypes: Record<string, string> = {
      pem: 'application/x-pem-file',
      cer: 'application/pkix-cert',
      der: 'application/pkix-cert',
      p7b: 'application/x-pkcs7-certificates'
    };
    saveBlob(await certificateDownloadBlob(response, mimeTypes[format], 'RA_CERT_DOWNLOAD_'), `${row.serialNumber}.${format}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '证书下载失败');
  }
}

async function submitPkcs12Export() {
  if (!selectedCert.value || !(await pkcs12FormRef.value?.validate().catch(() => false))) return;
  pkcs12Loading.value = true;
  try {
    const response = await downloadRaManagedPfx(selectedCert.value.id, pkcs12Form.password);
    saveBlob(await certificateDownloadBlob(response, 'application/x-pkcs12', 'RA_CERT_DOWNLOAD_'), `${selectedCert.value.serialNumber}.pfx`);
    pkcs12Open.value = false;
    ElMessage.success('PFX 下载已开始');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'PFX 导出失败');
  } finally {
    pkcs12Loading.value = false;
  }
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
  if (recoverOpening.value) return;
  recoverOpening.value = true;
  try {
    await prepareRecovery(row);
  } finally {
    recoverOpening.value = false;
  }
}

async function prepareRecovery(row: RaCertSummary) {
  if (row.status === 'EXPIRED') {
    const id = String(row.id);
    try {
      const available = unwrapData<boolean>(await isRaArchiveRecoveryAvailable(id));
      if (available === true) {
        if (import.meta.env.VITE_RA_ARCHIVE_SKF === 'true') {
          archiveSkf.value = true;
          recoverAlgorithm.value = 'RSA';
          recoveringCert.value = row;
          recoverForm.issueType = 'usb_key';
          recoverForm.containerName = `HR${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
          recoverForm.pin = '';
          recoverOpen.value = true;
          await refreshRecoverProviders();
        } else {
          archiveRecoveryCertificate.value = { id, serialNumber: row.serialNumber, subject: row.subject };
          archiveRecoveryOpen.value = true;
        }
      } else {
        ElMessage.warning('CA 证书和 KMC 密钥尚未确认均已归档，无法发起历史恢复');
      }
    } catch {
      ElMessage.warning('无法确认归档恢复资格，请核对权限和 CA、KMC 状态后重试');
    }
    return;
  }
  recoverAlgorithm.value = 'RSA';
  if (String(row.keySource || '').toUpperCase() === 'KMC') {
    try {
      const status = unwrapData<RaKmcKeyStatus>(await queryRaKmcKeyStatus(row.id));
      const algorithm = String(status?.algorithm || '').toUpperCase();
      if (algorithm === 'SM2' || algorithm.includes('1.2.156.10197.1.301')) {
        recoverAlgorithm.value = 'SM2';
      } else if (algorithm && algorithm !== 'RSA') {
        ElMessage.warning(`该证书为 ${status?.algorithm} 加密证书，密钥恢复仅支持 RSA 与 SM2`);
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
  recoverForm.signingKey = '';
  recoverForm.deviceId = '';
  recoverForm.recipientId = '';
  recoverForm.ticketNo = '';
  recoverForm.authorizationRef = '';
  recoverForm.reason = '';
  archiveSkf.value = false;
  archiveAttempt.value = undefined;
  archiveTask.value = undefined;
  archiveCertificates.value = [];
  archiveFinished.value = false;
  archiveImportAttempted.value = false;
  archiveWriteResult.value = undefined;
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
    if (archiveSkf.value) {
      const certs: SkfSigningCertificate[] = await skf.findCertificates('Sign');
      archiveCertificates.value = certs.filter(isRsaSigningCertificate);
    }
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

async function submitArchiveToSkf(certId: string, subject: string) {
  const { provider, device, appName, containerName, pin, deviceId, recipientId, ticketNo, reason, authorizationRef, signingKey } = recoverForm;
  const signer = archiveSigners.value.find((cert) => cert.key === signingKey);
  if (!signer) throw new Error('请选择目标 USB Key 中已登记的 RSA 签名证书');
  const skf = await getSkfClient();
  await skf.checkPIN(`${provider}/${device}/${appName}`, pin);
  const sign = (digest: string) => skf.signData(signer.key, digest);
  if (!archiveAttempt.value) {
    const containers: string[] = await skf.enumContainer(provider, device, appName);
    if (containers.includes(containerName)) throw new Error('恢复容器已经存在，请关闭后重新发起');
    const csr = await skf.createPKCS10(provider, device, appName, subject, 'RSA', 2048, containerName);
    const wrappingCsrBase64 = pemToBase64(csr?.pem || csr?.csr || csr);
    const payload = {
      bindingId: crypto.randomUUID(),
      issuedAt: utcNow(),
      clientCertSha256: await certificateFingerprint(signer.cert),
      wrappingSpkiSha256: await wrappingFingerprint(wrappingCsrBase64),
      deviceId,
      recipientId,
      ticketNo
    };
    const deviceBinding = await signArchivePayload('KMC-HISTORICAL-RA-SKF-BINDING-V1', payload, sign);
    archiveAttempt.value = {
      clientRequestNo: crypto.randomUUID(),
      mode: 'RA_SKF',
      wrappingCsrBase64,
      deviceBinding,
      deviceId,
      recipientId,
      ticketNo,
      reason,
      authorizationRef
    };
  }
  const task = archiveTask.value
    ? unwrapData<HistoricalRecoveryTask>(await getRaHistoricalRecovery(certId, archiveTask.value.recoveryId))
    : unwrapData<HistoricalRecoveryTask>(await submitRaHistoricalRecovery(certId, archiveAttempt.value));
  if (!task?.recoveryId) throw new Error('未获取归档恢复任务');
  archiveTask.value = task;

  if (task.status === 'QUEUED' || task.status === 'EXECUTING') return;
  if (task.status !== 'PENDING_CONFIRMATION' && task.status !== 'DELIVERED') {
    archiveFinished.value = true;
    throw new Error('归档任务无法领取');
  }
  const claim = {
    recoveryId: task.recoveryId,
    claimId: crypto.randomUUID(),
    issuedAt: utcNow(),
    wrappingSpkiSha256: archiveAttempt.value.deviceBinding.payload.wrappingSpkiSha256
  };
  const proof = await signArchivePayload('KMC-HISTORICAL-RA-SKF-CLAIM-V1', claim, sign);
  const envelope = unwrapData<RaSkfDelivery>(await claimRaSkfDelivery(certId, { recoveryId: task.recoveryId, proof }));
  archiveTask.value = { ...task, status: 'DELIVERED' };
  if (!envelope?.encryptedPrivateKey || !envelope.wrapKey || !envelope.originalCertificateDerBase64) {
    throw new Error('归档服务未返回完整的 SKF 信封');
  }
  archiveImportAttempted.value = true;
  const imported = await skf.importKeyPair(
    provider,
    device,
    appName,
    containerName,
    'RSA',
    envelope.encryptedPrivateKey,
    envelope.wrapKey,
    envelope.symmetricMode
  );
  if (imported !== true) throw new Error('SKF 未确认密钥写入');
  const certWritten = await skf.importCertificate(provider, device, appName, containerName, false, envelope.originalCertificateDerBase64);
  if (certWritten !== true) throw new Error('SKF 未确认原证书写入');
  archiveFinished.value = true;
  archiveWriteResult.value = { type: 'success', message: 'SKF 确认归档密钥和原证书已写入 USB Key' };
}

async function submitRecover() {
  if (recoverLoading.value || !recoveringCert.value) return;
  recoverLoading.value = true;
  try {
    if (!(await recoverFormRef.value?.validate().catch(() => false))) return;
    if (archiveSkf.value) {
      await submitArchiveToSkf(String(recoveringCert.value.id), recoveringCert.value.subject || 'CN=Archive Recovery');
      return;
    }
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
      ElMessage.success(`${recoverAlgorithm.value}密钥已恢复并开始下载PKCS#12`);
    } else {
      const sm2 = recoverAlgorithm.value === 'SM2';
      const skf = await getSkfClient();
      const appPath = `${recoverForm.provider}/${recoverForm.device}/${recoverForm.appName}`;
      await skf.checkPIN(appPath, recoverForm.pin);
      const wrapP10Res = await skf.createPKCS10(
        recoverForm.provider,
        recoverForm.device,
        recoverForm.appName,
        recoveringCert.value.subject,
        sm2 ? 'SM2' : 'RSA',
        sm2 ? 256 : 2048,
        recoverForm.containerName
      );
      const wrappingCsrBase64 = pemToBase64(wrapP10Res?.pem || wrapP10Res?.csr || wrapP10Res);
      const res = unwrapData<any>(
        await recoverRaKey(recoveringCert.value.id, {
          issueType: 'usb_key',
          wrappingCsrBase64
        })
      );
      if (!res?.encryptionPrivateKey || (!sm2 && !res?.wrapKey)) {
        throw new Error(`CA未返回可写入 USBKey 的 ${sm2 ? 'SM2' : 'RSA'} 加密私钥材料`);
      }
      await skf.importKeyPair(
        recoverForm.provider,
        recoverForm.device,
        recoverForm.appName,
        recoverForm.containerName,
        sm2 ? 'SM2' : 'RSA',
        res.encryptionPrivateKey,
        sm2 ? '' : res.wrapKey,
        sm2 ? 'ECB' : res.symmetricMode || 'ECB'
      );
      if (res.cert) {
        await skf.importCertificate(recoverForm.provider, recoverForm.device, recoverForm.appName, recoverForm.containerName, false, res.cert);
      }
      ElMessage.success(`${sm2 ? 'SM2' : 'RSA'}密钥已恢复并写入 USB Key`);
    }
    recoverOpen.value = false;
  } catch (error: any) {
    if (archiveSkf.value && archiveImportAttempted.value) {
      archiveFinished.value = true;
      archiveWriteResult.value = { type: 'error', message: 'SKF 写入未完成，请核对目标容器的密钥和证书状态' };
    } else if (archiveSkf.value) {
      ElMessage.error('归档恢复未完成，请核对任务状态、授权和目标 USB Key');
    } else {
      ElMessage.error(`${recoverAlgorithm.value === 'SM2' ? 'SM2' : 'RSA'}密钥恢复失败: ` + (error?.message || error?.msg || '未知错误'));
    }
  } finally {
    recoverLoading.value = false;
  }
}

function refreshPage() {
  filterOptionsLoaded = false;
  return getList();
}

onMounted(refreshPage);
useRaListRefreshOnReturn(refreshPage);
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

    :deep(.validity-range) {
      width: 250px;
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
      :deep(.el-select),
      :deep(.validity-range) {
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

:global(.ra-cert-detail-dialog .el-descriptions__content) {
  overflow-wrap: anywhere;
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
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

:global(.ra-cert-detail-dialog .pem-readable) {
  box-sizing: border-box;
  max-height: 320px;
  overflow: auto;
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
