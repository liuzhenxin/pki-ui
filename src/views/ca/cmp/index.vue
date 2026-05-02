<script setup name="CaCmp" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, nextTick, reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { getCmpHealth, pageCmpLogs, testCmp } from '@/api/ca/cmp';
import { getRequestor, modifyRequestor, pageRequestor, removeRequestor, saveRequestor } from '@/api/ca/requestor';
import { listRootCa } from '@/api/ca/root';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const activeTab = ref('requestor');
const requestorLoading = ref(false);
const logLoading = ref(false);
const healthLoading = ref(false);
const testLoading = ref(false);
const requestorList = ref<any[]>([]);
const logList = ref<any[]>([]);
const rootList = ref<any[]>([]);
const requestorTotal = ref(0);
const logTotal = ref(0);
const requestorFormRef = ref<FormInstance>();
const testFormRef = ref<FormInstance>();

const requestorDialog = reactive({
  visible: false,
  title: ''
});

const confDialog = reactive({
  visible: false,
  content: ''
});

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  name: '',
  type: 'CMP'
});

const logQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  caName: '',
  requestorName: '',
  messageType: '',
  status: ''
});

const requestorForm = reactive<any>({
  id: undefined,
  name: '',
  type: 'CMP',
  authMode: 'PBM',
  sharedSecret: '',
  certSubject: '',
  allowedIps: '',
  profiles: '',
  enabled: true,
  conf: ''
});

const health = ref<any>({});

const testForm = reactive({
  caName: '',
  messageBase64: ''
});

const testResult = ref<any>();

const requestorRules: FormRules = {
  name: [{ required: true, message: '请求者名称不能为空', trigger: 'blur' }],
  authMode: [{ required: true, message: '请选择认证方式', trigger: 'change' }]
};

const testRules: FormRules = {
  caName: [{ required: true, message: '请选择或输入CA名称', trigger: 'change' }],
  messageBase64: [{ required: true, message: '请输入Base64 CMP消息', trigger: 'blur' }]
};

const messageTypes = ['IR', 'CR', 'KUR', 'RR', 'P10CR', 'GENM'];

function parseConf(conf?: string) {
  if (!conf) return {};
  try {
    return JSON.parse(conf);
  } catch (error) {
    return {};
  }
}

function buildConf() {
  return JSON.stringify(
    {
      authMode: requestorForm.authMode,
      sharedSecret: requestorForm.sharedSecret,
      certSubject: requestorForm.certSubject,
      allowedIps: requestorForm.allowedIps
        ? requestorForm.allowedIps
            .split(',')
            .map((item: string) => item.trim())
            .filter(Boolean)
        : [],
      profiles: requestorForm.profiles
        ? requestorForm.profiles
            .split(',')
            .map((item: string) => item.trim())
            .filter(Boolean)
        : [],
      enabled: requestorForm.enabled
    },
    null,
    2
  );
}

function resetRequestorForm() {
  Object.assign(requestorForm, {
    id: undefined,
    name: '',
    type: 'CMP',
    authMode: 'PBM',
    sharedSecret: '',
    certSubject: '',
    allowedIps: '',
    profiles: '',
    enabled: true,
    conf: ''
  });
  requestorFormRef.value?.resetFields();
}

async function loadRootList() {
  try {
    const res = await listRootCa({ pageNum: 1, pageSize: 200 });
    rootList.value = res.data?.rows || res.data?.records || [];
  } catch (error) {
    rootList.value = [];
  }
}

async function loadHealth() {
  healthLoading.value = true;
  try {
    const res = await getCmpHealth();
    health.value = res.data || {};
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '加载CMP健康状态失败');
  } finally {
    healthLoading.value = false;
  }
}

async function getRequestorList() {
  requestorLoading.value = true;
  try {
    const res = await pageRequestor(queryParams);
    requestorList.value = [];
    requestorTotal.value = res.data?.total || 0;
    await nextTick();
    requestorList.value = res.data?.rows || res.data?.records || [];
  } finally {
    requestorLoading.value = false;
  }
}

function handleRequestorQuery() {
  queryParams.pageNum = 1;
  getRequestorList();
}

function handleAddRequestor() {
  resetRequestorForm();
  requestorDialog.title = '新增CMP请求者';
  requestorDialog.visible = true;
}

async function handleUpdateRequestor(row: any) {
  resetRequestorForm();
  const res = await getRequestor(row.id);
  const data = res.data || row;
  const conf = parseConf(data.conf);
  Object.assign(requestorForm, {
    id: data.id,
    name: data.name,
    type: 'CMP',
    authMode: conf.authMode || 'PBM',
    sharedSecret: conf.sharedSecret || '',
    certSubject: conf.certSubject || '',
    allowedIps: Array.isArray(conf.allowedIps) ? conf.allowedIps.join(',') : '',
    profiles: Array.isArray(conf.profiles) ? conf.profiles.join(',') : '',
    enabled: conf.enabled !== false,
    conf: data.conf
  });
  requestorDialog.title = '修改CMP请求者';
  requestorDialog.visible = true;
}

function submitRequestor() {
  requestorFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    const payload = {
      co: {
        id: requestorForm.id,
        name: requestorForm.name,
        type: 'CMP',
        conf: buildConf()
      }
    };
    try {
      if (requestorForm.id) {
        await modifyRequestor(payload);
        ElMessage.success('CMP请求者已更新');
      } else {
        await saveRequestor(payload);
        ElMessage.success('CMP请求者已新增');
      }
      requestorDialog.visible = false;
      getRequestorList();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || error.message || '保存CMP请求者失败');
    }
  });
}

async function handleDeleteRequestor(row: any) {
  await proxy?.$modal.confirm(`是否确认删除CMP请求者"${row.name}"？`);
  await removeRequestor([row.id]);
  ElMessage.success('删除成功');
  getRequestorList();
}

function handleViewConf(row: any) {
  try {
    confDialog.content = JSON.stringify(JSON.parse(row.conf), null, 2);
  } catch (error) {
    confDialog.content = row.conf || '';
  }
  confDialog.visible = true;
}

async function getLogList() {
  logLoading.value = true;
  try {
    const res = await pageCmpLogs(logQuery);
    logList.value = [];
    logTotal.value = res.data?.total || 0;
    await nextTick();
    logList.value = res.data?.rows || res.data?.records || [];
  } finally {
    logLoading.value = false;
  }
}

function handleLogQuery() {
  logQuery.pageNum = 1;
  getLogList();
}

function submitTest() {
  testFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    testLoading.value = true;
    try {
      const res = await testCmp(testForm);
      testResult.value = res.data;
      ElMessage.success('CMP测试请求已完成');
      getLogList();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || error.message || 'CMP测试失败');
    } finally {
      testLoading.value = false;
    }
  });
}

loadRootList();
loadHealth();
getRequestorList();
getLogList();
</script>

<template>
  <div class="p-2">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="CMP请求者" name="requestor">
        <el-card shadow="hover">
          <template #header>
            <el-row :gutter="10">
              <el-col :span="1.5">
                <el-button type="primary" plain icon="Plus" @click="handleAddRequestor" v-hasPermi="['ca:cmp:requestor']">新增请求者</el-button>
              </el-col>
              <el-col :span="8">
                <el-input v-model="queryParams.name" placeholder="请求者名称" clearable @keyup.enter="handleRequestorQuery">
                  <template #append>
                    <el-button icon="Search" @click="handleRequestorQuery" />
                  </template>
                </el-input>
              </el-col>
            </el-row>
          </template>
          <el-table v-loading="requestorLoading" border :data="requestorList">
            <el-table-column label="请求者名称" prop="name" min-width="180" show-overflow-tooltip />
            <el-table-column label="认证方式" width="120">
              <template #default="scope">{{ parseConf(scope.row.conf).authMode || '-' }}</template>
            </el-table-column>
            <el-table-column label="启用状态" width="100">
              <template #default="scope">
                <el-tag :type="parseConf(scope.row.conf).enabled === false ? 'info' : 'success'">{{
                  parseConf(scope.row.conf).enabled === false ? '停用' : '启用'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="允许IP" min-width="180" show-overflow-tooltip>
              <template #default="scope">{{ (parseConf(scope.row.conf).allowedIps || []).join(',') || '-' }}</template>
            </el-table-column>
            <el-table-column label="授权模板" min-width="180" show-overflow-tooltip>
              <template #default="scope">{{ (parseConf(scope.row.conf).profiles || []).join(',') || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="210">
              <template #default="scope">
                <el-button link type="primary" icon="View" @click="handleViewConf(scope.row)">配置</el-button>
                <el-button link type="primary" icon="Edit" @click="handleUpdateRequestor(scope.row)" v-hasPermi="['ca:cmp:requestor']"
                  >修改</el-button
                >
                <el-button link type="danger" icon="Delete" @click="handleDeleteRequestor(scope.row)" v-hasPermi="['ca:cmp:requestor']"
                  >删除</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <pagination
            v-show="requestorTotal > 0"
            v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize"
            :total="requestorTotal"
            @pagination="getRequestorList"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="协议状态" name="health">
        <el-card v-loading="healthLoading" shadow="hover">
          <template #header>
            <el-button icon="Refresh" @click="loadHealth" v-hasPermi="['ca:cmp:health']">刷新状态</el-button>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag type="success">{{ health.status || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="检查时间">{{ health.checkedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="POST入口">{{ health.postEndpoint || '-' }}</el-descriptions-item>
            <el-descriptions-item label="GET入口">{{ health.getEndpoint || '-' }}</el-descriptions-item>
            <el-descriptions-item label="认证方式">{{ (health.authenticationModes || []).join(', ') }}</el-descriptions-item>
            <el-descriptions-item label="消息类型">{{ (health.supportedMessageTypes || []).join(', ') }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="测试工具" name="test">
        <el-card shadow="hover">
          <el-form ref="testFormRef" :model="testForm" :rules="testRules" label-width="130px">
            <el-form-item label="CA名称" prop="caName">
              <el-select v-model="testForm.caName" placeholder="请选择CA" filterable allow-create style="width: 100%">
                <el-option v-for="item in rootList" :key="item.id" :label="item.name" :value="item.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="CMP消息Base64" prop="messageBase64">
              <el-input v-model="testForm.messageBase64" type="textarea" :rows="8" placeholder="请输入DER编码CMP消息的Base64内容" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="testLoading" @click="submitTest" v-hasPermi="['ca:cmp:test']">发送测试</el-button>
            </el-form-item>
          </el-form>
          <el-descriptions v-if="testResult" class="mt-10px" :column="2" border>
            <el-descriptions-item label="状态码">{{ testResult.statusCode }}</el-descriptions-item>
            <el-descriptions-item label="响应大小">{{ testResult.responseSize }}</el-descriptions-item>
            <el-descriptions-item label="状态说明" :span="2">{{ testResult.statusMessage }}</el-descriptions-item>
          </el-descriptions>
          <el-input v-if="testResult?.responseBase64" class="mt-10px" :model-value="testResult.responseBase64" type="textarea" :rows="8" readonly />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="交易日志" name="logs">
        <el-card shadow="hover">
          <el-form :model="logQuery" :inline="true">
            <el-form-item label="CA名称">
              <el-input v-model="logQuery.caName" clearable placeholder="CA名称" />
            </el-form-item>
            <el-form-item label="请求者">
              <el-input v-model="logQuery.requestorName" clearable placeholder="请求者" />
            </el-form-item>
            <el-form-item label="消息类型">
              <el-select v-model="logQuery.messageType" clearable placeholder="消息类型" style="width: 140px">
                <el-option v-for="item in messageTypes" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="logQuery.status" clearable placeholder="状态" style="width: 130px">
                <el-option label="成功" value="SUCCESS" />
                <el-option label="失败" value="FAILED" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleLogQuery">搜索</el-button>
              <el-button icon="Refresh" @click="getLogList">刷新</el-button>
            </el-form-item>
          </el-form>
          <el-table v-loading="logLoading" border :data="logList">
            <el-table-column label="时间" prop="createTime" width="180" />
            <el-table-column label="CA名称" prop="caName" width="140" show-overflow-tooltip />
            <el-table-column label="请求者" prop="requestorName" min-width="180" show-overflow-tooltip />
            <el-table-column label="类型" prop="messageType" width="90" />
            <el-table-column label="客户端IP" prop="clientIp" width="130" />
            <el-table-column label="状态" prop="status" width="90">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'SUCCESS' ? 'success' : 'danger'">{{ scope.row.status === 'SUCCESS' ? '成功' : '失败' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="耗时(ms)" prop="durationMs" width="100" />
            <el-table-column label="说明" prop="statusMessage" min-width="240" show-overflow-tooltip />
          </el-table>
          <pagination
            v-show="logTotal > 0"
            v-model:page="logQuery.pageNum"
            v-model:limit="logQuery.pageSize"
            :total="logTotal"
            @pagination="getLogList"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="requestorDialog.visible" :title="requestorDialog.title" width="680px" append-to-body>
      <el-form ref="requestorFormRef" :model="requestorForm" :rules="requestorRules" label-width="120px">
        <el-form-item label="请求者名称" prop="name">
          <el-input v-model="requestorForm.name" placeholder="请输入请求者名称" />
        </el-form-item>
        <el-form-item label="认证方式" prop="authMode">
          <el-select v-model="requestorForm.authMode" style="width: 100%">
            <el-option label="PBM共享密钥" value="PBM" />
            <el-option label="签名证书" value="SIGNATURE" />
            <el-option label="TLS客户端证书" value="TLS_CLIENT_CERT" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="requestorForm.authMode === 'PBM'" label="共享密钥">
          <el-input v-model="requestorForm.sharedSecret" type="password" show-password placeholder="请输入共享密钥" />
        </el-form-item>
        <el-form-item v-if="requestorForm.authMode !== 'PBM'" label="证书主题">
          <el-input v-model="requestorForm.certSubject" placeholder="例如: CN=cmp-client,O=LiuZX" />
        </el-form-item>
        <el-form-item label="允许IP">
          <el-input v-model="requestorForm.allowedIps" placeholder="多个IP用英文逗号分隔" />
        </el-form-item>
        <el-form-item label="授权模板">
          <el-input v-model="requestorForm.profiles" placeholder="多个模板名称用英文逗号分隔" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="requestorForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitRequestor">确 定</el-button>
        <el-button @click="requestorDialog.visible = false">取 消</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="confDialog.visible" title="CMP请求者配置" width="720px" append-to-body>
      <pre class="conf-preview">{{ confDialog.content }}</pre>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.conf-preview {
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
}
</style>
