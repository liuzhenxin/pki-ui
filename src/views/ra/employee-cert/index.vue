<template>
  <div class="app-container employee-cert-page">
    <el-tabs v-model="managementTab">
      <el-tab-pane label="证书台账" name="ledger" />
      <el-tab-pane label="分发记录" name="distribution" />
    </el-tabs>

    <el-card v-show="managementTab === 'ledger' && showSearch" shadow="never" class="query-card">
      <el-form :model="queryParams" class="query-form" label-width="76px">
        <el-form-item label="任务号">
          <el-input v-model="queryParams.taskNo" clearable maxlength="40" placeholder="请输入完整任务号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="证书序列号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="域账号">
          <el-input v-model="queryParams.domainAccount" clearable placeholder="域账号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="queryParams.employeeName" clearable placeholder="员工姓名" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书类型">
          <el-select v-model="queryParams.certTypeCode" clearable placeholder="全部">
            <el-option label="签名证书" value="SIGN" />
            <el-option label="员工加密证书" value="EMAIL" />
            <el-option label="WiFi证书" value="WIFI" />
          </el-select>
        </el-form-item>
        <el-form-item label="分发状态">
          <el-select v-model="queryParams.distributionStatus" clearable placeholder="全部">
            <el-option label="待分发" value="PENDING" />
            <el-option label="已分发" value="SENT" />
            <el-option label="发送失败" value="FAILED" />
            <el-option label="发送中" value="SENDING" />
          </el-select>
        </el-form-item>
        <div class="query-actions">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card v-show="managementTab === 'ledger'" shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8">
        <el-col v-if="canDistribute" :span="1.5">
          <el-button
            type="primary"
            plain
            icon="Promotion"
            :disabled="loading || selectedRows.length === 0"
            @click="distributeSelected"
          >批量分发（{{ selectedRows.length }}）</el-button>
        </el-col>
        <el-col v-if="canDistribute && taskForDistribution" :span="1.5">
          <el-button type="primary" plain icon="Promotion" :disabled="loading" @click="distributeTask">
            按任务分发
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="success" plain icon="Download" @click="handleExport">导出台账</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:employee-cert:template']" plain icon="Message" @click="openTemplates">分发模板</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:employee-cert:distribute']" plain icon="Setting" @click="openDistributionConfig">分发配置</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
      </el-row>

      <el-table v-loading="loading" :data="rows" row-key="id" border stripe empty-text="暂无员工证书台账" @selection-change="selectedRows = $event">
        <el-table-column v-if="canDistribute" type="selection" width="48" fixed :selectable="canSelectForDistribution" />
        <el-table-column label="序列号" prop="serialNumber" min-width="170" fixed show-overflow-tooltip />
        <el-table-column label="主题" prop="subject" min-width="260" show-overflow-tooltip />
        <el-table-column label="姓名" prop="employeeName" width="110" />
        <el-table-column label="域账号" prop="domainAccount" width="120" />
        <el-table-column label="任务号" prop="taskNo" min-width="210" show-overflow-tooltip />
        <el-table-column label="科室" prop="departmentName" min-width="150" show-overflow-tooltip />
        <el-table-column label="职位" prop="jobName" min-width="130" show-overflow-tooltip />
        <el-table-column label="证书类型" prop="certTypeName" width="130" />
        <el-table-column label="签发模板" prop="profileNameSnapshot" min-width="150" show-overflow-tooltip />
        <el-table-column label="密码" prop="certPassword" width="130" show-overflow-tooltip />
        <el-table-column label="有效期" width="270" align="center">
          <template #default="{ row }">{{ formatDate(row.notBefore) }} 至 {{ formatDate(row.notAfter) }}</template>
        </el-table-column>
        <el-table-column label="签发状态" width="100" align="center">
          <template #default="{ row }">{{ issueStatusLabel(row.issueStatus) }}</template>
        </el-table-column>
        <el-table-column label="分发状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="distributionTag(row.distributionStatus)" effect="plain">{{ row.distributionStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="邮件" width="96" align="center">
          <template #default="{ row }"><ChannelStatus :status="row.emailStatus" /></template>
        </el-table-column>
        <el-table-column label="钉钉" width="96" align="center">
          <template #default="{ row }"><ChannelStatus :status="row.dingtalkStatus" :blocked="row.emailStatus === 'FAILED'" /></template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="124" align="center">
          <template #default="{ row }">
            <CertRowAction label="查看详情" icon="View" @click="openDetail(row)" />
            <CertRowAction
              v-if="row.issueStatus === 'ISSUED'"
              v-hasPermi="['ra:employee-cert:distribute']"
              type="success"
              :label="row.distributionStatus === 'SENT' ? '重新分发' : '分发证书'"
              icon="Promotion"
              :disabled="row.distributionStatus === 'SENDING'"
              @click="distribute(row)"
            />
            <CertRowAction v-if="row.issueStatus === 'ISSUED' && row.raCertId != null"
              v-hasPermi="['ra:employee-cert:distribute']" label="下载证书 ZIP" icon="Download"
              :loading="downloadingCert === row.id" :disabled="downloadingCert != null" @click="downloadPackage(row)" />
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" :auto-scroll="false" @pagination="loadList" />
    </el-card>

    <template v-if="managementTab === 'distribution'">
      <el-card shadow="never" class="query-card">
        <el-form inline class="distribution-query" @submit.prevent="searchDistributionRecords()">
          <el-form-item label="任务号">
            <el-input v-model="distributionTaskNo" clearable maxlength="40" placeholder="请输入完整任务号" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" native-type="submit" icon="Search">搜索</el-button>
            <el-button icon="Refresh" @click="resetDistributionQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
      <el-card shadow="never" class="query-card">
        <template #header>
          <div class="distribution-heading">
            <strong>分发批次</strong>
            <el-button icon="Refresh" :loading="distributionRecordsLoading" @click="loadDistributionRecords()">刷新</el-button>
          </div>
        </template>
        <el-table v-loading="distributionRecordsLoading" :data="distributionBatches" row-key="batchNo"
          :current-row-key="activeDistributionBatchNo" highlight-current-row border stripe empty-text="暂无分发批次">
          <el-table-column label="分发时间" width="170"><template #default="{ row }">{{ formatDate(row.createTime) }}</template></el-table-column>
          <el-table-column label="批次号" prop="batchNo" min-width="250" show-overflow-tooltip />
          <el-table-column label="人数" prop="totalCount" width="70" />
          <el-table-column label="成功" prop="successCount" width="70" />
          <el-table-column label="失败" prop="failedCount" width="70" />
          <el-table-column label="处理中" width="90"><template #default="{ row }">{{ row.totalCount - row.successCount - row.failedCount }}</template></el-table-column>
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }"><CertRowAction label="查看分发明细" icon="View" @click="selectDistributionBatch(row.batchNo)" /></template>
          </el-table-column>
        </el-table>
        <pagination v-model:page="distributionPage.pageNum" v-model:limit="distributionPage.pageSize"
          :total="distributionTotal" :auto-scroll="false" @pagination="loadDistributionRecords" />
      </el-card>
      <el-card v-if="activeDistributionBatch" shadow="never">
        <template #header>
          <div class="distribution-heading">
            <strong ref="distributionDetailsHeading">分发明细 · {{ activeDistributionBatch.batchNo }}</strong>
            <span>共 {{ activeDistributionBatch.totalCount }} 人，成功 {{ activeDistributionBatch.successCount }}，失败 {{ activeDistributionBatch.failedCount }}，处理中 {{ activeDistributionBatch.totalCount - activeDistributionBatch.successCount - activeDistributionBatch.failedCount }}</span>
          </div>
        </template>
        <el-table v-loading="distributionRecordsLoading" :data="distributionRecords" border stripe empty-text="暂无本批明细">
          <el-table-column label="任务号" prop="taskNo" min-width="190" show-overflow-tooltip />
          <el-table-column label="员工" prop="employeeName" min-width="100" />
          <el-table-column label="域账号" prop="domainAccount" min-width="110" />
          <el-table-column label="分发结果" width="100"><template #default="{ row }"><el-tag :type="row.sendStatus === 1 ? 'success' : row.sendStatus === 2 ? 'danger' : 'warning'">{{ row.sendStatus === 1 ? '成功' : row.sendStatus === 2 ? '失败' : '处理中' }}</el-tag></template></el-table-column>
          <el-table-column label="邮件" min-width="90"><template #default="{ row }"><ChannelStatus :status="row.emailStatus" /></template></el-table-column>
          <el-table-column label="钉钉" min-width="90"><template #default="{ row }">{{ row.messageType === 'TEXT' ? '未发送' : '' }}<ChannelStatus v-if="row.messageType !== 'TEXT'" :status="row.dingtalkStatus" /></template></el-table-column>
          <el-table-column label="AD 公钥发布" min-width="110">未接入</el-table-column>
          <el-table-column label="失败原因" prop="errorMessage" min-width="190" show-overflow-tooltip />
          <el-table-column label="日志" width="80" align="center"><template #default="{ row }"><CertRowAction label="查看分发日志" icon="View" @click="openDetail({ id: row.certId })" /></template></el-table-column>
        </el-table>
      </el-card>
    </template>

    <DistributionDialog ref="distributionDialog" @submitted="onDistributionSubmitted" />
    <el-drawer v-model="detailOpen" title="员工证书详情" size="min(940px, 100vw)" append-to-body>
      <el-descriptions :column="1" border class="mb12">
        <el-descriptions-item label="序列号">{{ detail.cert?.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ detail.cert?.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ detail.cert?.employeeName || '-' }} / {{ detail.cert?.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室职位"
          >{{ detail.cert?.departmentPath || detail.cert?.departmentName || '-' }} / {{ detail.cert?.jobName || '-' }}</el-descriptions-item
        >
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签发模板">{{ detail.cert?.profileNameSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签发时间">{{ detail.cert?.issueTime ? formatDate(detail.cert.issueTime) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书密码">{{ detail.cert?.certPassword || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期"
          >{{ formatDate(detail.cert?.notBefore) }} 至 {{ formatDate(detail.cert?.notAfter) }}</el-descriptions-item
        >
        <el-descriptions-item label="分发状态">{{ detail.cert?.distributionStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮件"><ChannelStatus :status="detail.cert?.emailStatus" /></el-descriptions-item>
        <el-descriptions-item label="钉钉">
          <ChannelStatus :status="detail.cert?.dingtalkStatus" :blocked="detail.cert?.emailStatus === 'FAILED'" />
        </el-descriptions-item>
        <el-descriptions-item label="分发说明">{{ detail.cert?.distributionMessage || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-table :data="detail.logs || []" border stripe empty-text="暂无分发日志">
        <el-table-column label="渠道" width="120">
          <template #default="{ row }">{{ row.channel === 'EMAIL_TEXT' ? '纯文本邮件' : row.channel }}</template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="100" />
        <el-table-column label="日志编号" prop="id" min-width="130" show-overflow-tooltip />
        <el-table-column label="网关追踪 ID" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.gatewayTraceId || '-' }}</template>
        </el-table-column>
        <el-table-column label="接收人" prop="recipient" min-width="180" show-overflow-tooltip />
        <el-table-column label="说明" prop="message" min-width="220" show-overflow-tooltip />
        <el-table-column label="时间" width="166">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-dialog v-model="templateOpen" title="员工证书分发模板" width="940px" append-to-body>
      <el-table v-loading="templateLoading" :data="templates" border stripe>
        <el-table-column label="编码" prop="templateCode" width="170" />
        <el-table-column label="渠道" prop="channel" width="100" />
        <el-table-column label="消息类型" prop="messageType" width="120" />
        <el-table-column label="标题" prop="title" min-width="180" />
        <el-table-column label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="saveTemplate(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <CertRowAction label="编辑分发模板" icon="Edit" @click="editTemplate(row)" />
          </template>
        </el-table-column>
      </el-table>
      <el-form v-if="templateForm.templateCode" :model="templateForm" label-width="80px" class="template-form">
        <el-form-item label="标题">
          <el-input v-model="templateForm.title" />
        </el-form-item>
        <el-form-item label="消息类型">
          <el-select v-model="templateForm.messageType" style="width: 200px">
            <template v-if="templateForm.channel === 'EMAIL'">
              <el-option label="HTML及附件（MIXED）" value="MIXED" />
              <el-option label="纯文本无附件（TEXT）" value="TEXT" />
            </template>
            <template v-else>
              <el-option label="Markdown" value="markdown" />
              <el-option label="纯文本" value="text" />
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="templateForm.content" type="textarea" :rows="8" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveTemplate(templateForm)">保存模板</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="distributionConfigOpen" title="员工证书分发配置" width="720px" append-to-body>
      <el-alert class="mb12" type="warning" :closable="false" show-icon title="Secret Key 仅允许写入，不会回显；留空保存将保留已有 Secret。" />
      <el-form :model="distributionConfig" label-width="150px">
        <el-form-item label="邮件服务地址">
          <el-input v-model="distributionConfig.emailServerUrl" placeholder="https://api.example.com/cmp/mail/v2/send" />
        </el-form-item>
        <el-form-item label="钉钉服务地址">
          <el-input v-model="distributionConfig.dingtalkServerUrl" placeholder="https://api.example.com/cmp/dingtalk/v1/sendMessage" />
        </el-form-item>
        <el-form-item label="App Key">
          <el-input v-model="distributionConfig.appKey" autocomplete="off" />
        </el-form-item>
        <el-form-item label="Secret Key">
          <el-input
            v-model="distributionConfig.secretKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="distributionConfig.secretKeyConfigured ? '已配置，留空保持不变' : '请输入 Secret Key'"
          />
        </el-form-item>
        <el-form-item label="发件邮箱">
          <el-input v-model="distributionConfig.emailAccount" placeholder="例如 cybersec@faw-vw.com" />
        </el-form-item>
        <el-form-item label="邮件服务器标识">
          <el-input v-model="distributionConfig.smtpServer" placeholder="CC" />
        </el-form-item>
        <el-form-item label="钉钉应用标识">
          <el-input v-model="distributionConfig.dingtalkApp" placeholder="例如 FawVW" />
        </el-form-item>
        <el-form-item label="附件最大大小">
          <el-input-number v-model="distributionConfig.attachmentMaxSizeMb" :min="1" :max="100" />
          <span class="unit-label">MB</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="distributionConfigOpen = false">取消</el-button>
        <el-button type="primary" :loading="distributionConfigSaving" @click="saveDistributionConfig">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployeeCert" lang="ts">
import CertRowAction from '../components/CertRowAction.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import { computed, nextTick, ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import FileSaver from 'file-saver';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';
import auth from '@/plugins/auth';
import ChannelStatus from './ChannelStatus.vue';
import DistributionDialog from './DistributionDialog.vue';
import {
  DistributionLog,
  EmployeeCert,
  EmployeeDistributionBatch,
  EmployeeDistributionBatchItem,
  EmployeeCertDistributionConfig,
  EmployeeCertTemplate,
  downloadEmployeeCertPackage,
  getEmployeeCertDistributionConfig,
  getEmployeeCert,
  getEmployeeDistributionBatch,
  pageEmployeeDistributionBatches,
  listEmployeeCertTemplates,
  pageEmployeeCerts,
  saveEmployeeCertDistributionConfig,
  saveEmployeeCertTemplate
} from '@/api/ra/employeeCert';

const loading = ref(false);
const managementTab = ref<'ledger' | 'distribution'>('ledger');
const showSearch = ref(true);
const rows = ref<EmployeeCert[]>([]);
const selectedRows = ref<EmployeeCert[]>([]);
const canDistribute = computed(() => auth.hasPermi('ra:employee-cert:distribute'));
const total = ref(0);
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  taskNo: '',
  serialNumber: '',
  domainAccount: '',
  employeeName: '',
  certTypeCode: '',
  distributionStatus: ''
});
const appliedFilters = ref(certFilters());
const taskForDistribution = computed(() => {
  const { taskNo, ...otherFilters } = appliedFilters.value;
  return total.value > 0 && !Object.values(otherFilters).some(Boolean) ? taskNo : '';
});
const issueStatusLabel = (status?: string) => ({
  PENDING: '待签发', READY_FOR_ISSUE: '待签发', PRECHECKED: '待签发', ISSUING: '签发中', ISSUED: '签发成功', FAILED: '签发失败'
} as Record<string, string>)[status || ''] || status || '-';

const detailOpen = ref(false);
const detail = ref<{ cert?: EmployeeCert; logs?: DistributionLog[] }>({});
const templateOpen = ref(false);
const templateLoading = ref(false);
const templates = ref<EmployeeCertTemplate[]>([]);
const templateForm = reactive<EmployeeCertTemplate>({
  templateCode: '',
  channel: '',
  messageType: '',
  title: '',
  content: '',
  enabled: true
});
const distributionConfigOpen = ref(false);
const distributionConfigSaving = ref(false);
const distributionConfig = reactive<EmployeeCertDistributionConfig>({
  emailServerUrl: '',
  dingtalkServerUrl: '',
  appKey: '',
  secretKey: '',
  emailAccount: '',
  dingtalkApp: '',
  attachmentMaxSizeMb: 10,
  secretKeyConfigured: false
});
const distributionDialog = ref<InstanceType<typeof DistributionDialog>>();
const distributionRecordsLoading = ref(false);
const distributionRecords = ref<EmployeeDistributionBatchItem[]>([]);
const distributionBatches = ref<EmployeeDistributionBatch[]>([]);
const distributionTotal = ref(0);
const distributionPage = reactive({ pageNum: 1, pageSize: 10 });
const distributionDetailsHeading = ref<HTMLElement>();
const distributionTaskNo = ref('');
const appliedDistributionTaskNo = ref('');
const activeDistributionBatchNo = ref('');
const activeDistributionBatch = computed(() => distributionBatches.value.find(row => row.batchNo === activeDistributionBatchNo.value));
const downloadingCert = ref<EmployeeCert['id']>();
let distributionTimer: ReturnType<typeof setTimeout> | undefined;
let pageDisposed = false;
let listRequest = 0;
let distributionRecordsRequest = 0;

function watchDistribution() {
  if (distributionTimer || pageDisposed) return;
  distributionTimer = setTimeout(async () => {
    distributionTimer = undefined;
    try {
      const page = unwrapData<any>(await pageEmployeeCerts({ pageNum: 1, pageSize: 1, distributionStatus: 'SENDING' }));
      if (pageDisposed) return;
      await refreshCurrentTab();
      if (detailOpen.value && detail.value.cert?.id) detail.value = unwrapData<any>(await getEmployeeCert(detail.value.cert.id));
      if (Number(page?.total || 0) > 0) watchDistribution();
    } catch {
      if (!pageDisposed) ElMessage.warning('分发进度查询失败，请刷新查看渠道结果');
    }
  }, 3000);
}

function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function loadList() {
  const request = ++listRequest;
  loading.value = true;
  try {
    const page = unwrapData<any>(await pageEmployeeCerts({
      ...appliedFilters.value, pageNum: queryParams.pageNum, pageSize: queryParams.pageSize
    }));
    if (request !== listRequest || pageDisposed) return;
    rows.value = page?.rows || page?.records || [];
    total.value = Number(page?.total || 0);
    if (rows.value.some((row) => row.distributionStatus === 'SENDING')) watchDistribution();
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

function certFilters() {
  return {
    taskNo: queryParams.taskNo.trim(),
    serialNumber: queryParams.serialNumber.trim(),
    domainAccount: queryParams.domainAccount.trim(),
    employeeName: queryParams.employeeName.trim(),
    certTypeCode: queryParams.certTypeCode,
    distributionStatus: queryParams.distributionStatus
  };
}

function handleQuery() {
  appliedFilters.value = certFilters();
  total.value = 0;
  rows.value = [];
  selectedRows.value = [];
  queryParams.pageNum = 1;
  return loadList();
}

function resetQuery() {
  queryParams.taskNo = '';
  queryParams.serialNumber = '';
  queryParams.domainAccount = '';
  queryParams.employeeName = '';
  queryParams.certTypeCode = '';
  queryParams.distributionStatus = '';
  return handleQuery();
}

async function openDetail(row: Pick<EmployeeCert, 'id'>) {
  detail.value = unwrapData<any>(await getEmployeeCert(row.id));
  detailOpen.value = true;
}

function canSelectForDistribution(row: EmployeeCert) {
  return row.issueStatus === 'ISSUED' && row.raCertId != null && !['SENT', 'SENDING'].includes(row.distributionStatus);
}

function distributeSelected() {
  const ids = selectedRows.value.filter(canSelectForDistribution).map((row) => row.id);
  if (ids.length) distributionDialog.value?.open({ ids }, `所选 ${ids.length} 张证书对应的员工`);
}

function distributeTask() {
  const taskNo = taskForDistribution.value;
  if (!taskNo || loading.value || !canDistribute.value) return;
  distributionDialog.value?.open({ taskNo }, `任务 ${taskNo} 全部已签发且待分发的证书（含其他页）`);
}

function distribute(row: EmployeeCert) {
  const resend = row.distributionStatus === 'SENT';
  distributionDialog.value?.open({ ids: [row.id], resend }, `${row.employeeName}（${row.domainAccount}）${resend ? '，重新发送' : ''}`);
}

async function downloadPackage(row: EmployeeCert) {
  if (downloadingCert.value != null) return;
  downloadingCert.value = row.id;
  try {
    const blob = await certificateDownloadBlob(await downloadEmployeeCertPackage(row.id), 'application/zip');
    FileSaver.saveAs(blob, `employee-cert-${row.id}.zip`);
  } catch (error: any) {
    ElMessage.error(error?.message || '证书压缩包下载失败');
  } finally {
    downloadingCert.value = undefined;
  }
}

async function loadDistributionRecords() {
  const request = ++distributionRecordsRequest;
  const taskNo = appliedDistributionTaskNo.value;
  distributionRecordsLoading.value = true;
  try {
    const page = unwrapData<{ records: EmployeeDistributionBatch[]; total: number }>(
      await pageEmployeeDistributionBatches({ ...distributionPage, taskNo: taskNo || undefined })
    );
    if (request !== distributionRecordsRequest || pageDisposed) return;
    const batches = page?.records || [];
    distributionTotal.value = Number(page?.total || 0);
    const batch = batches.find(row => row.batchNo === activeDistributionBatchNo.value) || batches[0];
    distributionBatches.value = batches;
    if (activeDistributionBatchNo.value !== (batch?.batchNo || '')) distributionRecords.value = [];
    activeDistributionBatchNo.value = batch?.batchNo || '';
    const records = batch ? unwrapData<EmployeeDistributionBatchItem[]>(await getEmployeeDistributionBatch(batch.batchNo)) || [] : [];
    if (request !== distributionRecordsRequest || pageDisposed) return;
    distributionRecords.value = taskNo ? records.filter(row => row.taskNo?.toLowerCase() === taskNo.toLowerCase()) : records;
    if (batch && managementTab.value === 'distribution' && batch.totalCount > batch.successCount + batch.failedCount) watchDistribution();
  } finally {
    if (request === distributionRecordsRequest) distributionRecordsLoading.value = false;
  }
}

async function selectDistributionBatch(batchNo: string) {
  if (activeDistributionBatchNo.value !== batchNo) distributionRecords.value = [];
  activeDistributionBatchNo.value = batchNo;
  const loadingRecords = loadDistributionRecords();
  await nextTick();
  distributionDetailsHeading.value?.scrollIntoView({ block: 'nearest' });
  await loadingRecords;
}

function searchDistributionRecords() {
  appliedDistributionTaskNo.value = distributionTaskNo.value.trim();
  distributionPage.pageNum = 1;
  activeDistributionBatchNo.value = '';
  distributionBatches.value = [];
  distributionRecords.value = [];
  return loadDistributionRecords();
}

function resetDistributionQuery() {
  distributionTaskNo.value = '';
  return searchDistributionRecords();
}

function onDistributionSubmitted(_selection: unknown, _messageType: unknown, batchNo?: string) {
  distributionTaskNo.value = '';
  appliedDistributionTaskNo.value = '';
  distributionPage.pageNum = 1;
  distributionRecords.value = [];
  activeDistributionBatchNo.value = batchNo || '';
  managementTab.value = 'distribution';
  watchDistribution();
}

function refreshCurrentTab() {
  return managementTab.value === 'distribution' ? loadDistributionRecords() : loadList();
}

function handleExport() {
  const header = ['序列号', '主题', '姓名', '域账号', '科室', '职位', '证书类型', '生效时间', '到期时间', '分发状态', '签发模板'];
  const lines = rows.value.map((row) =>
    [
      row.serialNumber,
      row.subject,
      row.employeeName,
      row.domainAccount,
      row.departmentName,
      row.jobName,
      row.certTypeName,
      formatDate(row.notBefore),
      formatDate(row.notAfter),
      row.distributionStatusName,
      row.profileNameSnapshot
    ]
      .map(csvCell)
      .join(',')
  );
  FileSaver.saveAs(
    new Blob(['\uFEFF' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }),
    `fawvw_employee_certs_${Date.now()}.csv`
  );
}

async function openTemplates() {
  templateOpen.value = true;
  templateLoading.value = true;
  try {
    templates.value = unwrapData<EmployeeCertTemplate[]>(await listEmployeeCertTemplates()) || [];
  } finally {
    templateLoading.value = false;
  }
}

function editTemplate(row: EmployeeCertTemplate) {
  Object.assign(templateForm, {
    ...row,
    messageType: row.messageType || (row.channel === 'DINGTALK' ? 'markdown' : 'MIXED')
  });
}

async function saveTemplate(row: EmployeeCertTemplate) {
  await saveEmployeeCertTemplate(row);
  ElMessage.success('模板已保存');
  openTemplates();
}

async function openDistributionConfig() {
  const config = unwrapData<EmployeeCertDistributionConfig>(await getEmployeeCertDistributionConfig());
  Object.assign(distributionConfig, {
    emailServerUrl: '',
    dingtalkServerUrl: '',
    appKey: '',
    emailAccount: '',
    dingtalkApp: '',
    attachmentMaxSizeMb: 10,
    secretKeyConfigured: false,
    ...config,
    secretKey: ''
  });
  distributionConfigOpen.value = true;
}

async function saveDistributionConfig() {
  distributionConfigSaving.value = true;
  try {
    const saved = unwrapData<EmployeeCertDistributionConfig>(
      await saveEmployeeCertDistributionConfig({
        emailServerUrl: distributionConfig.emailServerUrl,
        dingtalkServerUrl: distributionConfig.dingtalkServerUrl,
        appKey: distributionConfig.appKey,
        secretKey: distributionConfig.secretKey,
        emailAccount: distributionConfig.emailAccount,
        dingtalkApp: distributionConfig.dingtalkApp,
        attachmentMaxSizeMb: distributionConfig.attachmentMaxSizeMb,
        smtpServer: distributionConfig.smtpServer
      })
    );
    Object.assign(distributionConfig, saved, { secretKey: '' });
    ElMessage.success('分发配置已保存');
    distributionConfigOpen.value = false;
  } finally {
    distributionConfigSaving.value = false;
  }
}

function distributionTag(status?: string) {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    SENT: 'success',
    PENDING: 'warning',
    SENDING: 'info',
    FAILED: 'danger'
  };
  return map[status || ''] || 'info';
}

function csvCell(value: any) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

onMounted(loadList);
watch(managementTab, refreshCurrentTab);
onUnmounted(() => {
  pageDisposed = true;
  if (distributionTimer) clearTimeout(distributionTimer);
});
useRaListRefreshOnReturn(refreshCurrentTab);
</script>

<style scoped>
.query-card {
  margin-bottom: 12px;
}

.distribution-query {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.distribution-query :deep(.el-form-item) {
  margin: 0;
}

.distribution-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.distribution-heading strong {
  overflow-wrap: anywhere;
}

.query-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  align-items: center;
  gap: 12px 16px;
}

.query-form :deep(.el-form-item) {
  min-width: 0;
  margin: 0;
}

.query-form :deep(.el-form-item__label) {
  white-space: nowrap;
}

.query-form :deep(.el-form-item__content) {
  min-width: 0;
}

.query-form :deep(.el-input),
.query-form :deep(.el-select) {
  width: 100%;
}

.query-actions {
  display: flex;
  justify-content: flex-end;
  grid-column-end: -1;
}

.mb8 {
  margin-bottom: 8px;
}

.mb12 {
  margin-bottom: 12px;
}

.ml4 {
  margin-left: 4px;
}

.unit-label {
  margin-left: 8px;
  color: var(--el-text-color-regular);
}

.template-form {
  margin-top: 16px;
}

.hidden-file {
  display: none;
}
</style>
