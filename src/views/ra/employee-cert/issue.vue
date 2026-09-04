<template>
  <div class="app-container employee-cert-issue-page">
    <el-row :gutter="14">
      <el-col :span="10">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>员工证书制作</span>
              <el-tag type="info" effect="plain">批量</el-tag>
            </div>
          </template>
          <el-form label-width="96px">
            <el-form-item label="证书用途">
              <el-input model-value="员工邮件证书" disabled />
            </el-form-item>
            <el-form-item label="签发模板">
              <el-select v-model="form.profileKey" filterable placeholder="请选择已准入的CA模板" style="width: 100%">
                <el-option
                  v-for="item in eligibleProfiles"
                  :key="profileKey(item)"
                  :label="`${item.rootName} / ${item.profileName}`"
                  :value="profileKey(item)"
                />
              </el-select>
              <div class="field-hint">模板来自当前CA同步结果；签发前会再次校验授权和模板是否变更。</div>
            </el-form-item>
            <el-form-item label="有效期">
              <el-date-picker
                v-model="dateRange"
                type="datetimerange"
                value-format="YYYY-MM-DDTHH:mm:ss"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="域账号">
              <el-input v-model="form.accounts" type="textarea" :rows="7" placeholder="多个域账号用分号分隔，例如：vw00001;vw00002" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="form.remark" clearable placeholder="制作说明" />
            </el-form-item>
            <el-form-item>
              <input ref="fileInputRef" class="hidden-file" type="file" accept=".xlsx,.csv,.txt" @change="handleFileChange" />
              <el-button icon="Upload" @click="fileInputRef?.click()">上传名单</el-button>
              <el-button icon="Download" @click="downloadTemplate">模板</el-button>
              <el-button v-hasPermi="['ra:employee-cert:template']" icon="Setting" @click="openProfilePolicy">模板准入</el-button>
              <el-button type="primary" icon="Search" :loading="resolving" @click="resolveAccounts">查询确认</el-button>
              <el-button
                type="success"
                icon="Finished"
                :disabled="selectedEmployees.length === 0 || missingAccounts.length > 0"
                :loading="creating"
                @click="createTask"
              >
                生成制作任务
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            v-if="missingAccounts.length > 0"
            type="error"
            show-icon
            :closable="false"
            class="mb12"
            :title="`以下域账号不在员工同步数据中：${missingAccounts.join('；')}`"
          />

          <el-table v-loading="resolving" :data="selectedEmployees" border stripe height="360" empty-text="请先查询员工">
            <el-table-column label="姓名" prop="cnName" min-width="100" />
            <el-table-column label="域账号" prop="domainAccount" min-width="110" />
            <el-table-column label="科室" prop="departmentName" min-width="140" show-overflow-tooltip />
            <el-table-column label="岗位" prop="jobName" min-width="120" show-overflow-tooltip />
            <el-table-column label="状态" width="82" align="center">
              <template #default="{ row }">
                <el-tag :type="row.sourceStatus === 'A' ? 'success' : 'danger'" effect="plain">{{
                  row.sourceStatus === 'A' ? '在职' : '非在职'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="公钥" width="84" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" icon="Key" @click="openKeys(row)" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="card-header">
              <span>制作任务</span>
              <el-button icon="Refresh" link @click="loadTasks">刷新</el-button>
            </div>
          </template>
          <el-form :model="taskQuery" inline>
            <el-form-item label="任务号">
              <el-input v-model="taskQuery.taskNo" clearable placeholder="任务号" style="width: 180px" @keyup.enter="loadTasks" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="loadTasks">搜索</el-button>
            </el-form-item>
          </el-form>
          <el-table v-loading="taskLoading" :data="tasks" border stripe height="486" empty-text="暂无制作任务">
            <el-table-column label="任务号" prop="taskNo" min-width="170" show-overflow-tooltip />
            <el-table-column label="证书类型" prop="certTypeName" width="130" />
            <el-table-column label="人数" width="88" align="center">
              <template #default="{ row }">{{ row.successCount }}/{{ row.totalCount }}</template>
            </el-table-column>
            <el-table-column label="状态" width="96" align="center">
              <template #default="{ row }">
                <el-tag :type="row.taskStatus === 'DISTRIBUTED' ? 'success' : 'warning'" effect="plain">{{
                  row.taskStatusName || row.taskStatus
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="166" align="center">
              <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" icon="View" @click="openTask(row)" />
                <el-button
                  v-if="row.taskStatus === 'ISSUED' || row.taskStatus === 'PARTIAL_FAILED'"
                  v-hasPermi="['ra:employee-cert:distribute']"
                  link
                  type="success"
                  icon="Promotion"
                  @click="distributeTask(row)"
                />
              </template>
            </el-table-column>
          </el-table>
          <pagination
            v-show="taskTotal > 0"
            v-model:page="taskQuery.pageNum"
            v-model:limit="taskQuery.pageSize"
            :total="taskTotal"
            @pagination="loadTasks"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-drawer v-model="taskOpen" title="制作任务详情" size="860px" append-to-body>
      <el-descriptions :column="2" border class="mb12">
        <el-descriptions-item label="任务号">{{ taskDetail.task?.taskNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ taskDetail.task?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签发模板">{{ taskDetail.task?.profileNameSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item label="任务状态">{{ taskDetail.task?.taskStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="人数">{{ taskDetail.task?.successCount || 0 }}/{{ taskDetail.task?.totalCount || 0 }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="taskDetail.certs || []" border stripe>
        <el-table-column label="姓名" prop="employeeName" width="110" />
        <el-table-column label="域账号" prop="domainAccount" width="120" />
        <el-table-column label="序列号" prop="serialNumber" min-width="170" show-overflow-tooltip />
        <el-table-column label="签发状态" prop="issueStatus" width="110" />
        <el-table-column label="分发状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.distributionStatus === 'SENT' ? 'success' : 'warning'" effect="plain">{{ row.distributionStatusName }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-dialog v-model="profilePolicyOpen" title="员工邮件证书模板准入" width="920px" append-to-body>
      <el-alert
        title="仅启用已核对用途的模板。CA同步后模板取消授权或变更时，创建任务和签发前都会重新校验。"
        type="warning"
        :closable="false"
        class="mb12"
      />
      <el-table :data="emailProfiles" border stripe max-height="440">
        <el-table-column label="根证书" prop="rootName" min-width="170" />
        <el-table-column label="CA模板" prop="profileName" min-width="220" />
        <el-table-column label="模板类型" prop="profileType" width="120" />
        <el-table-column label="更新时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.profileUpdatedTime) }}</template>
        </el-table-column>
        <el-table-column label="允许员工邮件证书" width="180" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(value) => saveProfilePolicy(row, Boolean(value))" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="keyOpen" title="员工公钥" width="860px" append-to-body>
      <el-descriptions :column="3" border class="mb12">
        <el-descriptions-item label="姓名">{{ currentEmployee?.cnName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域账号">{{ currentEmployee?.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ currentEmployee?.departmentName || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-table v-loading="keyLoading" :data="keys" border stripe max-height="260" empty-text="暂无公钥">
        <el-table-column label="公钥名称" prop="keyName" min-width="140" />
        <el-table-column label="算法" prop="keyAlgorithm" width="90" />
        <el-table-column label="来源" prop="keySource" width="110" />
        <el-table-column label="创建时间" prop="createTime" width="166">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
      </el-table>
      <el-divider content-position="left">新增公钥</el-divider>
      <el-form :model="keyForm" label-width="86px">
        <el-form-item label="名称">
          <el-input v-model="keyForm.keyName" clearable placeholder="例如：邮件加密公钥" />
        </el-form-item>
        <el-form-item label="算法">
          <el-select v-model="keyForm.keyAlgorithm" style="width: 160px">
            <el-option label="RSA" value="RSA" />
            <el-option label="SM2" value="SM2" />
            <el-option label="ECC" value="ECC" />
          </el-select>
        </el-form-item>
        <el-form-item label="公钥">
          <el-input v-model="keyForm.publicKey" type="textarea" :rows="5" placeholder="只录入公钥，不展示或录入私钥" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keyOpen = false">关闭</el-button>
        <el-button type="primary" :loading="keySaving" @click="saveKey">保存公钥</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployeeCertIssue" lang="ts">
import FileSaver from 'file-saver';
import {
  createEmployeeCertTask,
  distributeEmployeeCertTask,
  downloadEmployeeCertAccountTemplate,
  EmployeeCertEmployee,
  EmployeeEmailCertProfile,
  EmployeeCertKey,
  EmployeeCertTask,
  EmployeeCertTaskDetail,
  getEmployeeCertTask,
  importEmployeeCertAccounts,
  listEmployeeEmailCertProfiles,
  listEmployeeCertKeys,
  pageEmployeeCertTasks,
  resolveEmployeeCertAccounts,
  saveEmployeeEmailCertProfilePolicy,
  saveEmployeeCertKey
} from '@/api/ra/employeeCert';

const form = reactive({
  accounts: '',
  profileKey: '',
  remark: ''
});
const dateRange = ref<string[]>([]);
const fileInputRef = ref<HTMLInputElement>();
const resolving = ref(false);
const creating = ref(false);
const selectedEmployees = ref<EmployeeCertEmployee[]>([]);
const missingAccounts = ref<string[]>([]);
const emailProfiles = ref<EmployeeEmailCertProfile[]>([]);
const profilePolicyOpen = ref(false);
const eligibleProfiles = computed(() => emailProfiles.value.filter((item) => item.enabled));

const taskLoading = ref(false);
const tasks = ref<EmployeeCertTask[]>([]);
const taskTotal = ref(0);
const taskQuery = reactive({ pageNum: 1, pageSize: 10, taskNo: '', certTypeCode: 'EMAIL' });
const taskOpen = ref(false);
const taskDetail = ref<Partial<EmployeeCertTaskDetail>>({ certs: [] });

const keyOpen = ref(false);
const keyLoading = ref(false);
const keySaving = ref(false);
const currentEmployee = ref<EmployeeCertEmployee>();
const keys = ref<EmployeeCertKey[]>([]);
const keyForm = reactive({ keyName: '', keyAlgorithm: 'RSA', publicKey: '' });

function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function resolveAccounts() {
  resolving.value = true;
  try {
    const data = unwrapData<any>(await resolveEmployeeCertAccounts(form.accounts));
    selectedEmployees.value = data?.employees || [];
    missingAccounts.value = data?.missingAccounts || [];
  } finally {
    resolving.value = false;
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  resolving.value = true;
  try {
    const data = unwrapData<any>(await importEmployeeCertAccounts(file));
    selectedEmployees.value = data?.employees || [];
    missingAccounts.value = data?.missingAccounts || [];
    form.accounts = selectedEmployees.value.map((item) => item.domainAccount).join(';');
  } finally {
    resolving.value = false;
  }
}

async function downloadTemplate() {
  const response: any = await downloadEmployeeCertAccountTemplate();
  const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data || response]);
  FileSaver.saveAs(blob, 'employee-cert-accounts.csv');
}

async function createTask() {
  if (missingAccounts.value.length > 0) {
    ElMessage.error('存在未同步员工，不能制作证书');
    return;
  }
  const profile = eligibleProfiles.value.find((item) => profileKey(item) === form.profileKey);
  if (!profile) {
    ElMessage.error('请选择已准入的签发模板');
    return;
  }
  creating.value = true;
  try {
    const detail = unwrapData<EmployeeCertTaskDetail>(
      await createEmployeeCertTask({
        accounts: selectedEmployees.value.map((item) => item.domainAccount).join(';'),
        rootId: profile.rootId,
        profileId: profile.profileId,
        notBefore: dateRange.value?.[0],
        notAfter: dateRange.value?.[1],
        selectionMode: 'ACCOUNT',
        remark: form.remark
      })
    );
    ElMessage.success('邮件证书任务已生成，待CA签发链路处理');
    taskDetail.value = detail;
    taskOpen.value = true;
    loadTasks();
  } finally {
    creating.value = false;
  }
}

function profileKey(item: EmployeeEmailCertProfile) {
  return `${item.rootId}:${item.profileId}`;
}

async function loadEmailProfiles() {
  emailProfiles.value = unwrapData<EmployeeEmailCertProfile[]>(await listEmployeeEmailCertProfiles()) || [];
  if (!form.profileKey && eligibleProfiles.value.length === 1) {
    form.profileKey = profileKey(eligibleProfiles.value[0]);
  }
}

async function openProfilePolicy() {
  await loadEmailProfiles();
  profilePolicyOpen.value = true;
}

async function saveProfilePolicy(row: EmployeeEmailCertProfile, enabled: boolean) {
  await saveEmployeeEmailCertProfilePolicy({ rootId: row.rootId, profileId: row.profileId, enabled });
  row.enabled = enabled;
  ElMessage.success(enabled ? '已纳入员工邮件证书模板池' : '已移出员工邮件证书模板池');
}

async function loadTasks() {
  taskLoading.value = true;
  try {
    const page = unwrapData<any>(await pageEmployeeCertTasks(taskQuery));
    tasks.value = page?.rows || page?.records || [];
    taskTotal.value = Number(page?.total || 0);
  } finally {
    taskLoading.value = false;
  }
}

async function openTask(row: EmployeeCertTask) {
  taskDetail.value = unwrapData<EmployeeCertTaskDetail>(await getEmployeeCertTask(row.taskNo));
  taskOpen.value = true;
}

async function distributeTask(row: EmployeeCertTask) {
  await ElMessageBox.confirm('确认分发该任务下所有未分发的员工证书？', '分发确认', { type: 'warning' });
  taskDetail.value = unwrapData<EmployeeCertTaskDetail>(await distributeEmployeeCertTask(row.taskNo));
  ElMessage.success('分发完成');
  taskOpen.value = true;
  loadTasks();
}

async function openKeys(row: EmployeeCertEmployee) {
  currentEmployee.value = row;
  keyOpen.value = true;
  await loadKeys();
}

async function loadKeys() {
  if (!currentEmployee.value) {
    return;
  }
  keyLoading.value = true;
  try {
    keys.value = unwrapData<EmployeeCertKey[]>(await listEmployeeCertKeys(currentEmployee.value.id)) || [];
  } finally {
    keyLoading.value = false;
  }
}

async function saveKey() {
  if (!currentEmployee.value) {
    return;
  }
  if (!keyForm.publicKey.trim()) {
    ElMessage.error('请录入公钥');
    return;
  }
  keySaving.value = true;
  try {
    await saveEmployeeCertKey({
      employeeId: currentEmployee.value.id,
      keyName: keyForm.keyName || '手工录入公钥',
      keyAlgorithm: keyForm.keyAlgorithm,
      publicKey: keyForm.publicKey,
      keySource: 'MANUAL',
      enabled: true
    });
    keyForm.keyName = '';
    keyForm.publicKey = '';
    ElMessage.success('公钥已保存');
    loadKeys();
  } finally {
    keySaving.value = false;
  }
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

onMounted(async () => {
  await Promise.all([loadTasks(), loadEmailProfiles()]);
});
</script>

<style scoped>
.panel-card {
  min-height: 640px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hidden-file {
  display: none;
}

.mb12 {
  margin-bottom: 12px;
}

.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}
</style>
