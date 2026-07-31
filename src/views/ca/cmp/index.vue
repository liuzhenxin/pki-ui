<script setup name="CaCmpMonitor" lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { getCmpHealth, pageCmpLogs, testCmp } from '@/api/ca/cmp';
import { listRootCa } from '@/api/ca/root';

const activeTab = ref('health');
const healthLoading = ref(false);
const testLoading = ref(false);
const logLoading = ref(false);
const rootList = ref<any[]>([]);
const logList = ref<any[]>([]);
const logTotal = ref(0);
const testFormRef = ref<FormInstance>();
const health = ref<any>({});
const testResult = ref<any>();

const healthTagType = computed(() => (health.value.status === 'UP' ? 'success' : 'danger'));

const testForm = reactive({
  caName: '',
  messageBase64: ''
});

const logQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  caName: '',
  requestorName: '',
  messageType: '',
  status: ''
});

const testRules: FormRules = {
  caName: [{ required: true, message: '请选择或输入CA名称', trigger: 'change' }],
  messageBase64: [{ required: true, message: '请输入Base64 CMP消息', trigger: 'blur' }]
};

const messageTypes = ['IR', 'CR', 'KUR', 'RR', 'P10CR', 'GENM'];

async function loadRootList() {
  try {
    const res = await listRootCa({ pageNum: 1, pageSize: 200 });
    rootList.value = res.data?.rows || res.data?.records || [];
  } catch {
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

async function getLogList() {
  logLoading.value = true;
  try {
    const res = await pageCmpLogs(logQuery);
    logList.value = res.data?.rows || res.data?.records || [];
    logTotal.value = res.data?.total || 0;
  } finally {
    logLoading.value = false;
  }
}

function handleLogQuery() {
  logQuery.pageNum = 1;
  getLogList();
}

function resetLogQuery() {
  Object.assign(logQuery, {
    pageNum: 1,
    pageSize: logQuery.pageSize,
    caName: '',
    requestorName: '',
    messageType: '',
    status: ''
  });
  getLogList();
}

loadRootList();
loadHealth();
getLogList();
</script>

<template>
  <div class="p-2">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="运行状态" name="health">
        <el-card v-loading="healthLoading" shadow="never">
          <template #header>
            <div class="panel-header">
              <span>CMP 服务状态</span>
              <el-tooltip content="刷新状态" placement="top">
                <el-button v-hasPermi="['ca:cmp:health']" icon="Refresh" circle @click="loadHealth" />
              </el-tooltip>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="healthTagType">{{ health.status || 'UNKNOWN' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="检查时间">{{ health.checkedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="POST入口">{{ health.postEndpoint || '-' }}</el-descriptions-item>
            <el-descriptions-item label="GET入口">{{ health.getEndpoint || '-' }}</el-descriptions-item>
            <el-descriptions-item label="认证方式">{{ (health.authenticationModes || []).join(', ') || '-' }}</el-descriptions-item>
            <el-descriptions-item label="消息类型">{{ (health.supportedMessageTypes || []).join(', ') || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="协议测试" name="test">
        <el-card shadow="never">
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
              <el-button v-hasPermi="['ca:cmp:test']" type="primary" :loading="testLoading" @click="submitTest">发送测试</el-button>
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
        <el-card shadow="never">
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
              <el-button v-hasPermi="['ca:cmp:log']" type="primary" icon="Search" @click="handleLogQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetLogQuery">重置</el-button>
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
  </div>
</template>

<style scoped lang="scss">
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
