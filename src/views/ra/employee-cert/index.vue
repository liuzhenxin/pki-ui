<template>
  <div class="app-container employee-cert-page">
    <el-card shadow="never" class="query-card">
      <el-form :model="queryParams" inline>
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="证书序列号" style="width: 190px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="域账号">
          <el-input v-model="queryParams.domainAccount" clearable placeholder="域账号" style="width: 150px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="queryParams.employeeName" clearable placeholder="员工姓名" style="width: 150px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书类型">
          <el-select v-model="queryParams.certTypeCode" clearable placeholder="全部" style="width: 150px">
            <el-option label="签名证书" value="SIGN" />
            <el-option label="邮件加密证书" value="EMAIL" />
            <el-option label="WiFi证书" value="WIFI" />
          </el-select>
        </el-form-item>
        <el-form-item label="分发状态">
          <el-select v-model="queryParams.distributionStatus" clearable placeholder="全部" style="width: 130px">
            <el-option label="待分发" value="PENDING" />
            <el-option label="已分发" value="SENT" />
            <el-option label="发送失败" value="FAILED" />
            <el-option label="发送中" value="SENDING" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8">
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

      <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无员工证书台账">
        <el-table-column label="序列号" prop="serialNumber" min-width="170" fixed show-overflow-tooltip />
        <el-table-column label="主题" prop="subject" min-width="260" show-overflow-tooltip />
        <el-table-column label="姓名" prop="employeeName" width="110" />
        <el-table-column label="域账号" prop="domainAccount" width="120" />
        <el-table-column label="科室" prop="departmentName" min-width="150" show-overflow-tooltip />
        <el-table-column label="职位" prop="jobName" min-width="130" show-overflow-tooltip />
        <el-table-column label="证书类型" prop="certTypeName" width="130" />
        <el-table-column label="密码" prop="certPassword" width="130" show-overflow-tooltip />
        <el-table-column label="有效期" width="270" align="center">
          <template #default="{ row }">{{ formatDate(row.notBefore) }} 至 {{ formatDate(row.notAfter) }}</template>
        </el-table-column>
        <el-table-column label="分发状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="distributionTag(row.distributionStatus)" effect="plain">{{ row.distributionStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发送结果" width="138" align="center">
          <template #default="{ row }">
            <el-tag :type="row.emailStatus === 'SENT' ? 'success' : 'info'" effect="plain">邮件 {{ channelName(row.emailStatus) }}</el-tag>
            <el-tag :type="row.dingtalkStatus === 'SENT' ? 'success' : 'info'" effect="plain" class="ml4"
              >钉钉 {{ channelName(row.dingtalkStatus) }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="210" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="View" @click="openDetail(row)" />
            <el-button
              v-if="row.issueStatus === 'ISSUED'"
              v-hasPermi="['ra:employee-cert:distribute']"
              link
              type="success"
              icon="Promotion"
              :disabled="row.distributionStatus === 'SENDING' || submittingDistribution"
              @click="distribute(row)"
            >
              {{ row.distributionStatus === 'SENT' ? '重发' : '分发' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <el-drawer v-model="detailOpen" title="员工证书详情" size="720px" append-to-body>
      <el-descriptions :column="1" border class="mb12">
        <el-descriptions-item label="序列号">{{ detail.cert?.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ detail.cert?.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ detail.cert?.employeeName || '-' }} / {{ detail.cert?.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室职位"
          >{{ detail.cert?.departmentPath || detail.cert?.departmentName || '-' }} / {{ detail.cert?.jobName || '-' }}</el-descriptions-item
        >
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书密码">{{ detail.cert?.certPassword || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期"
          >{{ formatDate(detail.cert?.notBefore) }} 至 {{ formatDate(detail.cert?.notAfter) }}</el-descriptions-item
        >
        <el-descriptions-item label="分发状态">{{ detail.cert?.distributionStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="分发说明">{{ detail.cert?.distributionMessage || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-table :data="detail.logs || []" border stripe empty-text="暂无分发日志">
        <el-table-column label="渠道" prop="channel" width="110" />
        <el-table-column label="状态" prop="status" width="100" />
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
            <el-button link type="primary" icon="Edit" @click="editTemplate(row)" />
          </template>
        </el-table-column>
      </el-table>
      <el-form v-if="templateForm.templateCode" :model="templateForm" label-width="80px" class="template-form">
        <el-form-item label="标题">
          <el-input v-model="templateForm.title" />
        </el-form-item>
        <el-form-item label="消息类型">
          <el-select v-model="templateForm.messageType" style="width: 200px">
            <el-option v-if="templateForm.channel === 'EMAIL'" label="HTML及附件（MIXED）" value="MIXED" />
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
        <el-form-item label="安装指引（HTML）">
          <el-input v-model="distributionConfig.guideHtml" type="textarea" :rows="8" />
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
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import FileSaver from 'file-saver';
import {
  distributeEmployeeCert,
  DistributionLog,
  EmployeeCert,
  EmployeeCertDistributionConfig,
  EmployeeCertTemplate,
  getEmployeeCertDistributionConfig,
  getEmployeeCert,
  listEmployeeCertTemplates,
  pageEmployeeCerts,
  saveEmployeeCertDistributionConfig,
  saveEmployeeCertTemplate
} from '@/api/ra/employeeCert';

const loading = ref(false);
const showSearch = ref(true);
const rows = ref<EmployeeCert[]>([]);
const total = ref(0);
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  serialNumber: '',
  domainAccount: '',
  employeeName: '',
  certTypeCode: '',
  distributionStatus: ''
});

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
const submittingDistribution = ref(false);
let distributionTimer: ReturnType<typeof setTimeout> | undefined;
let pageDisposed = false;

function watchDistribution() {
  if (distributionTimer || pageDisposed) return;
  distributionTimer = setTimeout(async () => {
    distributionTimer = undefined;
    try {
      const page = unwrapData<any>(await pageEmployeeCerts({ pageNum: 1, pageSize: 1, distributionStatus: 'SENDING' }));
      if (pageDisposed) return;
      await loadList();
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
  loading.value = true;
  try {
    const page = unwrapData<any>(await pageEmployeeCerts(queryParams));
    rows.value = page?.rows || page?.records || [];
    total.value = Number(page?.total || 0);
    if (rows.value.some((row) => row.distributionStatus === 'SENDING')) watchDistribution();
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}

function resetQuery() {
  queryParams.serialNumber = '';
  queryParams.domainAccount = '';
  queryParams.employeeName = '';
  queryParams.certTypeCode = '';
  queryParams.distributionStatus = '';
  handleQuery();
}

async function openDetail(row: EmployeeCert) {
  detail.value = unwrapData<any>(await getEmployeeCert(row.id));
  detailOpen.value = true;
}

async function distribute(row: EmployeeCert) {
  await ElMessageBox.confirm(`确认${row.distributionStatus === 'SENT' ? '重新' : ''}分发 ${row.employeeName} 的证书？`, '分发确认', {
    type: 'warning'
  });
  submittingDistribution.value = true;
  try {
    await distributeEmployeeCert(row.id);
    ElMessage.info('分发任务已提交');
    await loadList();
    watchDistribution();
  } finally {
    submittingDistribution.value = false;
  }
}

function handleExport() {
  const header = ['序列号', '主题', '姓名', '域账号', '科室', '职位', '证书类型', '生效时间', '到期时间', '分发状态'];
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
      row.distributionStatusName
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
        smtpServer: distributionConfig.smtpServer,
        guideHtml: distributionConfig.guideHtml
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

function channelName(status?: string) {
  return status === 'SENT' ? '已受理' : status === 'FAILED' ? '失败' : '待发';
}

function csvCell(value: any) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

onMounted(loadList);
onUnmounted(() => {
  pageDisposed = true;
  if (distributionTimer) clearTimeout(distributionTimer);
});
</script>

<style scoped>
.query-card {
  margin-bottom: 12px;
}

.table-card {
  min-height: 620px;
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
