<template>
  <el-dialog v-if="detailOpen" :key="detailSession" :model-value="detailOpen" title="证书详情" width="920px"
    append-to-body class="ra-cert-detail-dialog" @update:model-value="onDetailVisibilityChange">
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
      <div>
        <RaIssueNotificationButton
          v-if="!props.operation && !props.loadDetail && !detailLoading && !detailLoadFailed && detail.id && detail.status === 'VALID'"
          :cert-id="detail.id"
        />
        <el-button type="primary" @click="closeDetail">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getRaCert, getRaOperationCertDetail, queryRaKmcKeyStatus, type RaCertDetail, type RaCertOperation, type RaCertStatus, type RaCertSummary, type RaKmcKeyStatus } from '@/api/ra/cert';
import { formatCertificateSubject } from '@/utils/raCertificateSubject';
import { extendedUsageText } from '@/utils/raCertificatePurpose';
import { parseTime } from '@/utils/ruoyi';
import RaIssueNotificationButton from '../issue/RaIssueNotificationButton.vue';

const X509Cert = defineAsyncComponent(() => import('@/components/X509Cert/index.vue'));
const props = defineProps<{
  operation?: RaCertOperation;
  loadDetail?: (id: RaCertSummary['id']) => ReturnType<typeof getRaCert>;
}>();
const kmcKeyStatus = ref<RaKmcKeyStatus | null>(null);

const detailOpen = ref(false);
const detailSession = ref(0);
let detailRequestId = 0;
const detailLoading = ref(false);
const detailLoadFailed = ref(false);

function closeDetail() {
  detailRequestId++;
  detailOpen.value = false;
}

function onDetailVisibilityChange(open: boolean) {
  if (!open) closeDetail();
}

const detail = ref<Record<string, any>>({});
const certificateView = ref<'pem' | 'readable'>('pem');
function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function handleDetail(row: Pick<RaCertSummary, 'id'> & Partial<RaCertSummary>) {
  const requestId = ++detailRequestId;
  detailSession.value = requestId;
  detail.value = { ...row };
  certificateView.value = 'pem';
  kmcKeyStatus.value = null;
  detailLoadFailed.value = false;
  detailLoading.value = true;
  detailOpen.value = true;
  let data: RaCertDetail;
  try {
    const response = props.loadDetail
      ? await props.loadDetail(row.id)
      : props.operation
        ? await getRaOperationCertDetail(row.id, props.operation)
        : await getRaCert(row.id);
    data = unwrapData<RaCertDetail>(response);
    if (requestId !== detailRequestId) return;
    detail.value = { ...(data?.summary || row), ...data };
  } catch {
    if (requestId === detailRequestId) detailLoadFailed.value = true;
    return;
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false;
  }
  const certificate = data?.summary || row;
  if (!props.operation && !props.loadDetail && certificate.keySource === 'KMC' && certificate.keyRecoveryAvailable !== false) {
    try {
      const status = unwrapData<RaKmcKeyStatus>(await queryRaKmcKeyStatus(row.id));
      if (requestId === detailRequestId && detailOpen.value) kmcKeyStatus.value = status;
    } catch {
      // The certificate detail is still available if the CA status lookup fails.
    }
  }
}

defineExpose({ open: handleDetail });

const statusOptions = [
  { label: '有效', value: 'VALID' },
  { label: '尚未生效', value: 'NOT_YET_VALID' },
  { label: '已过期', value: 'EXPIRED' },
  { label: '已冻结', value: 'HOLD' },
  { label: '已注销', value: 'REVOKED' }
];

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
</script>

<style scoped>
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
</style>
