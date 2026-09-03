<template>
  <div class="p-2">
    <el-card shadow="hover">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <el-form-item label="名称/编码" prop="keyword">
          <el-input v-model="queryParams.keyword" placeholder="请输入CA名称或编码" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="业务状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 150px">
            <el-option label="正常" value="ACTIVE" />
            <el-option label="暂停新业务" value="SUSPENDED" />
            <el-option label="已退役" value="RETIRED" />
          </el-select>
        </el-form-item>
        <el-form-item label="接入模式" prop="mode">
          <el-select v-model="queryParams.mode" placeholder="全部" clearable style="width: 150px">
            <el-option label="外部CA" value="external" />
            <el-option label="网关转发" value="gateway" />
            <el-option label="直接连接" value="direct" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">查询</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-row :gutter="10" class="mb8">
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:ca:save']" type="primary" plain icon="Plus" @click="handleAdd">新增CA</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button icon="Refresh" plain @click="getList">刷新</el-button>
        </el-col>
      </el-row>

      <el-alert
        class="stage-alert"
        type="info"
        :closable="false"
        show-icon
        title="暂停状态只禁止新签发，退役状态禁止全部CA操作；存量证书始终保留原CA归属。"
      />

      <el-table v-loading="loading" :data="instanceList">
        <el-table-column label="CA实例" min-width="190">
          <template #default="scope">
            <div class="instance-name">
              <span>{{ scope.row.name }}</span>
              <el-tag v-if="scope.row.defaultForApply === 1" type="success" size="small">默认</el-tag>
            </div>
            <div class="muted">{{ scope.row.code }}</div>
          </template>
        </el-table-column>
        <el-table-column label="服务地址" prop="baseUrl" min-width="260" show-overflow-tooltip />
        <el-table-column label="接入模式" prop="mode" width="110">
          <template #default="scope">{{ modeLabel(scope.row.mode) }}</template>
        </el-table-column>
        <el-table-column label="业务状态" width="125">
          <template #default="scope">
            <el-tag :type="statusTag(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="连接状态" width="125">
          <template #default="scope">
            <el-tooltip :content="scope.row.lastHealthMessage || '尚未检测'" placement="top">
              <el-tag :type="healthTag(scope.row.healthStatus)" effect="plain">
                {{ healthLabel(scope.row.healthStatus) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="凭据" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.credentialConfigured ? 'success' : 'warning'" effect="plain">
              {{ scope.row.credentialConfigured ? '已配置' : '未配置' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后检测" prop="lastHealthTime" width="180">
          <template #default="scope">{{ scope.row.lastHealthTime || '-' }}</template>
        </el-table-column>
        <el-table-column label="最后同步" prop="lastSyncTime" width="180">
          <template #default="scope">{{ scope.row.lastSyncTime || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="420">
          <template #default="scope">
            <el-button v-hasPermi="['ra:ca:modify']" link type="primary" icon="Edit" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button v-hasPermi="['ra:ca:credential']" link type="primary" icon="Key" @click="handleCredential(scope.row)">凭据</el-button>
            <el-button
              v-hasPermi="['ra:ca:test']"
              link
              type="success"
              icon="Connection"
              :loading="testingId === scope.row.id"
              @click="handleTest(scope.row)"
            >
              测试
            </el-button>
            <el-button
              v-hasPermi="['ra:ca:sync']"
              link
              type="warning"
              icon="Refresh"
              :disabled="scope.row.status === 'RETIRED'"
              :loading="syncingId === scope.row.id"
              @click="handleSync(scope.row)"
            >
              同步
            </el-button>
            <el-dropdown
              v-hasPermi="['ra:ca:default', 'ra:ca:status', 'ra:ca:remove']"
              trigger="click"
              @command="(command) => handleCommand(command, scope.row)"
            >
              <el-button link type="primary"
                >更多<el-icon class="el-icon--right"><ArrowDown /></el-icon
              ></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="scope.row.defaultForApply !== 1" v-hasPermi="['ra:ca:default']" command="default"
                    >设为默认</el-dropdown-item
                  >
                  <el-dropdown-item v-if="scope.row.status !== 'ACTIVE'" v-hasPermi="['ra:ca:status']" command="ACTIVE">恢复正常</el-dropdown-item>
                  <el-dropdown-item v-if="scope.row.status === 'ACTIVE'" v-hasPermi="['ra:ca:status']" command="SUSPENDED"
                    >暂停新业务</el-dropdown-item
                  >
                  <el-dropdown-item v-if="scope.row.status !== 'RETIRED'" v-hasPermi="['ra:ca:status']" command="RETIRED">退役</el-dropdown-item>
                  <el-dropdown-item v-hasPermi="['ra:ca:remove']" divided command="remove">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-dialog v-model="instanceDialog.visible" :title="instanceDialog.title" width="720px" append-to-body>
      <el-form ref="instanceFormRef" :model="instanceForm" :rules="instanceRules" label-width="125px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="CA编码" prop="code">
              <el-input v-model="instanceForm.code" :disabled="Boolean(instanceForm.id)" placeholder="例如 ca-east-1" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="CA名称" prop="name"><el-input v-model="instanceForm.name" maxlength="128" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="服务地址" prop="baseUrl"
          ><el-input v-model="instanceForm.baseUrl" placeholder="https://ca.example.com/api"
        /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="接入模式" prop="mode">
              <el-select v-model="instanceForm.mode" style="width: 100%">
                <el-option label="外部CA" value="external" />
                <el-option label="网关转发" value="gateway" />
                <el-option label="直接连接" value="direct" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="业务状态" prop="status">
              <el-select v-model="instanceForm.status" style="width: 100%">
                <el-option label="正常" value="ACTIVE" />
                <el-option label="暂停新业务" value="SUSPENDED" />
                <el-option label="已退役" value="RETIRED" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="请求者名称"><el-input v-model="instanceForm.requestorName" placeholder="CA侧登记的RA请求者名称" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="连接超时" prop="connectTimeoutMs">
              <el-input-number v-model="instanceForm.connectTimeoutMs" :min="100" :max="120000" controls-position="right" />
              <span class="unit">毫秒</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="读取超时" prop="readTimeoutMs">
              <el-input-number v-model="instanceForm.readTimeoutMs" :min="100" :max="120000" controls-position="right" />
              <span class="unit">毫秒</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="设为默认">
          <el-switch v-model="instanceForm.defaultForApply" :active-value="1" :inactive-value="0" />
          <span class="hint">默认CA必须处于正常状态</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="instanceDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitInstance">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="credentialDialog.visible" :title="`配置凭据 - ${credentialDialog.name}`" width="800px" append-to-body>
      <el-alert type="warning" :closable="false" show-icon title="Client Secret和身份私钥只允许写入，不会从接口回显；留空保存不会覆盖已有秘密。" />
      <el-form ref="credentialFormRef" class="credential-form" :model="credentialForm" :rules="credentialRules" label-width="150px">
        <el-form-item label="认证类型" prop="authType">
          <el-radio-group v-model="credentialForm.authType">
            <el-radio-button value="NONE">无需认证</el-radio-button>
            <el-radio-button value="OAUTH2_CLIENT">OAuth2 Client</el-radio-button>
            <el-radio-button value="MTLS">mTLS身份认证</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="credentialForm.authType === 'OAUTH2_CLIENT'">
          <el-form-item label="令牌地址" prop="tokenUri"
            ><el-input v-model="credentialForm.tokenUri" placeholder="https://auth.example.com/oauth2/token"
          /></el-form-item>
          <el-form-item label="Client ID" prop="clientId"><el-input v-model="credentialForm.clientId" /></el-form-item>
          <el-form-item label="Client Secret">
            <el-input
              v-model="credentialForm.clientSecret"
              type="password"
              show-password
              :placeholder="secretPlaceholder"
              autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item label="外部密钥引用"><el-input v-model="credentialForm.clientSecretRef" :placeholder="secretRefPlaceholder" /></el-form-item>
        </template>
        <template v-if="credentialForm.authType === 'MTLS'">
          <el-form-item label="RA身份证书"
            ><el-input v-model="credentialForm.identityCertPem" type="textarea" :rows="7" placeholder="-----BEGIN CERTIFICATE-----"
          /></el-form-item>
          <el-form-item label="RA身份私钥">
            <el-input v-model="credentialForm.identityPrivateKey" type="textarea" :rows="5" :placeholder="privateKeyPlaceholder" />
          </el-form-item>
          <el-form-item label="外部私钥引用"
            ><el-input v-model="credentialForm.identityPrivateKeyRef" :placeholder="privateKeyRefPlaceholder"
          /></el-form-item>
          <el-form-item label="密钥标识"><el-input v-model="credentialForm.keyId" placeholder="可选" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="credentialDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingCredential" @click="submitCredential">保存凭据</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testDialog.visible" :title="`连接测试 - ${testDialog.name}`" width="620px" append-to-body>
      <el-result :icon="testDialog.result?.passed ? 'success' : 'error'" :title="testDialog.result?.passed ? '连接测试通过' : '连接测试未通过'">
        <template #sub-title>检测时间：{{ testDialog.result?.checkedAt || '-' }}</template>
      </el-result>
      <el-table :data="testDialog.result?.checks || []" size="small">
        <el-table-column label="检查项" prop="name" width="150" />
        <el-table-column label="结果" width="90">
          <template #default="scope"
            ><el-tag :type="scope.row.passed ? 'success' : 'danger'">{{ scope.row.passed ? '通过' : '失败' }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="说明" prop="message" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup name="RaCaInstance" lang="ts">
import { computed, reactive, ref } from 'vue';
import { ArrowDown } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import {
  getRaCaCredential,
  getRaCaInstance,
  modifyRaCaInstance,
  pageRaCaInstance,
  removeRaCaInstance,
  saveRaCaCredential,
  saveRaCaInstance,
  setDefaultRaCaInstance,
  syncRaCaInstance,
  testRaCaConnection,
  updateRaCaInstanceStatus
} from '@/api/ra/caInstance';
import type { RaCaConnectionTest, RaCaCredential, RaCaInstance, RaCaInstanceQuery, RaCaStatus } from '@/api/ra/caInstance';

const loading = ref(false);
const saving = ref(false);
const savingCredential = ref(false);
const testingId = ref<number | string>();
const syncingId = ref<number | string>();
const total = ref(0);
const instanceList = ref<RaCaInstance[]>([]);
const queryFormRef = ref<FormInstance>();
const instanceFormRef = ref<FormInstance>();
const credentialFormRef = ref<FormInstance>();

const queryParams = reactive<RaCaInstanceQuery>({ pageNum: 1, pageSize: 10, keyword: '', status: '', mode: '' });
const instanceDialog = reactive({ visible: false, title: '' });
const credentialDialog = reactive({ visible: false, id: undefined as number | string | undefined, name: '' });
const testDialog = reactive({ visible: false, name: '', result: undefined as RaCaConnectionTest | undefined });

const defaultInstance = (): RaCaInstance => ({
  code: '',
  name: '',
  baseUrl: '',
  mode: 'external',
  status: 'ACTIVE',
  defaultForApply: 0,
  requestorName: '',
  connectTimeoutMs: 5000,
  readTimeoutMs: 30000
});
const instanceForm = reactive<RaCaInstance>(defaultInstance());

const defaultCredential = (): RaCaCredential => ({
  authType: 'NONE',
  tokenUri: '',
  clientId: '',
  clientSecret: '',
  clientSecretRef: '',
  identityCertPem: '',
  identityPrivateKey: '',
  identityPrivateKeyRef: '',
  keyId: '',
  clientSecretConfigured: false,
  clientSecretRefConfigured: false,
  identityPrivateKeyConfigured: false,
  identityPrivateKeyRefConfigured: false
});
const credentialForm = reactive<RaCaCredential>(defaultCredential());

const urlRule = /^https?:\/\/[^\s]+$/i;
const instanceRules: FormRules = {
  code: [
    { required: true, message: 'CA编码不能为空', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9-]{1,62}$/, message: '仅支持小写字母、数字和连字符，长度2-63', trigger: 'blur' }
  ],
  name: [{ required: true, message: 'CA名称不能为空', trigger: 'blur' }],
  baseUrl: [
    { required: true, message: 'CA服务地址不能为空', trigger: 'blur' },
    { pattern: urlRule, message: '请输入有效的HTTP/HTTPS地址', trigger: 'blur' }
  ],
  mode: [{ required: true, message: '请选择接入模式', trigger: 'change' }],
  status: [{ required: true, message: '请选择业务状态', trigger: 'change' }]
};
const credentialRules: FormRules = {
  authType: [{ required: true, message: '请选择认证类型', trigger: 'change' }],
  tokenUri: [{ pattern: urlRule, message: '请输入有效的HTTP/HTTPS地址', trigger: 'blur' }]
};

const secretPlaceholder = computed(() => (credentialForm.clientSecretConfigured ? '已配置，留空保持不变' : '请输入Client Secret'));
const secretRefPlaceholder = computed(() => (credentialForm.clientSecretRefConfigured ? '外部引用已配置，留空保持不变' : '可选：Vault/KMS引用'));
const privateKeyPlaceholder = computed(() => (credentialForm.identityPrivateKeyConfigured ? '已配置，留空保持不变' : '-----BEGIN PRIVATE KEY-----'));
const privateKeyRefPlaceholder = computed(() =>
  credentialForm.identityPrivateKeyRefConfigured ? '外部引用已配置，留空保持不变' : '可选：HSM/Vault/KMS引用'
);

const unwrap = (response: any) => {
  const body = response?.data ?? response;
  return body?.data ?? body;
};

async function getList() {
  loading.value = true;
  try {
    const data = unwrap(await pageRaCaInstance(queryParams)) || {};
    instanceList.value = data.records || data.rows || [];
    total.value = Number(data.total || 0);
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleAdd() {
  Object.assign(instanceForm, defaultInstance());
  instanceDialog.title = '新增CA实例';
  instanceDialog.visible = true;
  instanceFormRef.value?.clearValidate();
}

async function handleEdit(row: RaCaInstance) {
  const data = unwrap(await getRaCaInstance(row.id!));
  Object.assign(instanceForm, defaultInstance(), data);
  instanceDialog.title = '编辑CA实例';
  instanceDialog.visible = true;
  instanceFormRef.value?.clearValidate();
}

async function submitInstance() {
  await instanceFormRef.value?.validate();
  saving.value = true;
  try {
    if (instanceForm.id) {
      await modifyRaCaInstance({ ...instanceForm });
    } else {
      await saveRaCaInstance({ ...instanceForm });
    }
    ElMessage.success('保存成功');
    instanceDialog.visible = false;
    await getList();
  } finally {
    saving.value = false;
  }
}

async function handleCredential(row: RaCaInstance) {
  const data = unwrap(await getRaCaCredential(row.id!)) || {};
  Object.assign(credentialForm, defaultCredential(), data, { clientSecret: '', identityPrivateKey: '' });
  credentialDialog.id = row.id;
  credentialDialog.name = row.name;
  credentialDialog.visible = true;
  credentialFormRef.value?.clearValidate();
}

async function submitCredential() {
  await credentialFormRef.value?.validate();
  if (!credentialDialog.id) return;
  savingCredential.value = true;
  try {
    await saveRaCaCredential(credentialDialog.id, { ...credentialForm });
    ElMessage.success('凭据保存成功');
    credentialDialog.visible = false;
    await getList();
  } finally {
    savingCredential.value = false;
  }
}

async function handleTest(row: RaCaInstance) {
  testingId.value = row.id;
  try {
    const result = unwrap(await testRaCaConnection(row.id!));
    testDialog.name = row.name;
    testDialog.result = result;
    testDialog.visible = true;
    result?.passed ? ElMessage.success('连接测试通过') : ElMessage.warning('连接测试未通过');
    await getList();
  } finally {
    testingId.value = undefined;
  }
}

async function handleSync(row: RaCaInstance) {
  await ElMessageBox.confirm(`确认从“${row.name}”同步根证书和证书模板？本次未返回的资源将标记为不可用。`, '同步CA资源', { type: 'warning' });
  syncingId.value = row.id;
  try {
    const result = unwrap(await syncRaCaInstance(row.id!));
    ElMessage.success(
      `同步完成：根证书 ${Number(result?.rootCount || 0)} 个，模板 ${Number(result?.profileCount || 0)} 个，绑定 ${Number(result?.relationCount || 0)} 条`
    );
    await getList();
  } finally {
    syncingId.value = undefined;
  }
}

async function handleCommand(command: string, row: RaCaInstance) {
  if (command === 'default') {
    await ElMessageBox.confirm(`确认将“${row.name}”设为默认CA？`, '设置默认CA', { type: 'warning' });
    await setDefaultRaCaInstance(row.id!);
    ElMessage.success('默认CA已更新');
  } else if (command === 'remove') {
    await ElMessageBox.confirm(`确认删除“${row.name}”？已被业务数据引用时后端会拒绝删除。`, '删除CA实例', { type: 'warning' });
    await removeRaCaInstance(row.id!);
    ElMessage.success('删除成功');
  } else {
    const status = command as RaCaStatus;
    const action = status === 'ACTIVE' ? '恢复正常' : status === 'SUSPENDED' ? '暂停新业务' : '退役';
    await ElMessageBox.confirm(`确认将“${row.name}”${action}？`, '修改CA状态', { type: 'warning' });
    await updateRaCaInstanceStatus(row.id!, status);
    ElMessage.success('状态已更新');
  }
  await getList();
}

function statusLabel(status?: string) {
  return status === 'ACTIVE' ? '正常' : status === 'SUSPENDED' ? '暂停新业务' : status === 'RETIRED' ? '已退役' : status || '-';
}
function statusTag(status?: string) {
  return status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'info';
}
function healthLabel(status?: string) {
  return status === 'UP' ? '连接正常' : status === 'DOWN' ? '连接失败' : '尚未检测';
}
function healthTag(status?: string) {
  return status === 'UP' ? 'success' : status === 'DOWN' ? 'danger' : 'info';
}
function modeLabel(mode?: string) {
  return mode === 'gateway' ? '网关转发' : mode === 'direct' ? '直接连接' : '外部CA';
}

getList();
</script>

<style scoped>
.mb8 {
  margin-bottom: 8px;
}
.stage-alert {
  margin: 8px 0 16px;
}
.instance-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.muted {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}
.hint {
  margin-left: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.credential-form {
  margin-top: 18px;
}
</style>
